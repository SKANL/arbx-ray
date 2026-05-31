import type * as React from "react";
import { cn } from "@/lib/utils";

export function Empty({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex min-h-36 flex-col items-center justify-center rounded-md border border-dashed border-zinc-800 px-4 py-8 text-center",
        className,
      )}
      {...props}
    />
  );
}

export function EmptyMedia({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="empty-media"
      className={cn("mb-3 flex size-10 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400", className)}
      {...props}
    />
  );
}

export function EmptyTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 data-slot="empty-title" className={cn("text-sm font-semibold text-zinc-100", className)} {...props} />;
}

export function EmptyDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p data-slot="empty-description" className={cn("mt-1 max-w-sm text-sm leading-5 text-zinc-500", className)} {...props} />;
}

export function EmptyContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="empty-content" className={cn("mt-4", className)} {...props} />;
}
