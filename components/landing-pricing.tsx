"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

type PlanTier = "free" | "premium" | "ultimate";
type BillingCycle = "monthly" | "yearly";

type PlanCard = {
  tier: PlanTier;
  title: string;
  monthlyPrice: number;
  yearlyPrice?: number;
  highlighted?: boolean;
  badge?: string;
  features: string[];
  note?: string;
};

type LandingPricingProps = {
  yearlyDiscountBadge: string;
  yearlySavingsLabel: string;
  cards: PlanCard[];
};

function formatEuroPrice(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function LandingPricing({ yearlyDiscountBadge, yearlySavingsLabel, cards }: LandingPricingProps): JSX.Element {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  return (
    <>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Abrechnung</p>
        <div className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-card)] p-1">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={cn(
              "inline-flex items-center rounded-full px-4 py-1.5 text-[14px] font-medium transition-all duration-200 ease-out",
              billingCycle === "monthly"
                ? "bg-muted text-foreground"
                : "text-muted-foreground opacity-70 hover:text-foreground hover:opacity-100"
            )}
          >
            Monatlich
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("yearly")}
            className={cn(
              "inline-flex items-center rounded-full px-4 py-1.5 text-[14px] font-medium transition-all duration-200 ease-out",
              billingCycle === "yearly"
                ? "bg-muted text-foreground"
                : "text-muted-foreground opacity-70 hover:text-foreground hover:opacity-100"
            )}
          >
            <span>Jährlich</span>
            <span className="ml-[6px] rounded-[6px] bg-[var(--color-accent)] px-[6px] py-[2px] text-[11px] leading-none text-black">
              {yearlyDiscountBadge}
            </span>
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {cards.map((card) => {
          const annualPrice =
            billingCycle === "yearly"
              ? card.yearlyPrice ?? card.monthlyPrice * 12 * 0.8
              : card.monthlyPrice * 12;
          const effectiveMonthlyPrice = billingCycle === "yearly" ? annualPrice / 12 : card.monthlyPrice;

          return (
            <article
              key={card.tier}
              className={cn(
                "relative flex h-full flex-col rounded-xl border bg-[var(--color-card)] p-5",
                card.highlighted ? "border-2 border-[var(--color-accent)]" : "border-[var(--color-border)]"
              )}
              style={card.highlighted ? { boxShadow: "0 0 20px rgba(var(--color-accent-rgb), 0.25)" } : undefined}
            >
              {card.badge && (
                <p className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-md bg-[var(--color-accent)] px-2 py-1 text-[12px] font-semibold text-black">
                  {card.badge}
                </p>
              )}
              <p className="text-sm font-semibold text-foreground">{card.title}</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{formatEuroPrice(effectiveMonthlyPrice)} € / Monat</p>
              {billingCycle === "yearly" && card.tier !== "free" && (
                <p className="mt-1 text-xs text-muted-foreground/80">
                  {formatEuroPrice(annualPrice)} € / Jahr · {yearlySavingsLabel}
                </p>
              )}

              <ul className="mt-4 space-y-2 text-sm">
                {card.features.map((feature) => (
                  <li key={feature} className="text-muted-foreground">
                    {feature}
                  </li>
                ))}
              </ul>
              {card.note && <p className="mt-1.5 text-xs text-muted-foreground/70">{card.note}</p>}

              <div className="mt-auto pt-5">
                <Link
                  href="/auth/sign-in"
                  className={cn(
                    "inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition",
                    card.tier === "free"
                      ? "border border-border text-foreground hover:border-foreground/30"
                      : "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                  )}
                >
                  {card.tier === "free" ? "Kostenlos starten" : "Plan wählen"}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
