import type * as React from "react";
import { cn } from "@/lib/utils";

type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  value: number;
};

export function Progress({ value, className, ...props }: ProgressProps) {
  const width = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
      data-slot="progress"
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-zinc-800", className)}
      {...props}
    >
      <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${width}%` }} />
    </div>
  );
}
