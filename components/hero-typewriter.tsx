"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type HeroTypewriterProps = {
  className?: string;
};

const TYPE_SPEED_MS = 70;
const DELETE_SPEED_MS = 50;
const PAUSE_AFTER_TYPED_MS = 1200;
const PAUSE_AFTER_DELETED_MS = 400;

const STRINGS = [
  "deinen Mitschriften",
  "deinen Unterlagen",
  "deinen Skripten",
  "deinem Lernstoff",
];

export function HeroTypewriter({
  className,
}: HeroTypewriterProps): JSX.Element {
  const [text, setText] = useState("");
  const [index, setIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const current = STRINGS[index] ?? "";

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let delayMs = TYPE_SPEED_MS;
    let nextText = text;

    if (!isDeleting && text === current) {
      timeoutId = setTimeout(() => setIsDeleting(true), PAUSE_AFTER_TYPED_MS);
    } else if (isDeleting && text.length === 0) {
      timeoutId = setTimeout(() => {
        setIsDeleting(false);
        setIndex((prev) => (prev + 1) % STRINGS.length);
      }, PAUSE_AFTER_DELETED_MS);
    } else {
      if (isDeleting) {
        delayMs = DELETE_SPEED_MS;
        nextText = current.slice(0, Math.max(0, text.length - 1));
      } else {
        nextText = current.slice(0, text.length + 1);
      }

      timeoutId = setTimeout(() => setText(nextText), delayMs);
    }

    return () => clearTimeout(timeoutId);
  }, [current, isDeleting, text]);

  return (
    <span
      className={cn("inline-block", className)}
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="inline-block min-h-[1.1em] align-baseline">{text}</span>
      <span className="hero-cursor align-baseline" aria-hidden="true">
        |
      </span>
    </span>
  );
}
