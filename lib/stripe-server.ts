import { normalizePlan, type PlanTier, type SubscriptionStatus } from "@/lib/account-plans";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

type StripeCustomer = {
  id: string;
  email?: string | null;
};

type StripePrice = {
  id: string;
  nickname?: string | null;
  lookup_key?: string | null;
  recurring?: {
    interval?: string | null;
  } | null;
};

type StripeSubscriptionItem = {
  price: StripePrice;
};

type StripeSubscription = {
  id: string;
  status: string;
  cancel_at_period_end?: boolean;
  current_period_end?: number | null;
  items?: { data: StripeSubscriptionItem[] };
};

type StripeListResponse<T> = {
  object: "list";
  data: T[];
};

export type StripeBillingInterval = "monthly" | "yearly" | null;

function getStripeSecretKey(): string {
  return String(process.env.STRIPE_SECRET_KEY ?? "").trim();
}

function getStripePriceIds(envKey: string): Set<string> {
  const value = String(process.env[envKey] ?? "").trim();
  if (!value) return new Set();
  return new Set(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

async function stripeRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const secret = getStripeSecretKey();
  if (!secret) {
    throw new Error("Stripe ist nicht konfiguriert.");
  }

  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(init?.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string } })
    | { error?: { message?: string } }
    | null;

  if (!response.ok) {
    const message = payload?.error?.message || "Stripe-Anfrage fehlgeschlagen.";
    throw new Error(message);
  }

  return payload as T;
}

export function isStripeConfigured(): boolean {
  return Boolean(getStripeSecretKey());
}

export async function findStripeCustomerByEmail(email: string): Promise<StripeCustomer | null> {
  if (!isStripeConfigured()) return null;

  const query = new URLSearchParams({
    email,
    limit: "1",
  });
  const data = await stripeRequest<StripeListResponse<StripeCustomer>>(`/customers?${query.toString()}`);
  return data.data[0] ?? null;
}

export async function createStripeBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const body = new URLSearchParams({
    customer: customerId,
    return_url: returnUrl,
  });
  const data = await stripeRequest<{ url?: string }>("/billing_portal/sessions", {
    method: "POST",
    body: body.toString(),
  });

  const url = String(data.url ?? "").trim();
  if (!url) {
    throw new Error("Stripe Portal URL konnte nicht erstellt werden.");
  }
  return url;
}

function chooseMostRelevantSubscription(subscriptions: StripeSubscription[]): StripeSubscription | null {
  if (subscriptions.length === 0) return null;

  const activeFirst = subscriptions.find((entry) =>
    ["trialing", "active", "past_due", "unpaid"].includes(entry.status)
  );
  if (activeFirst) return activeFirst;

  const canceling = subscriptions.find((entry) => Boolean(entry.cancel_at_period_end));
  if (canceling) return canceling;

  return null;
}

function inferPlanFromSubscription(subscription: StripeSubscription): PlanTier {
  const premiumIds = getStripePriceIds("STRIPE_PRICE_PREMIUM_IDS");
  const ultimateIds = getStripePriceIds("STRIPE_PRICE_ULTIMATE_IDS");

  const firstPrice = subscription.items?.data?.[0]?.price;
  const priceId = String(firstPrice?.id ?? "").trim();

  if (priceId && ultimateIds.has(priceId)) return "ultimate";
  if (priceId && premiumIds.has(priceId)) return "premium";

  const descriptor = `${firstPrice?.nickname ?? ""} ${firstPrice?.lookup_key ?? ""}`.toLowerCase();
  if (descriptor.includes("ultimate")) return "ultimate";
  if (descriptor.includes("premium") || descriptor.includes("pro")) return "premium";

  return "premium";
}

function mapStatus(subscription: StripeSubscription): SubscriptionStatus {
  if (subscription.status === "past_due" || subscription.status === "unpaid") {
    return "past_due";
  }
  if (subscription.cancel_at_period_end) {
    return "cancel_at_period_end";
  }
  return "active";
}

function mapBillingInterval(subscription: StripeSubscription): StripeBillingInterval {
  const firstPrice = subscription.items?.data?.[0]?.price;
  const interval = String(firstPrice?.recurring?.interval ?? "").trim().toLowerCase();
  if (interval === "year") return "yearly";
  if (interval === "month") return "monthly";
  return null;
}

async function findMostRelevantSubscriptionForCustomer(customerId: string): Promise<StripeSubscription | null> {
  const query = new URLSearchParams({
    customer: customerId,
    status: "all",
    limit: "10",
  });
  query.append("expand[]", "data.items.data.price");

  const subscriptionResponse = await stripeRequest<StripeListResponse<StripeSubscription>>(
    `/subscriptions?${query.toString()}`
  );
  return chooseMostRelevantSubscription(subscriptionResponse.data ?? []);
}

export async function getStripeSubscriptionSnapshot(email: string): Promise<{
  customerId: string;
  plan: PlanTier;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  nextBillingAt: string | null;
  billingInterval: StripeBillingInterval;
} | null> {
  if (!isStripeConfigured()) return null;

  const customer = await findStripeCustomerByEmail(email);
  if (!customer?.id) return null;

  const selected = await findMostRelevantSubscriptionForCustomer(customer.id);
  if (!selected) {
    return {
      customerId: customer.id,
      plan: normalizePlan("free"),
      status: "active",
      currentPeriodEnd: null,
      nextBillingAt: null,
      billingInterval: null,
    };
  }

  const plan = inferPlanFromSubscription(selected);
  const status = mapStatus(selected);
  const billingInterval = mapBillingInterval(selected);
  const periodEnd =
    typeof selected.current_period_end === "number" && selected.current_period_end > 0
      ? new Date(selected.current_period_end * 1000).toISOString()
      : null;

  return {
    customerId: customer.id,
    plan,
    status,
    currentPeriodEnd: periodEnd,
    nextBillingAt: plan === "free" ? null : periodEnd,
    billingInterval,
  };
}

export async function setSubscriptionCancelAtPeriodEndByEmail(
  email: string,
  cancelAtPeriodEnd: boolean
): Promise<{
  customerId: string;
  plan: PlanTier;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  nextBillingAt: string | null;
  billingInterval: StripeBillingInterval;
} | null> {
  if (!isStripeConfigured()) return null;

  const customer = await findStripeCustomerByEmail(email);
  if (!customer?.id) return null;

  const selected = await findMostRelevantSubscriptionForCustomer(customer.id);
  if (!selected?.id) return null;

  const body = new URLSearchParams({
    cancel_at_period_end: cancelAtPeriodEnd ? "true" : "false",
  });
  await stripeRequest<StripeSubscription>(`/subscriptions/${selected.id}`, {
    method: "POST",
    body: body.toString(),
  });

  return getStripeSubscriptionSnapshot(email);
}
