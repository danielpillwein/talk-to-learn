"use client";

import { ReactNode } from "react";

type InfoTooltipProps = {
  title: string;
  description?: string;
  multilineDescription?: boolean;
  placement?: "top-center" | "bottom-left";
  className?: string;
  positionClassName?: string;
  contentClassName?: string;
  children?: ReactNode;
};

export function InfoTooltip({
  title,
  description,
  multilineDescription = false,
  placement = "top-center",
  className,
  positionClassName,
  contentClassName,
  children,
}: InfoTooltipProps): JSX.Element {
  const tooltipPositionClass =
    placement === "bottom-left"
      ? "top-full right-0 mt-3 translate-y-2"
      : "bottom-full left-1/2 mb-3 -translate-x-1/2 translate-y-2";
  const tooltipVisibleClass =
    placement === "bottom-left"
      ? "group-hover/info:translate-y-0 group-hover/info:opacity-100"
      : "group-hover/info:translate-y-0 group-hover/info:opacity-100";
  const arrowClass =
    placement === "bottom-left"
      ? "absolute -top-1.5 right-4 h-3 w-3 rotate-45"
      : "absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45";

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
        className={`pointer-events-none absolute z-50 w-auto max-w-none opacity-0 transition-all duration-300 ease-out ${tooltipPositionClass} ${tooltipVisibleClass} ${
          positionClassName ?? ""
        }`}
      >
        <div
          className="relative"
          style={{ filter: "drop-shadow(0 0 10px var(--background))" }}
        >
          <div
            className={`relative rounded-2xl px-4 py-3 whitespace-nowrap ${contentClassName ?? ""}`}
            style={{
              background: "var(--info)",
            }}
          >
          <div className="space-y-0.5">
            <p className="text-sm font-normal text-foreground leading-none">{title}</p>
            {description && (
              <p
                className={`text-xs font-normal text-foreground/80 ${
                  multilineDescription
                    ? "whitespace-pre-line leading-tight"
                    : "leading-none"
                }`}
              >
                {description}
              </p>
            )}
          </div>

          <div
            className="absolute inset-0 rounded-2xl opacity-0"
            style={{ background: "transparent" }}
          />
        </div>
          <div className={arrowClass} style={{ background: "var(--info)" }} />
        </div>
      </div>
    </div>
  );
}
