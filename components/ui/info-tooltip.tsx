"use client";

import { ReactNode } from "react";

type InfoTooltipProps = {
  title: string;
  description?: string;
  className?: string;
  positionClassName?: string;
  children?: ReactNode;
};

export function InfoTooltip({
  title,
  description,
  className,
  positionClassName,
  children,
}: InfoTooltipProps) {
  return (
    <div className={`relative inline-block group ${className ?? ""}`}>
      <span
        className="relative h-8 w-8 overflow-hidden rounded-full focus:outline-none transition-all duration-300 inline-flex items-center justify-center cursor-help"
        style={{
          backgroundColor: "var(--info)",
          boxShadow: "0 0 0 rgba(0,0,0,0)",
        }}
        aria-label={title}
      >
        <span className="relative flex items-center justify-center">
          {children ?? (
            <svg
              viewBox="0 0 24 24"
              stroke="currentColor"
              fill="none"
              className="h-4 w-4"
              style={{ color: "var(--foreground)" }}
            >
              <path
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          )}
        </span>
      </span>

      <div
        className={`pointer-events-none absolute bottom-full left-1/2 mb-3 w-auto max-w-none -translate-x-1/2 translate-y-2 opacity-0 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100 z-50 ${
          positionClassName ?? ""
        }`}
      >
        <div
          className="relative rounded-2xl border px-4 py-3 whitespace-nowrap"
          style={{
            background:
              "linear-gradient(135deg, var(--info), color-mix(in srgb, var(--info) 90%, black))",
            borderColor: "var(--info)",
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(0,0,0,0.08)" }}
            >
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
                style={{ color: "var(--foreground)" }}
              >
                <path
                  clipRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  fillRule="evenodd"
                />
              </svg>
            </span>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground leading-none">{title}</p>
              {description && (
                <p className="text-xs text-foreground/80 leading-none">{description}</p>
              )}
            </div>
          </div>

          <div
            className="absolute inset-0 rounded-2xl opacity-0"
            style={{ background: "transparent" }}
          />

          <div
            className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-r border-b"
            style={{
              background:
                "linear-gradient(135deg, var(--info), color-mix(in srgb, var(--info) 90%, black))",
              borderColor: "var(--info)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
