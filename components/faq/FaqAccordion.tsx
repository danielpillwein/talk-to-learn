"use client";

import { useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

type FaqEntry = {
  question: string;
  answer: string;
};

type FaqAccordionProps = {
  title?: string;
  items?: FaqEntry[];
};

const DEFAULT_ITEMS: FaqEntry[] = [
  {
    question: "Wie funktioniert Talk to Learn?",
    answer:
      "Du lädst Unterlagen hoch, erhältst automatisch generierte Fragen und beantwortest sie mündlich. Die KI analysiert deine Erklärung und gibt dir direkt strukturiertes Feedback.",
  },
  {
    question: "Welche Inhalte kann ich hochladen?",
    answer:
      "Du kannst Lernunterlagen wie PDF-Dateien, Skripte und Notizen hochladen. Daraus erstellt die Plattform passende Fragen für deine Lernsessions.",
  },
  {
    question: "Wie bewertet die KI meine Antworten?",
    answer:
      "Die KI prüft Korrektheit, Vollständigkeit und Verständlichkeit deiner Erklärung. Danach bekommst du klare Hinweise und eine Referenzantwort zum Vergleichen.",
  },
  {
    question: "Welche Lernstufen gibt es beim Üben?",
    answer:
      "Je nach Lernfortschritt arbeitest du in unterschiedlichen Stufen, z. B. Einstieg, geführtes Erklären und freies Erklären. So wirst du schrittweise sicherer im aktiven Abruf.",
  },
  {
    question: "Welche Features helfen mir beim Lernen am meisten?",
    answer:
      "Besonders hilfreich sind automatische Fragengenerierung, Audio-Erklärungen, KI-Feedback, Musterantworten und die Fortschrittsansicht. Damit erkennst du schnell, was schon sitzt und was du wiederholen solltest.",
  },
  {
    question: "Für wen ist Talk to Learn gedacht?",
    answer:
      "Die Plattform ist vor allem für Studierende gedacht, die Inhalte nicht nur lesen, sondern aktiv erklären und dadurch nachhaltig verstehen wollen.",
  },
];

type FaqItemProps = {
  item: FaqEntry;
  index: number;
  isOpen: boolean;
  onToggle: (index: number) => void;
};

function FaqItem({ item, index, isOpen, onToggle }: FaqItemProps): JSX.Element {
  const triggerId = `faq-trigger-${index}`;
  const panelId = `faq-panel-${index}`;

  return (
    <article className="rounded-2xl border border-border bg-card shadow-sm">
      <h3>
        <button
          type="button"
          id={triggerId}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => onToggle(index)}
          className="flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left text-base font-semibold text-foreground transition-colors hover:bg-accent/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span>{item.question}</span>
          <ChevronDownIcon
            className={cn(
              "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300 ease-out",
              isOpen && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>
      </h3>

      <div
        className={cn(
          "grid overflow-hidden px-5 transition-[grid-template-rows,opacity,padding] duration-300 ease-out",
          isOpen ? "grid-rows-[1fr] pb-4 opacity-100" : "grid-rows-[0fr] pb-0 opacity-70"
        )}
      >
        <div
          id={panelId}
          role="region"
          aria-labelledby={triggerId}
          aria-hidden={!isOpen}
          className="overflow-hidden"
        >
          <p className="text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
        </div>
      </div>
    </article>
  );
}

export function FaqAccordion({ title = "FAQ", items = DEFAULT_ITEMS }: FaqAccordionProps): JSX.Element {
  const [activeIndex, setActiveIndex] = useState<number | null>(0);

  const handleToggle = (index: number) => {
    setActiveIndex((current) => (current === index ? null : index));
  };

  return (
    <section aria-labelledby="faq-section-title" className="w-full space-y-4">
      <h2 id="faq-section-title" className="text-3xl font-semibold text-foreground">
        {title}
      </h2>

      <div className="space-y-3">
        {items.map((item, index) => (
          <FaqItem
            key={item.question}
            item={item}
            index={index}
            isOpen={activeIndex === index}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </section>
  );
}
