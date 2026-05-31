import { cn } from "@/lib/utils";

type BadgeProps = {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "red" | "amber" | "cyan";
  className?: string;
};

const tones = {
  neutral: "border-zinc-700 bg-zinc-900 text-zinc-200",
  green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  red: "border-red-500/40 bg-red-500/10 text-red-200",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  cyan: "border-cyan-500/40 bg-cyan-500/10 text-cyan-200",
};

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center whitespace-normal break-words rounded border px-2 py-0.5 text-left text-[11px] font-medium uppercase tracking-normal",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
