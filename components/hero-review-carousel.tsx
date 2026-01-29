"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Review = {
  rating: number;
  name: string;
  study: string;
  highlight: string;
};

const REVIEWS: Review[] = [
  {
    "rating": 5.0,
    "name": "Sophie",
    "study": "Wirtschaft (BWL/VWL)",
    "highlight": "Ich konnte vieles auswendig, bin aber in Prüfungen ins Stocken gekommen. Jetzt bekomme ich endlich einen klaren roten Faden."
  },
  {
    "rating": 5.0,
    "name": "Anna",
    "study": "Medizin",
    "highlight": "Lesen hat sich nie nachhaltig angefühlt. Durch das Erklären bleibt der Stoff wirklich hängen."
  },
  {
    "rating": 5.0,
    "name": "Max",
    "study": "Rechtswissenschaften",
    "highlight": "Ich wusste die Lösung, konnte sie aber nicht sauber formulieren. Das Training hat mir enorm geholfen."
  }
];

export function HeroReviewCarousel(): JSX.Element {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAnimatingRef = useRef(false);

  const DURATION = 5000;
  const ANIM_DURATION = 520;

  useEffect(() => {
    const step = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const next = Math.min(elapsed / DURATION, 1);
      setProgress(next);
      if (next >= 1 && !isAnimatingRef.current) {
        setIsAnimating(true);
        isAnimatingRef.current = true;
        setDirection("next");
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          setIndex((current) => (current + 1) % REVIEWS.length);
          startRef.current = performance.now();
          setProgress(0);
          setIsAnimating(false);
          isAnimatingRef.current = false;
        }, ANIM_DURATION);
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      rafRef.current = null;
      startRef.current = null;
    };
  }, []);

  const order = useMemo(() => {
    return REVIEWS.map((_, idx) => (index + idx) % REVIEWS.length);
  }, [index]);

  function goPrev(): void {
    if (isAnimatingRef.current) return;
    setDirection("prev");
    setIsAnimating(true);
    isAnimatingRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIndex((prev) => (prev - 1 + REVIEWS.length) % REVIEWS.length);
      setProgress(0);
      startRef.current = null;
      setIsAnimating(false);
      isAnimatingRef.current = false;
    }, ANIM_DURATION);
  }

  function goNext(): void {
    if (isAnimatingRef.current) return;
    setDirection("next");
    setIsAnimating(true);
    isAnimatingRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIndex((prev) => (prev + 1) % REVIEWS.length);
      setProgress(0);
      startRef.current = null;
      setIsAnimating(false);
      isAnimatingRef.current = false;
    }, ANIM_DURATION);
  }

  const getCardStyle = (stackIndex: number) => {
    const baseOffset = stackIndex * 12;
    const baseScale = 1 - stackIndex * 0.035;
    const baseWidth = 100 - stackIndex * 7;
    const shiftUp = isAnimating ? 12 : 0;

    if (isAnimating && stackIndex === 0) {
      const exitOffset = direction === "next" ? 46 : -18;
      const exitRotate = direction === "next" ? -2.4 : 2.4;
      return {
        translateY: baseOffset + exitOffset,
        scale: baseScale - 0.08,
        rotate: exitRotate,
        width: `${Math.max(78, baseWidth - 6)}%`,
        opacity: 0.7,
      };
    }

    const adjustedIndex = isAnimating ? Math.max(0, stackIndex - 1) : stackIndex;
    return {
      translateY: baseOffset - shiftUp,
      scale: 1 - adjustedIndex * 0.035,
      rotate: direction === "prev" ? 0.4 * adjustedIndex : -0.4 * adjustedIndex,
      width: `${100 - adjustedIndex * 7}%`,
      opacity: 1,
    };
  };

  return (
    <div className="relative flex h-full min-h-[200px] w-full items-start gap-4 sm:min-h-[220px]">
      <div className="relative flex-1 min-w-0">
        {order.map((reviewIndex, stackIndex) => {
          const review = REVIEWS[reviewIndex];
          const style = getCardStyle(stackIndex);

          return (
            <div
              key={`${review.name}-${reviewIndex}`}
              className="absolute left-1/2 top-0 h-[156px] rounded-2xl border px-6 py-5 transition-[transform,opacity,width,box-shadow] duration-[520ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                transform: `translateX(-50%) translateY(${style.translateY}px) scale(${style.scale}) rotate(${style.rotate}deg)`,
                zIndex: REVIEWS.length - stackIndex,
                width: style.width,
                opacity: style.opacity,
                backgroundColor: "var(--background)",
                borderColor: "color-mix(in srgb, var(--foreground) 15%, transparent)",
                boxShadow:
                  stackIndex === 0 && !isAnimating
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
      <div className="z-10 flex flex-col items-center gap-2">
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
