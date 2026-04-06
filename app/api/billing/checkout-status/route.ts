import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { normalizePlan } from "@/lib/account-plans";
import { db } from "@/lib/db";
import { stripe } from "@/src/lib/stripe";
import { persistSubscriptionForUser } from "@/src/lib/stripe-billing";

export const runtime = "nodejs";

function isStripeReady(): boolean {
  return String(process.env.STRIPE_SECRET_KEY ?? "").trim().length > 0;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const session = await auth();
    const userId = String(session?.user?.id ?? "").trim();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isStripeReady()) {
      return NextResponse.json({ error: "Stripe ist nicht konfiguriert." }, { status: 400 });
    }

    const url = new URL(request.url);
    const checkoutSessionId = String(url.searchParams.get("session_id") ?? "").trim();
    if (!checkoutSessionId) {
      return NextResponse.json({ error: "session_id fehlt." }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        plan: true,
      },
    });
    if (!user) {
      return NextResponse.json({ error: "Account nicht gefunden." }, { status: 404 });
    }

    const checkoutSession = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    if (checkoutSession.mode !== "subscription") {
      return NextResponse.json({ error: "Ungültige Checkout-Session." }, { status: 400 });
    }

    const metadataUserId = String(checkoutSession.metadata?.userId ?? "").trim();
    const clientReferenceUserId = String(checkoutSession.client_reference_id ?? "").trim();
    const customerEmail = String(checkoutSession.customer_email ?? "").trim().toLowerCase();
    const userEmail = String(user.email ?? "").trim().toLowerCase();
    const belongsToUser =
      metadataUserId === user.id ||
      clientReferenceUserId === user.id ||
      (userEmail.length > 0 && customerEmail === userEmail);

    if (!belongsToUser) {
      return NextResponse.json({ error: "Checkout-Session gehört nicht zu diesem Account." }, { status: 403 });
    }

    const responseBase = {
      checkoutStatus: checkoutSession.status ?? "open",
      paymentStatus: checkoutSession.payment_status ?? null,
    };
    const subscriptionId =
      typeof checkoutSession.subscription === "string"
        ? checkoutSession.subscription
        : checkoutSession.subscription?.id ?? null;

    if (!subscriptionId || checkoutSession.status !== "complete") {
      return NextResponse.json(responseBase);
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price"],
    });
    const snapshot = await persistSubscriptionForUser(user.id, subscription, {
      fallbackPlan: normalizePlan(user.plan),
    });

    return NextResponse.json({
      ...responseBase,
      synced: true,
      subscription: snapshot,
    });
  } catch (error) {
    console.error("Error checking checkout status:", error);
    return NextResponse.json({ error: "Checkout-Status konnte nicht geprüft werden." }, { status: 500 });
  }
}
