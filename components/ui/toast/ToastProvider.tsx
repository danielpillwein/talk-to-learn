"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { ToastContainer } from "./ToastContainer";
import { ToastContext, type ToastPayload, type ToastRecord, type ToastType } from "./useToast";

const MAX_VISIBLE_TOASTS = 3;

function createToastId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createTypedToast(type: ToastType, title: string, message?: string): ToastPayload {
  return {
    type,
    title,
    message,
  };
}

type ToastProviderProps = {
  children: ReactNode;
};

export function ToastProvider({ children }: ToastProviderProps): JSX.Element {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const pendingToastsRef = useRef<ToastRecord[]>([]);

  const addPendingToastsIfPossible = useCallback((current: ToastRecord[]): ToastRecord[] => {
    if (pendingToastsRef.current.length === 0) return current;
    if (current.length >= MAX_VISIBLE_TOASTS) return current;

    const next = [...current];
    while (next.length < MAX_VISIBLE_TOASTS && pendingToastsRef.current.length > 0) {
      const pending = pendingToastsRef.current.shift();
      if (!pending) break;
      next.unshift({ ...pending, isExiting: false });
    }
    return next;
  }, []);

  const markOldestToastForExit = useCallback((current: ToastRecord[]): ToastRecord[] => {
    if (current.length === 0) return current;
    const lastIndex = current.length - 1;
    const oldest = current[lastIndex];
    if (oldest?.isExiting) return current;
    const next = [...current];
    next[lastIndex] = { ...oldest, isExiting: true };
    return next;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => {
      const remaining = current.filter((toast) => toast.id !== id);
      return addPendingToastsIfPossible(remaining);
    });
  }, [addPendingToastsIfPossible]);

  const addToast = useCallback((toast: ToastPayload): string => {
    const id = createToastId();
    const safeTitle = String(toast.title ?? "").trim() || "Hinweis";
    const safeMessage = toast.message ? String(toast.message).trim() : undefined;
    const nextToast: ToastRecord = {
      id,
      type: toast.type,
      title: safeTitle,
      message: safeMessage || undefined,
      durationMs:
        typeof toast.durationMs === "number" && Number.isFinite(toast.durationMs) && toast.durationMs > 0
          ? toast.durationMs
          : undefined,
      isExiting: false,
    };

    setToasts((current) => {
      if (current.length < MAX_VISIBLE_TOASTS && pendingToastsRef.current.length === 0) {
        return [{ ...nextToast, isExiting: false }, ...current];
      }

      pendingToastsRef.current.push(nextToast);
      if (current.length < MAX_VISIBLE_TOASTS) {
        return addPendingToastsIfPossible(current);
      }
      return markOldestToastForExit(current);
    });
    return id;
  }, [addPendingToastsIfPossible, markOldestToastForExit]);

  const success = useCallback(
    (title: string, message?: string) => addToast(createTypedToast("success", title, message)),
    [addToast]
  );
  const error = useCallback(
    (title: string, message?: string) => addToast(createTypedToast("error", title, message)),
    [addToast]
  );
  const info = useCallback(
    (title: string, message?: string) => addToast(createTypedToast("info", title, message)),
    [addToast]
  );

  const value = useMemo(
    () => ({
      toasts,
      addToast,
      removeToast,
      success,
      error,
      info,
    }),
    [toasts, addToast, removeToast, success, error, info]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}
