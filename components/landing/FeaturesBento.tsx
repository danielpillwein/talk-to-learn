import {
  ChartBarSquareIcon,
  DocumentTextIcon,
  MicrophoneIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type CardBaseProps = {
  title: string;
  description: string;
  className?: string;
  children: ReactNode;
};

function CardBase({ title, description, className, children }: CardBaseProps): JSX.Element {
  return (
    <article
      tabIndex={0}
      className={cn(
        "group relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className
      )}
    >
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="max-w-[44ch] text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="mt-5">{children}</div>
    </article>
  );
}

function FeatureCardLargeSets(): JSX.Element {
  return (
    <CardBase
      title="Lernsets aus deinen Unterlagen"
      description="Lade PDFs, Skripte oder Notizen hoch. Die KI erstellt automatisch prüfungsrelevante Fragen."
      className="lg:col-span-6 lg:row-span-2"
    >
      <div className="rounded-2xl border border-border bg-background/70 p-4">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-accent/30">
            <DocumentTextIcon className="h-5 w-5 text-foreground" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Unterlagen hochgeladen</p>
            <p className="text-xs text-muted-foreground">PDF, Skript, Notizen</p>
          </div>
        </div>

        <div className="my-3 flex justify-center">
          <div className="h-8 w-px bg-border" />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {["Frage 1", "Frage 2", "Frage 3", "Frage 4"].map((label) => (
            <div
              key={label}
              className="rounded-xl border border-border/90 bg-card px-3 py-2 text-sm text-foreground transition duration-300 group-hover:-translate-y-0.5"
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </CardBase>
  );
}

function FeatureCardLargeAudio(): JSX.Element {
  return (
    <CardBase
      title="Erkläre Antworten laut"
      description="Sprich deine Antwort aus. Die KI analysiert deine Erklärung und zeigt dir sofort, was fehlt."
      className="lg:col-span-6 lg:row-span-2"
    >
      <div className="space-y-3 rounded-2xl border border-border bg-background/70 p-4">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Frage</p>
          <p className="mt-1 text-sm text-foreground">Erkläre den Unterschied zwischen Mitose und Meiose.</p>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" aria-hidden="true" />
            <span className="text-sm text-foreground">Aufnahme läuft</span>
          </div>
          <MicrophoneIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </div>

        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">Score: 7/10</span>
            <span className="text-muted-foreground">KI Feedback</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Definition korrekt, Beispiel fehlt.</p>
        </div>
      </div>
    </CardBase>
  );
}

function FeatureCardMediumModel(): JSX.Element {
  const phases = [
    { label: "Einführung", active: true },
    { label: "Üben", active: false },
    { label: "Erklären", active: false },
  ];

  return (
    <CardBase
      title="Mehrstufiges Lernmodell"
      description="Vom Verstehen zum freien Erklären. Die Plattform steigert automatisch den Schwierigkeitsgrad."
      className="md:col-span-6 lg:col-span-4"
    >
      <div className="rounded-2xl border border-border bg-background/70 p-4">
        <ul className="space-y-3" aria-label="Lernphasen">
          {phases.map((phase, index) => (
            <li key={phase.label} className="flex items-center gap-3">
              <span
                className={cn(
                  "inline-block h-3 w-3 rounded-full border border-border",
                  phase.active ? "bg-primary" : "bg-card"
                )}
                aria-hidden="true"
              />
              <span className={cn("text-sm", phase.active ? "text-foreground" : "text-muted-foreground")}>
                {phase.label}
              </span>
              {index === 0 && <span className="ml-auto text-xs text-muted-foreground">aktuell</span>}
            </li>
          ))}
        </ul>
      </div>
    </CardBase>
  );
}

function FeatureCardSmallFeedback(): JSX.Element {
  return (
    <CardBase
      title="KI Feedback"
      description="Erhalte klare Hinweise, was in deiner Erklärung fehlt."
      className="md:col-span-6 lg:col-span-5"
    >
      <div className="rounded-2xl border border-border bg-background/70 p-4">
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
          <SparklesIcon className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Begriff sauber erklärt, aber ein praxisnahes Beispiel fehlt.</p>
        </div>
      </div>
    </CardBase>
  );
}

function FeatureCardSmallProgress(): JSX.Element {
  return (
    <CardBase
      title="Fortschritt verfolgen"
      description="Sieh, was du bereits sicher kannst."
      className="md:col-span-6 lg:col-span-3"
    >
      <div className="space-y-3 rounded-2xl border border-border bg-background/70 p-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Sichere Antworten</span>
            <span>72%</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-2 w-[72%] rounded-full bg-primary transition-all duration-300 group-hover:w-[76%]" />
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-foreground">
          <ChartBarSquareIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Lernstreak: 8 Tage
        </div>
      </div>
    </CardBase>
  );
}

function BentoGrid(): JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12">
      <FeatureCardLargeSets />
      <FeatureCardLargeAudio />
      <FeatureCardMediumModel />
      <FeatureCardSmallFeedback />
      <FeatureCardSmallProgress />
    </div>
  );
}

export function FeaturesBento(): JSX.Element {
  return (
    <section id="produkt" className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Key Features</p>
        <h2 className="text-3xl font-semibold text-foreground">Lerne schneller, indem du Inhalte erklärst statt nur zu lesen.</h2>
      </header>
      <BentoGrid />
    </section>
  );
}
