import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  billing,
  getStripePriceId,
  isBillingCycle,
  isPaidPlan,
  type BillingCycle,
  type PaidPlan,
} from "@/src/config/billing";
import { stripe } from "@/src/lib/stripe";

export const runtime = "nodejs";

function resolveAppUrl(): string {
  return String(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000")
    .trim()
    .replace(/\/$/, "");
}

function isStripeReady(): boolean {
  return String(process.env.STRIPE_SECRET_KEY ?? "").trim().length > 0;
}

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

    const payload = (await request.json().catch(() => null)) as
      | { plan?: string; cycle?: string; userEmail?: string; userId?: string }
      | null;
    const planRaw = String(payload?.plan ?? "").trim().toLowerCase();
    const cycleRaw = String(payload?.cycle ?? "").trim().toLowerCase();

    if (!isPaidPlan(planRaw)) {
      return NextResponse.json({ error: "Ungültiger Plan." }, { status: 400 });
    }
    if (!isBillingCycle(cycleRaw)) {
      return NextResponse.json({ error: "Ungültiger Abrechnungszyklus." }, { status: 400 });
    }
    if (!isStripeReady()) {
      return NextResponse.json({ error: "Stripe ist nicht konfiguriert." }, { status: 400 });
    }

    const plan: PaidPlan = planRaw;
    const cycle: BillingCycle = cycleRaw;
    const priceId = getStripePriceId(plan, cycle);
    if (!priceId) {
      return NextResponse.json({ error: "Preis-ID nicht konfiguriert." }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
      },
    });
    if (!user) {
      return NextResponse.json({ error: "Account nicht gefunden." }, { status: 404 });
    }
    if (!user.email) {
      return NextResponse.json({ error: "Für diesen Account fehlt eine E-Mail." }, { status: 400 });
    }

    let stripeCustomerId: string | null = null;
    const userColumns = await getUserColumns();
    if (userColumns.has("stripeCustomerId")) {
      const rows = await db.$queryRawUnsafe<Array<{ stripeCustomerId: string | null }>>(
        `SELECT "stripeCustomerId" FROM "User" WHERE "id" = ? LIMIT 1`,
        user.id
      );
      stripeCustomerId = rows[0]?.stripeCustomerId ?? null;
    }

    const appUrl = resolveAppUrl();
    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/app/account?checkout=success&session_id={CHECKOUT_SESSION_ID}#abo`,
      cancel_url: `${appUrl}/app/account?checkout=cancelled#abo`,
      metadata: {
        userId: user.id,
        plan,
        cycle,
      },
      client_reference_id: user.id,
    };

    if (stripeCustomerId) {
      sessionParams.customer = stripeCustomerId;
    } else {
      sessionParams.customer_email = user.email;
    }

    const checkoutSession = await stripe.checkout.sessions.create(sessionParams);
    const url = String(checkoutSession.url ?? "").trim();
    if (!url) {
      return NextResponse.json({ error: "Checkout-Session konnte nicht erstellt werden." }, { status: 500 });
    }

    return NextResponse.json({
      url,
      plan,
      cycle,
      configuredPrice: billing.pricing[plan][cycle],
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json({ error: "Checkout konnte nicht gestartet werden." }, { status: 500 });
  }
}
