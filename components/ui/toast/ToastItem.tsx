"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import { cn } from "@/lib/utils";
import type { ToastRecord, ToastType } from "./useToast";

const EXIT_DURATION_MS = 180;

const DURATION_BY_TYPE: Record<ToastType, number> = {
  success: 3000,
  info: 4000,
  error: 6000,
};

type ToastItemProps = {
  toast: ToastRecord;
  onRemove: (id: string) => void;
};

type VisualSpec = {
  Icon: typeof CheckCircleIcon;
  accentColor: string;
  surfaceColor: string;
  borderColor: string;
};

function getVisualSpec(type: ToastType): VisualSpec {
  if (type === "success") {
    return {
      Icon: CheckCircleIcon,
      accentColor: "var(--color-success)",
      surfaceColor: "color-mix(in srgb, var(--color-success) 14%, var(--color-card))",
      borderColor: "color-mix(in srgb, var(--color-success) 30%, var(--color-border))",
    };
  }

  if (type === "error") {
    return {
      Icon: ExclamationCircleIcon,
      accentColor: "var(--color-error)",
      surfaceColor: "color-mix(in srgb, var(--color-error) 14%, var(--color-card))",
      borderColor: "color-mix(in srgb, var(--color-error) 30%, var(--color-border))",
    };
  }

  return {
    Icon: InformationCircleIcon,
    accentColor: "var(--color-info)",
    surfaceColor: "color-mix(in srgb, var(--color-info) 14%, var(--color-card))",
    borderColor: "color-mix(in srgb, var(--color-info) 30%, var(--color-border))",
  };
}

export function ToastItem({ toast, onRemove }: ToastItemProps): JSX.Element {
  const totalDurationMs = toast.durationMs ?? DURATION_BY_TYPE[toast.type];
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [progressPercent, setProgressPercent] = useState(100);
  const [progressTransitionMs, setProgressTransitionMs] = useState(0);
  const timeoutRef = useRef<number | null>(null);
  const progressRafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const remainingMsRef = useRef<number>(totalDurationMs);
  const isPausedRef = useRef(false);
  const isExitingRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current === null) return;
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const clearProgressRaf = useCallback(() => {
    if (progressRafRef.current === null) return;
    window.cancelAnimationFrame(progressRafRef.current);
    progressRafRef.current = null;
  }, []);

  const syncProgressStatic = useCallback(
    (remainingMs: number) => {
      const ratio = Math.max(0, Math.min(1, remainingMs / totalDurationMs));
      setProgressTransitionMs(0);
      setProgressPercent(ratio * 100);
    },
    [totalDurationMs]
  );

  const animateProgressToZero = useCallback(
    (remainingMs: number) => {
      const safeRemaining = Math.max(0, remainingMs);
      syncProgressStatic(safeRemaining);
      clearProgressRaf();

      progressRafRef.current = window.requestAnimationFrame(() => {
        progressRafRef.current = window.requestAnimationFrame(() => {
          setProgressTransitionMs(safeRemaining);
          setProgressPercent(0);
        });
      });
    },
    [clearProgressRaf, syncProgressStatic]
  );

  const closeWithAnimation = useCallback(() => {
    if (isExitingRef.current) return;
    isExitingRef.current = true;
    setIsExiting(true);
    clearTimer();
    clearProgressRaf();
    syncProgressStatic(0);
    timeoutRef.current = window.setTimeout(() => {
      onRemove(toast.id);
    }, EXIT_DURATION_MS);
  }, [clearProgressRaf, clearTimer, onRemove, syncProgressStatic, toast.id]);

  const startTimer = useCallback(
    (durationMs: number) => {
      if (durationMs <= 0) {
        closeWithAnimation();
        return;
      }
      remainingMsRef.current = durationMs;
      clearTimer();
      startedAtRef.current = Date.now();
      animateProgressToZero(durationMs);
      timeoutRef.current = window.setTimeout(() => {
        closeWithAnimation();
      }, durationMs);
    },
    [animateProgressToZero, clearTimer, closeWithAnimation]
  );

  const handleMouseEnter = useCallback(() => {
    if (isPausedRef.current || isExitingRef.current) return;
    isPausedRef.current = true;
    const elapsed = Date.now() - startedAtRef.current;
    remainingMsRef.current = Math.max(0, remainingMsRef.current - elapsed);
    clearTimer();
    clearProgressRaf();
    syncProgressStatic(remainingMsRef.current);
  }, [clearProgressRaf, clearTimer, syncProgressStatic]);

  const handleMouseLeave = useCallback(() => {
    if (!isPausedRef.current || isExitingRef.current) return;
    isPausedRef.current = false;
    startTimer(remainingMsRef.current);
  }, [startTimer]);

  const handleDismissClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      closeWithAnimation();
    },
    [closeWithAnimation]
  );

  useEffect(() => {
    if (!toast.isExiting) return;
    closeWithAnimation();
  }, [closeWithAnimation, toast.isExiting]);

  useEffect(() => {
    const duration = toast.durationMs ?? DURATION_BY_TYPE[toast.type];
    setIsVisible(false);
    setIsExiting(false);
    isExitingRef.current = false;
    isPausedRef.current = false;
    remainingMsRef.current = duration;
    syncProgressStatic(duration);

    const rafId = window.requestAnimationFrame(() => {
      setIsVisible(true);
    });

    startTimer(remainingMsRef.current);

    return () => {
      window.cancelAnimationFrame(rafId);
      clearTimer();
      clearProgressRaf();
    };
  }, [clearProgressRaf, clearTimer, startTimer, syncProgressStatic, toast.durationMs, toast.id, toast.type]);

  const motionClass = isExiting
    ? "opacity-0 translate-x-[120%] duration-[180ms] ease-in"
    : isVisible
      ? "opacity-100 translate-x-0 duration-[260ms] ease-out"
      : "opacity-0 translate-x-[120%] duration-[260ms] ease-out";

  const visual = useMemo(() => getVisualSpec(toast.type), [toast.type]);

  return (
    <article
      className={cn(
        "pointer-events-auto relative flex w-[min(360px,calc(100vw-2rem))] min-w-[280px] max-w-[360px] items-start gap-[10px] overflow-hidden rounded-[10px] border px-[14px] py-[12px] transition-[opacity,transform] will-change-[opacity,transform]",
        motionClass
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        backgroundColor: visual.surfaceColor,
        color: "var(--color-text)",
        borderColor: visual.borderColor,
        boxShadow: "0 8px 20px var(--color-toast-shadow)",
      }}
    >
      <visual.Icon
        className="h-[18px] w-[18px] shrink-0 self-center"
        aria-hidden="true"
        style={{ color: visual.accentColor }}
      />
      <div className="min-w-0 flex-1 pr-4">
        <p className="text-[14px] font-normal leading-5">{toast.title}</p>
        {toast.message ? (
          <p className="mt-0.5 text-[13px] leading-[1.35] opacity-[0.85]">{toast.message}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={handleDismissClick}
        className="absolute right-2 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-border)]"
        aria-label="Benachrichtigung schließen"
        style={{ color: "color-mix(in srgb, var(--color-text) 55%, var(--color-border))" }}
      >
        <XMarkIcon className="h-[14px] w-[14px]" aria-hidden="true" />
      </button>
      <div
        className="pointer-events-none absolute bottom-0 left-[1px] right-[1px] h-[2px] overflow-hidden rounded-b-[8px]"
        style={{ backgroundColor: "var(--color-border)", color: visual.accentColor }}
        aria-hidden="true"
      >
        <div
          className="absolute right-0 top-0 h-full"
          style={{
            width: `${progressPercent}%`,
            backgroundColor: "currentColor",
            transitionProperty: "width",
            transitionTimingFunction: "linear",
            transitionDuration: `${progressTransitionMs}ms`,
          }}
        />
      </div>
    </article>
  );
}
