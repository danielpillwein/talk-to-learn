import { billing, type Plan, type LimitedValue as BillingLimitedValue } from "@/src/config/billing";
import { db } from "@/lib/db";

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

const MIN_QUESTIONS_PER_DECK = 2;

function numericPositiveLimit(value: LimitedValue | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  return fallback;
}

export async function resolvePlanForUserId(userId: string | null | undefined): Promise<PlanTier> {
  if (!userId) return "free";
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });
    return normalizePlan(user?.plan);
  } catch {
    return "free";
  }
}

export function resolveQuestionCountLimitForPlan(plan: PlanTier): number {
  // Mirror frontend behavior from create flow:
  // - slider max is based on premium question limit
  // - free users are capped at free plan limit
  const freePlanLimitRaw = numericPositiveLimit(PLAN_LIMITS.free.questionsPerDeck, MIN_QUESTIONS_PER_DECK);
  const premiumPlanLimitRaw = numericPositiveLimit(PLAN_LIMITS.premium.questionsPerDeck, freePlanLimitRaw);
  const maxQuestionCount = Math.max(MIN_QUESTIONS_PER_DECK, premiumPlanLimitRaw);
  const freePlanLimit = Math.min(Math.max(MIN_QUESTIONS_PER_DECK, freePlanLimitRaw), maxQuestionCount);

  if (plan === "free") return freePlanLimit;
  return maxQuestionCount;
}

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
