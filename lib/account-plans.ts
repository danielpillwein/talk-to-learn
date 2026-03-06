import { billing, type Plan, type LimitedValue as BillingLimitedValue } from "@/src/config/billing";

export type PlanTier = Plan;
export type LimitedValue = BillingLimitedValue;
export type SubscriptionStatus = "active" | "cancel_at_period_end" | "past_due";

export type PlanLimits = {
  questionsPerDeck: LimitedValue;
  speechSecondsPerDay: LimitedValue;
  deckLimit: LimitedValue;
  aiRefine: boolean;
};

export const PLAN_LABELS: Record<PlanTier, string> = billing.planLabels;

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    questionsPerDeck: billing.plans.free.maxQuestionsPerDeck,
    speechSecondsPerDay: billing.plans.free.dailyExplanationSeconds,
    deckLimit: billing.plans.free.maxDecks,
    aiRefine: billing.capabilities.free.aiQuestionRefine,
  },
  premium: {
    questionsPerDeck: billing.plans.premium.maxQuestionsPerDeck,
    speechSecondsPerDay: billing.plans.premium.dailyExplanationSeconds,
    deckLimit: billing.plans.premium.maxDecks,
    aiRefine: billing.capabilities.premium.aiQuestionRefine,
  },
  ultimate: {
    questionsPerDeck: billing.plans.ultimate.maxQuestionsPerDeck,
    speechSecondsPerDay: billing.plans.ultimate.dailyExplanationSeconds,
    deckLimit: billing.plans.ultimate.maxDecks,
    aiRefine: billing.capabilities.ultimate.aiQuestionRefine,
  },
};

export function normalizePlan(rawPlan: string | null | undefined): PlanTier {
  const value = String(rawPlan ?? "").trim().toLowerCase();
  if (value === "ultimate") return "ultimate";
  if (value === "premium" || value === "pro") return "premium";
  return "free";
}

export function formatLimitedValue(value: LimitedValue): string {
  if (value === "unlimited") return "∞";
  return String(value);
}

export function getUsageProgressPercent(used: number, cap: LimitedValue): number {
  if (cap === "unlimited") return 0;
  if (cap <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((used / cap) * 100)));
}
