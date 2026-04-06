"use client";

import {
  ArrowRightIcon,
  DocumentTextIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { SparklesIcon as SparklesIconSolid } from "@heroicons/react/24/solid";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type CardBaseProps = {
  title: string;
  description: string;
  size: "large" | "medium";
  className?: string;
  visualClassName?: string;
  children: ReactNode;
};

type RevealItemProps = {
  isVisible: boolean;
  delayMs: number;
  className?: string;
  children: ReactNode;
};

type FeaturesSectionProps = {
  className?: string;
};

type ScoreGaugeProps = {
  score: number;
  max: number;
};

function CornerArrowTopRight({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M7 3v9a3 3 0 0 0 3 3h11" />
      <path d="m17 11 4 4-4 4" />
    </svg>
  );
}

function ScoreGauge({ score, max }: ScoreGaugeProps): JSX.Element {
  const safeMax = Math.max(1, max);
  const clampedScore = Math.min(Math.max(score, 0), safeMax);
  const percent = (clampedScore / safeMax) * 100;

  return (
    <div className="relative">
      <svg viewBox="0 0 120 72" className="mx-auto h-20 w-full" aria-hidden="true">
        <path
          d="M12 60 A48 48 0 0 1 108 60"
          fill="none"
          className="stroke-muted"
          strokeWidth="12"
          strokeLinecap="round"
          pathLength={100}
        />
        <path
          d="M12 60 A48 48 0 0 1 108 60"
          fill="none"
          className="stroke-primary"
          strokeWidth="12"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${percent} 100`}
        />
      </svg>
      <p className="pointer-events-none absolute inset-x-0 bottom-[10px] text-center text-lg font-semibold text-foreground">
        {clampedScore}/{safeMax}
      </p>
    </div>
  );
}

function RevealItem({ isVisible, delayMs, className, children }: RevealItemProps): JSX.Element {
  return (
    <div
      className={cn(
        "h-full transition-all duration-700",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        className
      )}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}

function CardBase({
  title,
  description,
  size,
  className,
  visualClassName,
  children,
}: CardBaseProps): JSX.Element {
  return (
    <article
      tabIndex={0}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm",
        "transition-all duration-300",
        "hover:-translate-y-1 hover:border-ring hover:bg-background/80 hover:shadow-md",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        size === "large" ? "min-h-[320px] p-6" : "min-h-[260px] p-5",
        className
      )}
    >
      <div className="shrink-0 space-y-2">
        <h3 className="text-xl font-semibold text-foreground">{title}</h3>
        <p className="max-w-[46ch] text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div
        className={cn(
          "mt-4 flex min-h-0 flex-1 rounded-2xl border border-border/60 p-4",
          size === "large" ? "min-h-[190px]" : "min-h-[150px]",
          visualClassName ?? "bg-background/70"
        )}
      >
        {children}
      </div>
    </article>
  );
}

type FeatureCardProps = Omit<CardBaseProps, "size">;

function FeatureCardLarge(props: FeatureCardProps): JSX.Element {
  return <CardBase size="large" {...props} />;
}

function FeatureCardMedium(props: FeatureCardProps): JSX.Element {
  return <CardBase size="medium" {...props} />;
}

function FeatureCardUpload(): JSX.Element {
  return (
    <FeatureCardLarge
      title="Lernsets aus deinen Unterlagen"
      description="Lade PDFs oder Skripte hoch. Die KI erstellt automatisch prüfungsrelevante Fragen."
      visualClassName="border-0 bg-muted/65"
    >
      <div className="grid h-full w-full grid-cols-[minmax(0,0.85fr)_auto_minmax(0,1.15fr)] items-center gap-3">
        <div className="flex flex-col justify-center gap-2 rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
            <DocumentTextIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            Skript
          </div>
        </div>
        <ArrowRightIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <div className="grid w-full gap-2">
          {["Frage 1", "Frage 2", "Frage 3", "..."].map((label) => (
            <div
              key={label}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm text-foreground transition duration-300 group-hover:translate-x-0.5",
                label === "..."
                  ? "border-0 bg-transparent -mt-1 py-0 text-center tracking-wide text-muted-foreground"
                  : "border border-border/60 bg-card/75"
              )}
            >
              {label === "..." ? (
                <span className="inline-flex flex-col items-center leading-[0.5]">
                  <span className="text-[11px]">.</span>
                  <span className="text-[11px]">.</span>
                  <span className="text-[11px]">.</span>
                </span>
              ) : (
                label
              )}
            </div>
          ))}
        </div>
      </div>
    </FeatureCardLarge>
  );
}

function FeatureCardAudio(): JSX.Element {
  const timerStart = 37;
  const timerEnd = 59;
  const [seconds, setSeconds] = useState(timerStart);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setSeconds((prev) => (prev >= timerEnd ? timerStart : prev + 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const timerLabel = `00:${String(seconds).padStart(2, "0")}`;

  return (
    <FeatureCardLarge
      title="Erkläre Antworten laut"
      description="Sprich deine Antwort aus. Die KI erkennt sofort, was in deiner Erklärung fehlt."
      visualClassName="bg-background"
    >
      <div className="flex h-full w-full flex-col justify-center gap-2">
        <div className="rounded-xl bg-background px-1.5 pb-2 pt-0.5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Frage</p>
          <p className="mt-1 text-base font-medium leading-snug text-foreground">
            Erkläre den Unterschied zwischen Mitose und Meiose.
          </p>
        </div>

        <div className="rounded-xl bg-destructive p-3 shadow-sm">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 animate-pulse rounded-[2px] bg-white"
                aria-hidden="true"
              />
              <span className="font-semibold text-destructive-foreground">Stop</span>
            </div>
            <span className="font-medium text-destructive-foreground">{timerLabel}</span>
          </div>
        </div>

      </div>
    </FeatureCardLarge>
  );
}

function FeatureCardModel(): JSX.Element {
  return (
    <FeatureCardMedium
      title="Lernen in drei Leveln"
      description="Vom Verstehen zum freien Erklären."
      visualClassName="border-0 bg-muted/45"
    >
      <div className="flex h-full w-full items-center">
        <div className="w-full space-y-2">
          <div className="w-1/3 rounded-xl border border-primary/40 bg-primary px-4 py-2 text-center shadow-sm">
            <p className="text-sm font-semibold text-primary-foreground">Einführung</p>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative ml-0 w-1/3">
              <CornerArrowTopRight className="pointer-events-none absolute -left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <div className="w-full rounded-xl border border-border/60 bg-background/85 px-4 py-2 text-center text-sm text-muted-foreground shadow-sm">
                Üben
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <div className="relative w-1/3">
              <CornerArrowTopRight className="pointer-events-none absolute -left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <div className="w-full rounded-xl border border-border/60 bg-background/75 px-4 py-2 text-center text-sm text-muted-foreground shadow-sm">
                Erklären
              </div>
            </div>
          </div>
        </div>
      </div>
    </FeatureCardMedium>
  );
}

function FeatureCardFeedback(): JSX.Element {
  const score = 7;
  const maxScore = 10;

  return (
    <FeatureCardMedium
      title="Präzises KI Feedback"
      description="Erkenne sofort, wo dein Verständnis noch Lücken hat."
      className="min-h-0"
      visualClassName="min-h-0 bg-accent/35"
    >
      <div className="grid w-full grid-cols-[132px_minmax(0,1fr)] items-stretch gap-3">
        <div className="flex h-full items-center rounded-lg bg-card/80 px-3 py-2">
          <ScoreGauge score={score} max={maxScore} />
        </div>

        <div className="flex h-full flex-col justify-center border-l border-border/70 py-1 pl-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
            <SparklesIconSolid className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Feedback
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">
            Definition korrekt, aber ein praxisnahes Beispiel fehlt.
          </p>
        </div>
      </div>
    </FeatureCardMedium>
  );
}

function BentoGrid({ isVisible }: { isVisible: boolean }): JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12">
      <RevealItem isVisible={isVisible} delayMs={0} className="lg:col-span-7">
        <FeatureCardUpload />
      </RevealItem>
      <RevealItem isVisible={isVisible} delayMs={90} className="lg:col-span-5">
        <FeatureCardAudio />
      </RevealItem>
      <RevealItem isVisible={isVisible} delayMs={180} className="md:col-span-1 lg:col-span-6">
        <FeatureCardModel />
      </RevealItem>
      <RevealItem isVisible={isVisible} delayMs={260} className="self-start md:col-span-1 lg:col-span-6">
        <FeatureCardFeedback />
      </RevealItem>
    </div>
  );
}

export function FeaturesSection({ className }: FeaturesSectionProps): JSX.Element {
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
      { threshold: 0.2 }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <section id="features" className={cn("space-y-8", className)} ref={sectionRef}>
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Key Features</p>
        <h2 className="text-3xl font-semibold text-foreground">Besser lernen für Prüfungen.</h2>
      </header>
      <BentoGrid isVisible={isVisible} />
    </section>
  );
}

export { FeaturesSection as FeaturesBento };
