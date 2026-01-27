"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Review = {
  rating: number;
  name: string;
  highlight: string;
};

const REVIEWS: Review[] = [
  {
    rating: 4.8,
    name: "Lea M.",
    highlight: "Die Audio-Erklärungen machen die Prüfungssituation endlich realistisch.",
  },
  {
    rating: 4.7,
    name: "Jannis K.",
    highlight: "Meine PDFs werden in Sekunden zu echten Prüfungsfragen.",
  },
  {
    rating: 4.9,
    name: "Sofia R.",
    highlight: "Das direkte Feedback zeigt mir sofort, was noch fehlt.",
  },
];

export function HeroReviewCarousel() {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  const DURATION = 10000;

  useEffect(() => {
    const step = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const next = Math.min(elapsed / DURATION, 1);
      setProgress(next);
      if (next >= 1) {
        setIndex((current) => (current + 1) % REVIEWS.length);
        startRef.current = timestamp;
        setProgress(0);
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      startRef.current = null;
    };
  }, []);

  const order = useMemo(() => {
    return REVIEWS.map((_, idx) => (index + idx) % REVIEWS.length);
  }, [index]);

  const goPrev = () => {
    setIndex((prev) => (prev - 1 + REVIEWS.length) % REVIEWS.length);
    setProgress(0);
    startRef.current = null;
  };

  const goNext = () => {
    setIndex((prev) => (prev + 1) % REVIEWS.length);
    setProgress(0);
    startRef.current = null;
  };

  return (
    <div className="relative flex h-full min-h-[220px] w-full items-start gap-4">
      <div className="relative w-full">
        {order.map((reviewIndex, stackIndex) => {
          const review = REVIEWS[reviewIndex];
          const offsetX = 0;
          const offsetY = stackIndex * 10;
          const baseWidth = 100;
          const width = baseWidth - (stackIndex * (stackIndex + 1) * 2);

          return (
            <div
              key={`${review.name}-${reviewIndex}`}
              className="absolute left-1/2 top-0 rounded-2xl border px-6 py-5 transition-all duration-700 h-[156px]"
              style={{
                transform: `translateX(-50%) translateY(${offsetY}px)`,
                zIndex: REVIEWS.length - stackIndex,
                width: `${width}%`,
                backgroundColor: "var(--background)",
                borderColor: "color-mix(in srgb, var(--foreground) 15%, transparent)",
                boxShadow:
                  stackIndex === 0
                    ? "0 14px 30px rgba(0,0,0,0.16)"
                    : "0 10px 22px rgba(0,0,0,0.12)",
              }}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span className="text-primary">★★★★★</span>
                <span className="text-muted-foreground">{review.rating.toFixed(1)}</span>
              </div>
              <p className="mt-2 text-sm text-foreground/90">{review.highlight}</p>
              <p className="mt-3 text-xs text-muted-foreground">{review.name}</p>
            </div>
            );
          })}
        </div>
      <div className="flex flex-col items-center gap-2 z-10">
        <button
          type="button"
          onClick={goPrev}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:text-foreground"
          aria-label="Vorheriger Review"
        >
          ↑
        </button>
        <div className="flex flex-col items-center gap-3">
          {REVIEWS.map((_, dotIndex) => {
            const active = dotIndex === index;
            return (
              <span
                key={`indicator-${dotIndex}`}
                className={`relative w-[6px] rounded-full border ${
                  active ? "h-[26px]" : "h-[20px]"
                }`}
                style={{
                  borderColor: "color-mix(in srgb, var(--foreground) 30%, transparent)",
                }}
              >
                {active && (
                  <span
                    className="absolute left-0 right-0 top-0 rounded-full"
                    style={{
                      height: `${Math.round(progress * 100)}%`,
                      backgroundColor: "color-mix(in srgb, var(--foreground) 45%, transparent)",
                    }}
                  />
                )}
              </span>
            );
          })}
        </div>
        <button
          type="button"
          onClick={goNext}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:text-foreground"
          aria-label="Nächster Review"
        >
          ↓
        </button>
      </div>
    </div>
  );
}
