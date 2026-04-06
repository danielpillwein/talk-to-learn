import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLAN_LIMITS, normalizePlan, type PlanTier, type SubscriptionStatus } from "@/lib/account-plans";
import { resolveOrCreateSessionUser } from "@/lib/session-user";
import { getSpeechUsageSeconds, resolveDateKeyFromOffset } from "@/lib/speech-usage";
import { billing, getPricingCards } from "@/src/config/billing";
import {
  normalizeStoredSubscriptionStatus,
  type StripeBillingInterval,
} from "@/src/lib/stripe-billing";

type DashboardPayload = {
  plan: PlanTier;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  nextBillingAt: string | null;
  billingInterval: StripeBillingInterval;
  canManageSubscription: boolean;
  limits: {
    deckLimit: number | "unlimited";
    questionsPerDeck: number | "unlimited";
    speechSecondsPerDay: number | "unlimited";
    aiRefine: boolean;
  };
  allPlanLimits: Record<
    PlanTier,
    {
      deckLimit: number | "unlimited";
      questionsPerDeck: number | "unlimited";
      speechSecondsPerDay: number | "unlimited";
      aiRefine: boolean;
    }
  >;
  usage: {
    speechSecondsToday: number;
    decksCreated: number;
  };
  billing: {
    planLabels: Record<PlanTier, string>;
    planOrder: Record<PlanTier, number>;
    pricingCards: ReturnType<typeof getPricingCards>;
    text: typeof billing.text;
  };
};

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const session = await auth();
    const user = await resolveOrCreateSessionUser(session?.user);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decksCreated = await db.deck.count({
      where: { ownerId: user.id },
    });

    const url = new URL(request.url);
    const tzOffsetMinutes = url.searchParams.get("tzOffsetMinutes");
    const dateKey = resolveDateKeyFromOffset(tzOffsetMinutes);
    const speechSecondsToday = await getSpeechUsageSeconds({
      userId: user.id,
      dateKey,
    });

    let plan: PlanTier = normalizePlan((session.user as { plan?: string | null } | undefined)?.plan);
    let status: SubscriptionStatus = "active";
    let currentPeriodEnd: string | null = null;
    let nextBillingAt: string | null = null;
    let billingInterval: StripeBillingInterval = null;
    let canManageSubscription = false;
    let subscriptionId: string | null = null;

    try {
      const columns = (await db.$queryRawUnsafe<Array<{ name: string }>>(
        `PRAGMA table_info("User")`
      )) as Array<{ name: string }>;
      const columnNames = new Set(columns.map((entry) => String(entry.name)));
      const hasBillingColumns =
        columnNames.has("plan") &&
        columnNames.has("subscriptionId") &&
        columnNames.has("subscriptionStatus") &&
        columnNames.has("subscriptionCurrentPeriodEnd") &&
        columnNames.has("billingCycle");

      if (hasBillingColumns) {
        const rows = await db.$queryRawUnsafe<
          Array<{
            plan: string | null;
            subscriptionId: string | null;
            subscriptionStatus: string | null;
            subscriptionCurrentPeriodEnd: string | null;
            billingCycle: string | null;
          }>
        >(
          `SELECT "plan","subscriptionId","subscriptionStatus","subscriptionCurrentPeriodEnd","billingCycle"
           FROM "User"
           WHERE "id" = ?
           LIMIT 1`,
          user.id
        );

        const billingRow = rows[0];
        if (billingRow) {
          plan = normalizePlan(billingRow.plan);
          subscriptionId = billingRow.subscriptionId ?? null;
          status =
            plan === "free" ? "active" : normalizeStoredSubscriptionStatus(billingRow.subscriptionStatus);

          if (billingRow.subscriptionCurrentPeriodEnd) {
            const parsed = new Date(billingRow.subscriptionCurrentPeriodEnd);
            currentPeriodEnd = Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
          }
          nextBillingAt = plan === "free" ? null : currentPeriodEnd;
          billingInterval =
            billingRow.billingCycle === "monthly" || billingRow.billingCycle === "yearly"
              ? billingRow.billingCycle
              : null;
          canManageSubscription =
            plan !== "free" &&
            Boolean(subscriptionId) &&
            String(process.env.STRIPE_SECRET_KEY ?? "").trim().length > 0;
        }
      }
    } catch (schemaError) {
      console.warn("Billing columns are not available yet. Falling back to free-plan defaults.", schemaError);
    }

    const payload: DashboardPayload = {
      plan,
      status,
      currentPeriodEnd,
      nextBillingAt,
      billingInterval,
      canManageSubscription,
      limits: PLAN_LIMITS[plan],
      allPlanLimits: PLAN_LIMITS,
      usage: {
        speechSecondsToday,
        decksCreated,
      },
      billing: {
        planLabels: billing.planLabels,
        planOrder: billing.planOrder,
        pricingCards: getPricingCards(),
        text: billing.text,
      },
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Error loading account dashboard:", error);
    return NextResponse.json({ error: "Abo-Daten konnten nicht geladen werden" }, { status: 500 });
  }
}
