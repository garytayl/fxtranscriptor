"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccordionContextValue {
  value: string[];
  onValueChange: (value: string[]) => void;
}

const AccordionContext = React.createContext<AccordionContextValue | undefined>(undefined);
const AccordionItemContext = React.createContext<{ value: string } | undefined>(undefined);

interface AccordionProps {
  children: React.ReactNode;
  type?: "single" | "multiple";
  defaultValue?: string[];
  value?: string[];
  onValueChange?: (value: string[]) => void;
  className?: string;
}

export function Accordion({
  children,
  type = "multiple",
  defaultValue = [],
  value: controlledValue,
  onValueChange,
  className,
}: AccordionProps) {
  const [internalValue, setInternalValue] = React.useState<string[]>(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  const handleValueChange = React.useCallback(
    (newValue: string[]) => {
      if (!isControlled) {
        setInternalValue(newValue);
      }
      onValueChange?.(newValue);
    },
    [isControlled, onValueChange]
  );

  return (
    <AccordionContext.Provider value={{ value, onValueChange: handleValueChange }}>
      <div className={cn("space-y-2", className)}>{children}</div>
    </AccordionContext.Provider>
  );
}

interface AccordionItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function AccordionItem({ value, children, className }: AccordionItemProps) {
  const context = React.useContext(AccordionContext);
  if (!context) {
    throw new Error("AccordionItem must be used within Accordion");
  }

  const isOpen = context.value.includes(value);

  return (
    <AccordionItemContext.Provider value={{ value }}>
      <div
        className={cn(
          "border border-border/30 rounded-lg overflow-hidden transition-all",
          isOpen && "border-accent/40",
          className
        )}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

interface AccordionTriggerProps {
  children: React.ReactNode;
  className?: string;
}

export function AccordionTrigger({ children, className }: AccordionTriggerProps) {
  const context = React.useContext(AccordionContext);
  const itemContext = React.useContext(AccordionItemContext);
  
  if (!context || !itemContext) {
    throw new Error("AccordionTrigger must be used within AccordionItem");
  }

  const isOpen = context.value.includes(itemContext.value);

  const handleClick = () => {
    const newValue = isOpen
      ? context.value.filter((v) => v !== itemContext.value)
      : [...context.value, itemContext.value];
    context.onValueChange(newValue);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full flex items-center justify-between p-4 bg-card/30 hover:bg-card/50 transition-colors text-left",
        className
      )}
    >
      <div className="flex-1">{children}</div>
      <ChevronDown
        className={cn(
          "size-4 text-muted-foreground transition-transform flex-shrink-0 ml-4",
          isOpen && "transform rotate-180"
        )}
      />
    </button>
  );
}

interface AccordionContentProps {
  children: React.ReactNode;
  className?: string;
}

export function AccordionContent({ children, className }: AccordionContentProps) {
  const context = React.useContext(AccordionContext);
  const itemContext = React.useContext(AccordionItemContext);
  
  if (!context || !itemContext) {
    throw new Error("AccordionContent must be used within AccordionItem");
  }

  const isOpen = context.value.includes(itemContext.value);

  if (!isOpen) return null;

  return (
    <div className={cn("p-4 border-t border-border/30 bg-card/20", className)}>
      {children}
    </div>
  );
}

