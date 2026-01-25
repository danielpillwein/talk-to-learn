"use client";

import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/utils";

type HeroIcon = ComponentType<SVGProps<SVGSVGElement>>;

export function IconSwap({
  outline: Outline,
  solid: Solid,
  className,
  active = false,
}: {
  outline: HeroIcon;
  solid: HeroIcon;
  className?: string;
  active?: boolean;
}) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <Outline
        className={cn(
          "h-full w-full transition-opacity duration-200",
          active ? "opacity-0" : "opacity-100",
          "group-hover:opacity-0"
        )}
      />
      <Solid
        className={cn(
          "absolute inset-0 h-full w-full transition-opacity duration-200",
          active ? "opacity-100" : "opacity-0",
          "group-hover:opacity-100"
        )}
      />
    </span>
  );
}
