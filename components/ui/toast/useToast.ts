"use client";

import { createContext, useContext } from "react";

export type ToastType = "info" | "success" | "error";

export type ToastPayload = {
  type: ToastType;
  title: string;
  message?: string;
  durationMs?: number;
};

export type ToastRecord = ToastPayload & {
  id: string;
  isExiting?: boolean;
};

export type ToastApi = {
  toasts: ToastRecord[];
  addToast: (toast: ToastPayload) => string;
  removeToast: (id: string) => void;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
};

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider.");
  }

  return context;
}
