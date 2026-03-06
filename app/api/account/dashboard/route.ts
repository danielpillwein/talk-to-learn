import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLAN_LIMITS, normalizePlan, type PlanTier, type SubscriptionStatus } from "@/lib/account-plans";
import { getStripeSubscriptionSnapshot, type StripeBillingInterval } from "@/lib/stripe-server";
import { getSpeechUsageSeconds, resolveDateKeyFromOffset } from "@/lib/speech-usage";

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
  usage: {
    speechSecondsToday: number;
    decksCreated: number;
  };
};

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Account nicht gefunden" }, { status: 404 });
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

    if (user.email) {
      try {
        const snapshot = await getStripeSubscriptionSnapshot(user.email);
        if (snapshot) {
          plan = snapshot.plan;
          status = snapshot.status;
          currentPeriodEnd = snapshot.currentPeriodEnd;
          nextBillingAt = snapshot.nextBillingAt;
          billingInterval = snapshot.billingInterval;
          canManageSubscription = plan !== "free";
        }
      } catch (stripeError) {
        console.error("Stripe subscription lookup failed:", stripeError);
      }
    }

    const payload: DashboardPayload = {
      plan,
      status,
      currentPeriodEnd,
      nextBillingAt,
      billingInterval,
      canManageSubscription,
      limits: PLAN_LIMITS[plan],
      usage: {
        speechSecondsToday,
        decksCreated,
      },
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Error loading account dashboard:", error);
    return NextResponse.json({ error: "Abo-Daten konnten nicht geladen werden" }, { status: 500 });
  }
}
