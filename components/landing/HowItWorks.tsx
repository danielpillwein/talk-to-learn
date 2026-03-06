"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type FlowStep = {
  step: number;
  title: string;
  description: string;
  visual: JSX.Element;
};

const STEPS: FlowStep[] = [
  {
    step: 1,
    title: "Unterlagen hochladen",
    description:
      "Lade PDFs oder Skripte hoch. Die KI erstellt automatisch prüfungsrelevante Fragen.",
    visual: (
      <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="rounded-2xl border border-border bg-background p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Dokument
          </p>
          <p className="mt-2 text-sm font-medium text-foreground">skript.pdf</p>
        </div>
        <div className="text-muted-foreground" aria-hidden>
          →
        </div>
        <div className="space-y-2">
          <div className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground">
            Frage 1
          </div>
          <div className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground">
            Frage 2
          </div>
          <div className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground">
            Frage 3
          </div>
        </div>
      </div>
    ),
  },
  {
    step: 2,
    title: "Antwort laut erklären",
    description: "Erkläre die Antwort laut – wie in der Prüfung.",
    visual: (
      <div className="flex flex-1 flex-col justify-center rounded-2xl border border-border bg-background p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Aufnahme</span>
          <span>00:37</span>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            ●
          </span>
          <div className="flex-1 space-y-1">
            <div className="h-1.5 w-full rounded-full bg-border" />
            <div className="h-1.5 w-3/4 rounded-full bg-border" />
            <div className="h-1.5 w-2/3 rounded-full bg-border" />
          </div>
        </div>
      </div>
    ),
  },
  {
    step: 3,
    title: "Sofort Feedback erhalten",
    description: "Die KI zeigt dir direkt, was stimmt und was fehlt.",
    visual: (
      <div className="flex min-w-0 flex-1 flex-col rounded-2xl border border-border bg-background p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Score</p>
          <p className="text-lg font-semibold text-foreground">7/10</p>
        </div>
        <div className="mt-4 min-w-0 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Erklärung</p>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            Gute Antwort, aber ein konkretes Beispiel fehlt noch...
          </p>
        </div>
      </div>
    ),
  },
];

function StepCard({ step, title, description, visual }: FlowStep): JSX.Element {
  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-3xl border border-border bg-card p-5 shadow-sm transition duration-300",
        "hover:-translate-y-1 hover:shadow-md"
      )}
    >
      <div className="flex min-w-0 flex-col">
        <div className="flex min-w-0 items-center gap-3">
          <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-sm font-semibold text-foreground">
            {step}
          </div>
          <h3 className="truncate text-base font-semibold leading-tight text-foreground">{title}</h3>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="mt-4 flex flex-1">{visual}</div>
    </article>
  );
}

function FlowConnector({ mobile }: { mobile?: boolean }): JSX.Element {
  return (
    <div
      className={cn(
        "items-center justify-center text-muted-foreground",
        mobile ? "flex md:hidden" : "hidden md:flex"
      )}
      aria-hidden
    >
      {mobile ? (
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-sm">
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className="h-4 w-4 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 4v12" />
            <path d="m6 12 4 4 4-4" />
          </svg>
        </span>
      ) : (
        <div className="flex items-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-sm">
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className="h-4 w-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 10h12" />
              <path d="m12 6 4 4-4 4" />
            </svg>
          </span>
        </div>
      )}
    </div>
  );
}

export function HowItWorks(): JSX.Element {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      { threshold: 0.25 }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="space-y-8" aria-labelledby="how-it-works-title">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">SO FUNKTIONIERT&apos;S</p>
        <h2 id="how-it-works-title" className="text-3xl font-semibold text-foreground">
          Vom Skript zur sicheren Antwort
        </h2>
      </div>

      <div className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)_56px_minmax(0,1fr)] md:items-stretch">
        <div
          className={cn(
            "h-full transition-all duration-700",
            isVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          )}
        >
          <StepCard {...STEPS[0]} />
        </div>
        <FlowConnector />
        <FlowConnector mobile />
        <div
          className={cn(
            "h-full transition-all duration-700 delay-100",
            isVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          )}
        >
          <StepCard {...STEPS[1]} />
        </div>
        <FlowConnector />
        <FlowConnector mobile />
        <div
          className={cn(
            "h-full transition-all duration-700 delay-200",
            isVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          )}
        >
          <StepCard {...STEPS[2]} />
        </div>
      </div>
    </section>
  );
}
