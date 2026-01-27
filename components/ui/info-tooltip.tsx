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
    <div className={`relative inline-block group/info ${className ?? ""}`}>
      <span
        className="relative h-8 w-8 overflow-hidden rounded-full focus:outline-none transition-all duration-300 inline-flex items-center justify-center cursor-help"
        style={{
          backgroundColor: "transparent",
          boxShadow: "0 0 0 rgba(0,0,0,0)",
        }}
        aria-label={title}
      >
        <span className="relative flex items-center justify-center">
          {children ?? (
            <svg
              viewBox="0 0 24 24"
              stroke="currentColor"
              className="h-5 w-5 fill-none text-foreground transition-colors duration-300"
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
        className={`pointer-events-none absolute bottom-full left-1/2 mb-3 w-auto max-w-none -translate-x-1/2 translate-y-2 opacity-0 transition-all duration-300 ease-out group-hover/info:translate-y-0 group-hover/info:opacity-100 z-50 ${
          positionClassName ?? ""
        }`}
      >
        <div
          className="relative"
          style={{ filter: "drop-shadow(0 0 10px var(--background))" }}
        >
          <div
            className="relative rounded-2xl px-4 py-3 whitespace-nowrap"
            style={{
              background: "var(--info)",
            }}
          >
          <div className="space-y-0.5">
            <p className="text-sm font-normal text-foreground leading-none">{title}</p>
            {description && (
              <p className="text-xs font-normal text-foreground/80 leading-none">{description}</p>
            )}
          </div>

          <div
            className="absolute inset-0 rounded-2xl opacity-0"
            style={{ background: "transparent" }}
          />
        </div>
          <div
            className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45"
            style={{
              background: "var(--info)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
