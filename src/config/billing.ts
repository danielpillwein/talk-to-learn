import "server-only";

export type Plan = "free" | "premium" | "ultimate";
export type PaidPlan = Exclude<Plan, "free">;
export type BillingCycle = "monthly" | "yearly";
export type LimitedValue = number | "unlimited";
export type StripePlanCycle = { plan: PaidPlan; cycle: BillingCycle };

type PlanLimits = {
  maxDecks: LimitedValue;
  maxQuestionsPerDeck: LimitedValue;
  dailyExplanationSeconds: LimitedValue;
};

type PlanCapabilities = {
  aiFeedback: boolean;
  aiQuestionRefine: boolean;
  priorityAiProcessing: boolean;
};

type PlanCard = {
  tier: Plan;
  title: string;
  monthlyPrice: number;
  yearlyPrice?: number;
  highlighted?: boolean;
  badge?: string;
  features: string[];
  note?: string;
};

function readNumberEnv(key: string): number {
  const raw = String(process.env[key] ?? "").trim();
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readStringEnv(key: string): string {
  return String(process.env[key] ?? "").trim();
}

function normalizeLimit(value: number): LimitedValue {
  return value === -1 ? "unlimited" : value;
}

function minutesToSeconds(minutes: number): number {
  if (minutes === -1) return -1;
  return Math.max(0, minutes) * 60;
}

function formatDeckFeature(limit: LimitedValue): string {
  if (limit === "unlimited") return "Unlimitierte Lernsets";
  return `${limit} Lernsets insgesamt`;
}

function formatQuestionsFeature(limit: LimitedValue): string {
  if (limit === "unlimited") return "Unlimitierte Fragen";
  return `max. ${limit} Fragen pro Lernset`;
}

function formatExplanationFeature(limit: LimitedValue): string {
  if (limit === "unlimited") return "Unlimitierte Erklärungszeit*";
  if (limit % 60 === 0 && limit >= 60) {
    return `${limit / 60} Minuten Erklärungszeit pro Tag`;
  }
  return `${limit} Sekunden Erklärungszeit pro Tag`;
}

export const billing = {
  planOrder: {
    free: 0,
    premium: 1,
    ultimate: 2,
  } as const satisfies Record<Plan, number>,

  planLabels: {
    free: "Kostenlos",
    premium: "Premium",
    ultimate: "Ultimate",
  } as const satisfies Record<Plan, string>,

  pricing: {
    premium: {
      monthly: readNumberEnv("BILLING_PREMIUM_PRICE_MONTHLY"),
      yearly: readNumberEnv("BILLING_PREMIUM_PRICE_YEARLY"),
    },
    ultimate: {
      monthly: readNumberEnv("BILLING_ULTIMATE_PRICE_MONTHLY"),
      yearly: readNumberEnv("BILLING_ULTIMATE_PRICE_YEARLY"),
    },
  } as const,

  stripe: {
    premium: {
      monthly: readStringEnv("STRIPE_PRICE_PREMIUM_MONTHLY"),
      yearly: readStringEnv("STRIPE_PRICE_PREMIUM_YEARLY"),
    },
    ultimate: {
      monthly: readStringEnv("STRIPE_PRICE_ULTIMATE_MONTHLY"),
      yearly: readStringEnv("STRIPE_PRICE_ULTIMATE_YEARLY"),
    },
  } as const satisfies Record<PaidPlan, Record<BillingCycle, string>>,

  plans: {
    free: {
      maxDecks: normalizeLimit(readNumberEnv("PLAN_FREE_MAX_DECKS")),
      maxQuestionsPerDeck: normalizeLimit(readNumberEnv("PLAN_FREE_MAX_QUESTIONS_PER_DECK")),
      dailyExplanationSeconds: normalizeLimit(readNumberEnv("PLAN_FREE_DAILY_EXPLANATION_SECONDS")),
    },
    premium: {
      maxDecks: normalizeLimit(readNumberEnv("PLAN_PREMIUM_MAX_DECKS")),
      maxQuestionsPerDeck: normalizeLimit(readNumberEnv("PLAN_PREMIUM_MAX_QUESTIONS_PER_DECK")),
      dailyExplanationSeconds: normalizeLimit(
        minutesToSeconds(readNumberEnv("PLAN_PREMIUM_DAILY_EXPLANATION_MINUTES"))
      ),
    },
    ultimate: {
      maxDecks: normalizeLimit(readNumberEnv("PLAN_ULTIMATE_MAX_DECKS")),
      maxQuestionsPerDeck: normalizeLimit(readNumberEnv("PLAN_ULTIMATE_MAX_QUESTIONS_PER_DECK")),
      dailyExplanationSeconds: normalizeLimit(
        minutesToSeconds(readNumberEnv("PLAN_ULTIMATE_DAILY_EXPLANATION_MINUTES"))
      ),
    },
  } as const satisfies Record<Plan, PlanLimits>,

  capabilities: {
    free: {
      aiFeedback: true,
      aiQuestionRefine: false,
      priorityAiProcessing: false,
    },
    premium: {
      aiFeedback: true,
      aiQuestionRefine: true,
      priorityAiProcessing: false,
    },
    ultimate: {
      aiFeedback: true,
      aiQuestionRefine: true,
      priorityAiProcessing: true,
    },
  } as const satisfies Record<Plan, PlanCapabilities>,

  text: {
    usage: {
      deckTitle: "Lernsets erstellt",
      deckTooltip: "Maximale Anzahl an Lernsets in deinem Account.",
      questionTitle: "Fragen pro Lernset",
      questionTooltip: "Maximale Anzahl an Fragen innerhalb eines Lernsets.",
      speechTitle: "Erklärungszeit (Audio)",
      speechTooltip:
        "Zeit für mündliche Antworten auf Fragen. Deine Antwort wird transkribiert und von der AI bewertet.",
      speechResetPrefix: "Zurückgesetzt in",
    },

    pricing: {
      sectionTitle: "Abo",
      badgeMostPopular: "Beliebtester Plan",
      fairUseNote: "*Fair Use Policy: sehr hohe Nutzung möglich.",
      yearlyDiscountBadge: "-20%",
      yearlySavingsLabel: "20% Rabatt",
      cancelAnytime: "Jederzeit kündbar.",
      activePlanCta: "Aktueller Plan",
      upgradeCta: "Upgrade",
      includedCta: "Inklusive",
    },

    upgradeRequired: {
      decks: "Du hast das Deck-Limit deines aktuellen Plans erreicht.",
      questions: "Du hast das Fragenlimit deines Plans erreicht.",
      explanationTime: "Du hast deine tägliche Erklärungszeit verbraucht.",
    },

    upgradeCallToAction: {
      premium: "Upgrade auf Premium für mehr Lernsets und Fragen.",
      ultimate: "Upgrade auf Ultimate für höhere Limits und Priorität.",
    },

    subscription: {
      cancelled: "Dein Abo wurde gekündigt und läuft bis zum Ende des Abrechnungszeitraums.",
      resumed: "Kündigung wurde rückgängig gemacht.",
      upgraded: "Upgrade erfolgreich.",
      downgraded: "Plan wurde geändert.",
    },
  } as const,
};

export function getPlanFeatures(plan: Plan): string[] {
  const limits = billing.plans[plan];
  const capabilities = billing.capabilities[plan];
  const features: string[] = [
    formatDeckFeature(limits.maxDecks),
    formatQuestionsFeature(limits.maxQuestionsPerDeck),
    formatExplanationFeature(limits.dailyExplanationSeconds),
  ];

  if (capabilities.aiFeedback) {
    features.push("AI Feedback auf deine Antworten");
  }
  if (capabilities.aiQuestionRefine) {
    features.push("Fragen mit AI verbessern");
  }
  if (capabilities.priorityAiProcessing) {
    features.push("Priority AI Verarbeitung");
  }

  return features;
}

export function getPricingCards(): PlanCard[] {
  return [
    {
      tier: "free",
      title: billing.planLabels.free,
      monthlyPrice: 0,
      features: getPlanFeatures("free"),
    },
    {
      tier: "premium",
      title: billing.planLabels.premium,
      monthlyPrice: billing.pricing.premium.monthly,
      yearlyPrice: billing.pricing.premium.yearly,
      highlighted: true,
      badge: billing.text.pricing.badgeMostPopular,
      features: getPlanFeatures("premium"),
    },
    {
      tier: "ultimate",
      title: billing.planLabels.ultimate,
      monthlyPrice: billing.pricing.ultimate.monthly,
      yearlyPrice: billing.pricing.ultimate.yearly,
      features: getPlanFeatures("ultimate"),
      note: billing.text.pricing.fairUseNote,
    },
  ];
}

export function getStripePriceId(plan: PaidPlan, cycle: BillingCycle): string {
  return billing.stripe[plan][cycle];
}

export function getStripePriceIdSet(plan: PaidPlan): Set<string> {
  const ids = [
    billing.stripe[plan].monthly,
    billing.stripe[plan].yearly,
  ].filter((entry) => entry.length > 0);
  return new Set(ids);
}

export const paidPlanValues: PaidPlan[] = ["premium", "ultimate"];
export const billingCycleValues: BillingCycle[] = ["monthly", "yearly"];

export function isPaidPlan(value: string): value is PaidPlan {
  return paidPlanValues.includes(value as PaidPlan);
}

export function isBillingCycle(value: string): value is BillingCycle {
  return billingCycleValues.includes(value as BillingCycle);
}

export function getStripePlanCycleByPriceId(priceId: string): StripePlanCycle | null {
  const normalized = String(priceId).trim();
  if (!normalized) return null;

  for (const plan of paidPlanValues) {
    for (const cycle of billingCycleValues) {
      if (billing.stripe[plan][cycle] === normalized) {
        return { plan, cycle };
      }
    }
  }

  return null;
}
