import type * as React from "react";
import { cn } from "@/lib/utils";

type TooltipProps = {
  label: string;
  children: React.ReactNode;
  className?: string;
};

export function Tooltip({ label, children, className }: TooltipProps) {
  return (
    <span className={cn("group relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-[calc(100%+0.45rem)] z-30 hidden min-w-44 -translate-x-1/2 rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs leading-4 text-zinc-200 shadow-xl group-hover:block group-focus-within:block"
      >
        {label}
      </span>
    </span>
  );
}
