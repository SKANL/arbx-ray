import type * as React from "react";
import { cn } from "@/lib/utils";

type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: "neutral" | "green" | "amber" | "red" | "cyan";
};

const alertTones = {
  neutral: "border-zinc-800 bg-zinc-900/70 text-zinc-200",
  green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  red: "border-red-500/30 bg-red-500/10 text-red-100",
  cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
};

export function Alert({ tone = "neutral", className, ...props }: AlertProps) {
  return (
    <div
      role="status"
      data-slot="alert"
      className={cn("relative rounded-md border p-3 text-sm leading-5", alertTones[tone], className)}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 data-slot="alert-title" className={cn("font-semibold", className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p data-slot="alert-description" className={cn("mt-1 text-xs leading-5 opacity-90", className)} {...props} />;
}
