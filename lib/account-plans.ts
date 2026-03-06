export type PlanTier = "free" | "premium" | "ultimate";
export type LimitedValue = number | "unlimited";
export type SubscriptionStatus = "active" | "cancel_at_period_end" | "past_due";

export type PlanLimits = {
  questionsPerDeck: LimitedValue;
  speechSecondsPerDay: LimitedValue;
  deckLimit: LimitedValue;
  aiRefine: boolean;
};

export const PLAN_LABELS: Record<PlanTier, string> = {
  free: "Kostenlos",
  premium: "Premium",
  ultimate: "Ultimate",
};

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    questionsPerDeck: 10,
    speechSecondsPerDay: 300,
    deckLimit: 3,
    aiRefine: false,
  },
  premium: {
    questionsPerDeck: 25,
    speechSecondsPerDay: 1800,
    deckLimit: "unlimited",
    aiRefine: true,
  },
  ultimate: {
    questionsPerDeck: 50,
    speechSecondsPerDay: "unlimited",
    deckLimit: "unlimited",
    aiRefine: true,
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
