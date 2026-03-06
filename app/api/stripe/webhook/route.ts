import Stripe from "stripe";
import { normalizePlan } from "@/lib/account-plans";
import { db } from "@/lib/db";
import { stripe } from "@/src/lib/stripe";
import { clearSubscriptionForUser, persistSubscriptionForUser } from "@/src/lib/stripe-billing";

export const runtime = "nodejs";

async function getUserColumns(): Promise<Set<string>> {
  try {
    const rows = await db.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("User")`);
    return new Set(rows.map((entry) => String(entry.name)));
  } catch {
    return new Set<string>();
  }
}

function getWebhookSecret(): string {
  return String(process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
}

function isStripeWebhookReady(): boolean {
  return (
    String(process.env.STRIPE_SECRET_KEY ?? "").trim().length > 0 &&
    getWebhookSecret().length > 0
  );
}

async function retrieveExpandedSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
}

async function findUserByStripeRefs(params: {
  userId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  email?: string | null;
}): Promise<{ id: string; plan: string } | null> {
  const userId = String(params.userId ?? "").trim();
  if (userId) {
    const byId = (await db.user.findUnique({
      where: { id: userId },
      select: { id: true, plan: true },
    } as any)) as { id: string; plan: string } | null;
    if (byId) return byId;
  }

  const subscriptionId = String(params.subscriptionId ?? "").trim();
  if (subscriptionId) {
    const bySubscription = (await db.user.findFirst({
      where: { subscriptionId },
      select: { id: true, plan: true },
    } as any)) as { id: string; plan: string } | null;
    if (bySubscription) return bySubscription;
  }

  const customerId = String(params.customerId ?? "").trim();
  if (customerId) {
    const byCustomer = (await db.user.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true, plan: true },
    } as any)) as { id: string; plan: string } | null;
    if (byCustomer) return byCustomer;
  }

  const email = String(params.email ?? "").trim();
  if (email) {
    const byEmail = (await db.user.findFirst({
      where: { email },
      select: { id: true, plan: true },
    } as any)) as { id: string; plan: string } | null;
    if (byEmail) return byEmail;
  }

  return null;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
  if (!subscriptionId) return;

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
  const metadataUserId = String(session.metadata?.userId ?? "").trim() || null;
  const clientReferenceUserId = String(session.client_reference_id ?? "").trim() || null;
  const user = await findUserByStripeRefs({
    userId: metadataUserId || clientReferenceUserId,
    customerId,
    subscriptionId,
    email: session.customer_email,
  });
  if (!user) return;

  const subscription = await retrieveExpandedSubscription(subscriptionId);
  await persistSubscriptionForUser(user.id, subscription, {
    fallbackPlan: normalizePlan(user.plan),
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
  if (!subscriptionId) return;

  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id ?? null;
  const user = await findUserByStripeRefs({
    subscriptionId,
    customerId,
    email: invoice.customer_email,
  });
  if (!user) return;

  const subscription = await retrieveExpandedSubscription(subscriptionId);
  await persistSubscriptionForUser(user.id, subscription, {
    fallbackPlan: normalizePlan(user.plan),
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;
  const user = await findUserByStripeRefs({
    subscriptionId: subscription.id,
    customerId,
  });
  if (!user) return;

  await persistSubscriptionForUser(user.id, subscription, {
    fallbackPlan: normalizePlan(user.plan),
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;
  const user = await findUserByStripeRefs({
    subscriptionId: subscription.id,
    customerId,
  });
  if (!user) return;

  await clearSubscriptionForUser(user.id);
}

export async function POST(request: Request): Promise<Response> {
  if (!isStripeWebhookReady()) {
    return new Response("Stripe Webhook nicht konfiguriert.", { status: 400 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Stripe-Signatur fehlt.", { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, getWebhookSecret());
  } catch (error) {
    console.error("Invalid Stripe webhook signature:", error);
    return new Response("Ungültige Stripe-Signatur.", { status: 400 });
  }

  try {
    const userColumns = await getUserColumns();
    const hasBillingColumns =
      userColumns.has("plan") &&
      userColumns.has("subscriptionId") &&
      userColumns.has("stripeCustomerId");
    if (!hasBillingColumns) {
      // Schema noch nicht migriert: Event akzeptieren, aber keine Persistenz versuchen.
      return new Response(null, { status: 200 });
    }

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error("Error processing Stripe webhook event:", event.type, error);
    return new Response("Webhook-Verarbeitung fehlgeschlagen.", { status: 500 });
  }

  return new Response(null, { status: 200 });
}
