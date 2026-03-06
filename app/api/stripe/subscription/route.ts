import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { normalizePlan } from "@/lib/account-plans";
import { db } from "@/lib/db";
import { stripe } from "@/src/lib/stripe";
import { persistSubscriptionForUser } from "@/src/lib/stripe-billing";

type SubscriptionAction = "cancel" | "resume";

export const runtime = "nodejs";

async function getUserColumns(): Promise<Set<string>> {
  try {
    const rows = await db.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("User")`);
    return new Set(rows.map((entry) => String(entry.name)));
  } catch {
    return new Set<string>();
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await auth();
    const userId = String(session?.user?.id ?? "").trim();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (String(process.env.STRIPE_SECRET_KEY ?? "").trim().length === 0) {
      return NextResponse.json({ error: "Stripe Billing ist nicht konfiguriert." }, { status: 400 });
    }

    const payload = (await request.json().catch(() => null)) as { action?: string } | null;
    const action = String(payload?.action ?? "").trim().toLowerCase() as SubscriptionAction;
    if (action !== "cancel" && action !== "resume") {
      return NextResponse.json({ error: "Ungültige Abo-Aktion." }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
      },
    });
    if (!user) {
      return NextResponse.json({ error: "Account nicht gefunden." }, { status: 404 });
    }

    const userColumns = await getUserColumns();
    if (!userColumns.has("plan") || !userColumns.has("subscriptionId")) {
      return NextResponse.json({ error: "Billing-Schema ist noch nicht migriert." }, { status: 409 });
    }

    const rows = await db.$queryRawUnsafe<Array<{ plan: string | null; subscriptionId: string | null }>>(
      `SELECT "plan","subscriptionId" FROM "User" WHERE "id" = ? LIMIT 1`,
      user.id
    );
    const billingRow = rows[0];
    if (!billingRow?.subscriptionId) {
      return NextResponse.json({ error: "Kein aktives Abo für diesen Account gefunden." }, { status: 404 });
    }

    await stripe.subscriptions.update(billingRow.subscriptionId, {
      cancel_at_period_end: action === "cancel",
    });

    const subscription = await stripe.subscriptions.retrieve(billingRow.subscriptionId, {
      expand: ["items.data.price"],
    });
    const snapshot = await persistSubscriptionForUser(user.id, subscription, {
      fallbackPlan: normalizePlan(billingRow.plan),
    });

    return NextResponse.json({
      ...snapshot,
    });
  } catch (error) {
    console.error("Error updating subscription cancellation:", error);
    return NextResponse.json({ error: "Abo-Status konnte nicht aktualisiert werden." }, { status: 500 });
  }
}
