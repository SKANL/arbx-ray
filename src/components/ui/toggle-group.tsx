"use client";

import type * as React from "react";
import { createContext, useContext } from "react";
import { cn } from "@/lib/utils";

type ToggleGroupContextValue = {
  value: string;
  onValueChange: (value: string) => void;
};

const ToggleGroupContext = createContext<ToggleGroupContextValue | undefined>(undefined);

type ToggleGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  value: string;
  onValueChange: (value: string) => void;
  "aria-label": string;
};

export function ToggleGroup({ value, onValueChange, className, ...props }: ToggleGroupProps) {
  return (
    <ToggleGroupContext.Provider value={{ value, onValueChange }}>
      <div
        role="group"
        data-slot="toggle-group"
        className={cn("inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950 p-1", className)}
        {...props}
      />
    </ToggleGroupContext.Provider>
  );
}

type ToggleGroupItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
};

export function ToggleGroupItem({ value, className, ...props }: ToggleGroupItemProps) {
  const context = useToggleGroupContext();
  const active = context.value === value;
  return (
    <button
      type="button"
      aria-pressed={active}
      data-state={active ? "on" : "off"}
      data-slot="toggle-group-item"
      className={cn(
        "inline-flex h-8 items-center justify-center rounded px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60",
        active ? "bg-zinc-100 text-zinc-950" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
        className,
      )}
      onClick={() => context.onValueChange(value)}
      {...props}
    />
  );
}

function useToggleGroupContext(): ToggleGroupContextValue {
  const context = useContext(ToggleGroupContext);
  if (!context) throw new Error("ToggleGroupItem must be rendered inside <ToggleGroup>.");
  return context;
}
