"use client";

import { useLayoutEffect, useRef } from "react";
import { ToastItem } from "./ToastItem";
import type { ToastRecord } from "./useToast";

type ToastContainerProps = {
  toasts: ToastRecord[];
  onRemove: (id: string) => void;
};

export function ToastContainer({ toasts, onRemove }: ToastContainerProps): JSX.Element {
  const elementMapRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const previousTopRef = useRef<Map<string, number>>(new Map());

  useLayoutEffect(() => {
    const nextTop = new Map<string, number>();

    for (const toast of toasts) {
      const element = elementMapRef.current.get(toast.id);
      if (!element) continue;

      const currentTop = element.getBoundingClientRect().top;
      nextTop.set(toast.id, currentTop);

      const prevTop = previousTopRef.current.get(toast.id);
      if (typeof prevTop !== "number") continue;

      const delta = prevTop - currentTop;
      if (Math.abs(delta) < 1) continue;

      element.style.transition = "none";
      element.style.transform = `translateY(${delta}px)`;
      element.getBoundingClientRect();
      element.style.transition = "transform 220ms ease";
      element.style.transform = "translateY(0)";
    }

    previousTopRef.current = nextTop;
  }, [toasts]);

  return (
    <div
      className="pointer-events-none fixed right-6 z-40 flex flex-col items-end gap-[10px]"
      style={{ top: "calc(var(--navbar-height, 64px) + 16px)" }}
      role="status"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          ref={(node) => {
            if (node) {
              elementMapRef.current.set(toast.id, node);
              return;
            }
            elementMapRef.current.delete(toast.id);
            previousTopRef.current.delete(toast.id);
          }}
        >
          <ToastItem toast={toast} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
}
