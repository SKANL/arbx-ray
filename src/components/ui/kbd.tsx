import type * as React from "react";
import { cn } from "@/lib/utils";

export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 min-w-5 items-center justify-center rounded border border-zinc-700 bg-zinc-900 px-1.5 font-mono text-[10px] font-medium text-zinc-300 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
