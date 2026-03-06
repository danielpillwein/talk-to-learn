"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type StatId = "users_count" | "decks_created" | "minutes_explained" | "documents_analyzed";

type StatItem = {
  id: StatId;
  label: string;
  suffix?: string;
};

const PLATFORM_STATS: StatItem[] = [
  { id: "users_count", label: "User" },
  { id: "decks_created", label: "Lernsets" },
  { id: "minutes_explained", label: "Minuten erklärt" },
  { id: "documents_analyzed", label: "Dokumente" },
];

function formatStatNumber(value: number): string {
  return new Intl.NumberFormat("de-DE").format(value);
}

type StatCardProps = {
  number: number;
  label: string;
  suffix?: string;
};

function StatCard({ number, label, suffix = "" }: StatCardProps): JSX.Element {
  return (
    <article
      className={cn(
        "rounded-3xl border border-border bg-card p-5 shadow-sm transition duration-300",
        "hover:-translate-y-1 hover:shadow-md"
      )}
    >
      <p className="text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
        {formatStatNumber(number)}
        {suffix}
      </p>
      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
    </article>
  );
}

function StatsGrid({ values }: { values: number[] }): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {PLATFORM_STATS.map((stat, index) => (
        <StatCard key={stat.label} number={values[index] ?? 0} label={stat.label} suffix={stat.suffix} />
      ))}
    </div>
  );
}

export function StatsSection(): JSX.Element {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [targets, setTargets] = useState<number[]>(() => PLATFORM_STATS.map(() => 0));
  const [values, setValues] = useState<number[]>(() => PLATFORM_STATS.map(() => 0));

  useEffect(() => {
    let isCancelled = false;

    const loadStats = async () => {
      try {
        const response = await fetch("/api/public/stats", { cache: "no-store" });
        if (!response.ok) return;

        const payload = (await response.json()) as {
          usersCount?: number;
          minutesExplained?: number;
          decksCreated?: number;
          documentsAnalyzed?: number;
        };
        if (isCancelled) return;

        const normalize = (value: unknown): number => {
          const parsed = Number(value ?? 0);
          if (!Number.isFinite(parsed) || parsed < 0) return 0;
          return Math.round(parsed);
        };

        const nextTargetsById: Record<StatId, number> = {
          users_count: normalize(payload.usersCount),
          decks_created: normalize(payload.decksCreated),
          minutes_explained: normalize(payload.minutesExplained),
          documents_analyzed: normalize(payload.documentsAnalyzed),
        };

        setTargets(PLATFORM_STATS.map((entry) => nextTargetsById[entry.id] ?? 0));
      } catch {
        // Keep zero fallback values when stats endpoint is unavailable.
      }
    };

    void loadStats();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node || hasStarted) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        setHasStarted(true);
        observer.disconnect();
      },
      { threshold: 0.35 }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;

    const durationMs = 1400;
    const startAt = performance.now();
    const startValues = values;
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startAt) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);

      setValues(
        targets.map((target, index) => {
          const from = startValues[index] ?? 0;
          return Math.round(from + (target - from) * eased);
        })
      );

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [hasStarted, targets]);

  return (
    <section ref={sectionRef} className="space-y-8" aria-labelledby="platform-stats-title">
      <header className="space-y-3">
        <h2 id="platform-stats-title" className="text-3xl font-semibold text-foreground">
          Aktives Lernen in Zahlen
        </h2>
        <p className="text-sm text-muted-foreground">So nutzen Studierende Talk to Learn.</p>
      </header>

      <StatsGrid values={values} />
    </section>
  );
}
