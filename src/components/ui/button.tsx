import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "default" | "icon";
};

const variants = {
  primary: "border-emerald-400 bg-emerald-400 text-zinc-950 hover:bg-emerald-300",
  secondary: "border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
  outline: "border-zinc-700 bg-transparent text-zinc-100 hover:bg-zinc-900",
  ghost: "border-transparent bg-transparent text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100",
  danger: "border-red-500 bg-red-500 text-white hover:bg-red-400",
};

const sizes = {
  sm: "h-8 px-2.5 text-xs",
  default: "h-9 px-3 text-sm",
  icon: "h-9 w-9 px-0",
};

export function Button({ className, variant = "secondary", size = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded border font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
