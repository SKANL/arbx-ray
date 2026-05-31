"use client";

import type * as React from "react";
import { createContext, useContext, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

type DialogContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  return <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>;
}

export function DialogContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const context = useDialogContext();
  if (!context.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 py-8 backdrop-blur-sm" onMouseDown={() => context.onOpenChange(false)}>
      <div
        role="dialog"
        aria-modal="true"
        data-slot="dialog-content"
        className={cn("relative w-full max-w-2xl rounded-md border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl", className)}
        onMouseDown={(event) => event.stopPropagation()}
        {...props}
      >
        {children}
        <Button
          aria-label="Close"
          className="absolute right-3 top-3"
          size="icon"
          type="button"
          variant="ghost"
          onClick={() => context.onOpenChange(false)}
        >
          <X size={16} />
        </Button>
      </div>
    </div>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-1.5 border-b border-zinc-800 p-4 pr-12", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 data-slot="dialog-title" className={cn("text-base font-semibold text-zinc-100", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p data-slot="dialog-description" className={cn("text-sm leading-5 text-zinc-500", className)} {...props} />;
}

function useDialogContext(): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) throw new Error("DialogContent must be rendered inside <Dialog>.");
  return context;
}
