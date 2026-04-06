import "server-only";

import type Stripe from "stripe";
import { db } from "@/lib/db";
import { normalizePlan, type PlanTier, type SubscriptionStatus } from "@/lib/account-plans";
import { getStripePlanCycleByPriceId, type BillingCycle } from "@/src/config/billing";

export type StripeBillingInterval = BillingCycle | null;

export type PersistedSubscriptionSnapshot = {
  plan: PlanTier;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  nextBillingAt: string | null;
  billingInterval: StripeBillingInterval;
  subscriptionId: string | null;
  customerId: string | null;
  priceId: string | null;
};

function mapStripeInterval(interval: string | null | undefined): StripeBillingInterval {
  const normalized = String(interval ?? "").trim().toLowerCase();
  if (normalized === "month") return "monthly";
  if (normalized === "year") return "yearly";
  return null;
}

function mapStripeStatus(subscription: Stripe.Subscription): SubscriptionStatus {
  if (subscription.cancel_at_period_end) {
    return "cancel_at_period_end";
  }
  if (
    subscription.status === "past_due" ||
    subscription.status === "unpaid" ||
    subscription.status === "incomplete" ||
    subscription.status === "incomplete_expired" ||
    subscription.status === "paused"
  ) {
    return "past_due";
  }
  return "active";
}

function extractPriceInfo(subscription: Stripe.Subscription): {
  priceId: string | null;
  interval: StripeBillingInterval;
  mappedPlan: PlanTier | null;
  mappedCycle: StripeBillingInterval;
} {
  const firstPrice = subscription.items.data[0]?.price;
  const priceId = typeof firstPrice?.id === "string" ? firstPrice.id : null;
  const mapped = priceId ? getStripePlanCycleByPriceId(priceId) : null;
  const interval = mapStripeInterval(firstPrice?.recurring?.interval);

  return {
    priceId,
    interval,
    mappedPlan: mapped?.plan ?? null,
    mappedCycle: mapped?.cycle ?? null,
  };
}

export function normalizeStoredSubscriptionStatus(rawStatus: string | null | undefined): SubscriptionStatus {
  const value = String(rawStatus ?? "").trim().toLowerCase();
  if (value === "cancel_at_period_end") return "cancel_at_period_end";
  if (value === "past_due") return "past_due";
  return "active";
}

export function buildSubscriptionSnapshot(
  subscription: Stripe.Subscription,
  options?: { fallbackPlan?: PlanTier }
): PersistedSubscriptionSnapshot {
  const { priceId, interval, mappedPlan, mappedCycle } = extractPriceInfo(subscription);
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;
  const currentPeriodEnd =
    typeof subscription.current_period_end === "number" && subscription.current_period_end > 0
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;
  const plan = normalizePlan(mappedPlan ?? options?.fallbackPlan ?? "free");
  const status = mapStripeStatus(subscription);
  const billingInterval = mappedCycle ?? interval;

  return {
    plan,
    status,
    currentPeriodEnd,
    nextBillingAt: plan === "free" ? null : currentPeriodEnd,
    billingInterval,
    subscriptionId: subscription.id ?? null,
    customerId,
    priceId,
  };
}

export async function persistSubscriptionForUser(
  userId: string,
  subscription: Stripe.Subscription,
  options?: { fallbackPlan?: PlanTier }
): Promise<PersistedSubscriptionSnapshot> {
  const snapshot = buildSubscriptionSnapshot(subscription, options);

  await db.user.update({
    where: { id: userId },
    data: {
      plan: snapshot.plan,
      subscriptionId: snapshot.subscriptionId,
      subscriptionStatus: snapshot.status,
      subscriptionCurrentPeriodEnd: snapshot.currentPeriodEnd ? new Date(snapshot.currentPeriodEnd) : null,
      billingCycle: snapshot.billingInterval,
      stripeCustomerId: snapshot.customerId,
      stripePriceId: snapshot.priceId,
    },
  } as any);

  return snapshot;
}

export async function clearSubscriptionForUser(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: {
      plan: "free",
      subscriptionId: null,
      subscriptionStatus: null,
      subscriptionCurrentPeriodEnd: null,
      billingCycle: null,
      stripePriceId: null,
    },
  } as any);
}
