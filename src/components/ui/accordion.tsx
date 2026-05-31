"use client";

import type * as React from "react";
import { createContext, useContext, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type AccordionContextValue = {
  openValues: string[];
  toggleValue: (value: string) => void;
};

const AccordionContext = createContext<AccordionContextValue | undefined>(undefined);
const AccordionItemContext = createContext<string | undefined>(undefined);

type AccordionProps = React.HTMLAttributes<HTMLDivElement> & {
  defaultValue?: string[];
};

export function Accordion({ defaultValue = [], className, ...props }: AccordionProps) {
  const [openValues, setOpenValues] = useState(defaultValue);
  const contextValue = useMemo(
    () => ({
      openValues,
      toggleValue: (value: string) => {
        setOpenValues((current) =>
          current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
        );
      },
    }),
    [openValues],
  );

  return (
    <AccordionContext.Provider value={contextValue}>
      <div data-slot="accordion" className={cn("rounded-md border border-zinc-800", className)} {...props} />
    </AccordionContext.Provider>
  );
}

export function AccordionItem({
  value,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  value: string;
}) {
  return (
    <AccordionItemContext.Provider value={value}>
      <div data-slot="accordion-item" className={cn("border-b border-zinc-800 last:border-b-0", className)} {...props}>
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

export function AccordionTrigger({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const context = useAccordionContext();
  const value = useAccordionItemValue();
  const open = context.openValues.includes(value);
  return (
    <button
      type="button"
      aria-expanded={open}
      data-state={open ? "open" : "closed"}
      data-slot="accordion-trigger"
      className={cn(
        "flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm font-medium text-zinc-100 transition hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60",
        className,
      )}
      onClick={() => context.toggleValue(value)}
      {...props}
    >
      {children}
      <ChevronDown className={cn("shrink-0 text-zinc-500 transition-transform", open && "rotate-180")} size={16} />
    </button>
  );
}

export function AccordionContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const context = useAccordionContext();
  const value = useAccordionItemValue();
  if (!context.openValues.includes(value)) return null;
  return <div data-slot="accordion-content" className={cn("border-t border-zinc-800 px-4 py-3", className)} {...props} />;
}

function useAccordionContext(): AccordionContextValue {
  const context = useContext(AccordionContext);
  if (!context) throw new Error("Accordion components must be rendered inside <Accordion>.");
  return context;
}

function useAccordionItemValue(): string {
  const value = useContext(AccordionItemContext);
  if (!value) throw new Error("AccordionTrigger and AccordionContent must be rendered inside <AccordionItem>.");
  return value;
}
