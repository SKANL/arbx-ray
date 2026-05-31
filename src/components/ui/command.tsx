import type * as React from "react";
import { cn } from "@/lib/utils";

export function Command({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="command" className={cn("flex flex-col", className)} {...props} />;
}

export function CommandList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="command-list" className={cn("max-h-[54vh] overflow-auto p-2", className)} {...props} />;
}

export function CommandEmpty({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="command-empty" className={cn("py-8 text-center text-sm text-zinc-500", className)} {...props} />;
}

export function CommandGroup({
  heading,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  heading: string;
}) {
  return (
    <div data-slot="command-group" className={cn("p-1", className)} {...props}>
      <div className="px-2 py-1.5 text-xs font-medium uppercase text-zinc-500">{heading}</div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

export function CommandItem({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      data-slot="command-item"
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60",
        className,
      )}
      {...props}
    />
  );
}

export function CommandSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="command-separator" className={cn("my-1 h-px bg-zinc-800", className)} {...props} />;
}
