import type * as React from "react";
import { cn } from "@/lib/utils";

export function ScrollArea({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="scroll-area"
      className={cn("overflow-auto [scrollbar-color:rgb(63_63_70)_transparent] [scrollbar-width:thin]", className)}
      {...props}
    />
  );
}
