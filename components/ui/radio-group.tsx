"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Branded radio group (no native OS styling). Each item is a real, visually
// hidden <input type="radio"> sharing a group name, so arrow-key navigation,
// focus and FormData all work natively. Controlled (`value`) or uncontrolled
// (`defaultValue`).
type Ctx = {
  name: string;
  value: string | undefined;
  setValue: (v: string) => void;
  disabled?: boolean;
  required?: boolean;
};
const RadioCtx = React.createContext<Ctx | null>(null);

export function RadioGroup({
  value, defaultValue, onValueChange, name, disabled, required, className, children, "aria-label": ariaLabel, orientation = "vertical",
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
  orientation?: "vertical" | "horizontal";
}) {
  const autoName = React.useId();
  const [inner, setInner] = React.useState(defaultValue);
  const current = value !== undefined ? value : inner;
  const ctx = React.useMemo<Ctx>(
    () => ({
      name: name ?? autoName,
      value: current,
      setValue: (v) => {
        if (value === undefined) setInner(v);
        onValueChange?.(v);
      },
      disabled,
      required,
    }),
    [name, autoName, current, value, onValueChange, disabled, required],
  );
  return (
    <RadioCtx.Provider value={ctx}>
      <div role="radiogroup" aria-label={ariaLabel} aria-orientation={orientation} className={cn(orientation === "horizontal" ? "flex flex-wrap items-center gap-4" : "grid gap-2", className)}>
        {children}
      </div>
    </RadioCtx.Provider>
  );
}

export const RadioGroupItem = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "checked" | "defaultChecked" | "name"> & { value: string; wrapperClassName?: string }
>(function RadioGroupItem({ value, className, wrapperClassName, disabled, onChange, ...props }, ref) {
  const ctx = React.useContext(RadioCtx);
  if (!ctx) throw new Error("RadioGroupItem must be used inside RadioGroup");
  const isDisabled = disabled ?? ctx.disabled;
  return (
    <span className={cn("relative inline-flex h-4 w-4 shrink-0 items-center justify-center align-middle", isDisabled ? "cursor-not-allowed" : "cursor-pointer", wrapperClassName)}>
      <input
        ref={ref}
        type="radio"
        name={ctx.name}
        value={value}
        checked={ctx.value === value}
        disabled={isDisabled}
        required={ctx.required}
        onChange={(e) => {
          onChange?.(e);
          if (e.target.checked) ctx.setValue(value);
        }}
        className="peer absolute inset-0 m-0 h-full w-full cursor-[inherit] appearance-none opacity-0"
        {...props}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none flex h-4 w-4 items-center justify-center rounded-full border border-input bg-background shadow-sm transition-colors",
          "peer-hover:border-ring/70 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
          "peer-checked:border-primary [&>span]:scale-0 peer-checked:[&>span]:scale-100 peer-disabled:opacity-50",
          className,
        )}
      >
        <span className="h-2 w-2 rounded-full bg-primary transition-transform" />
      </span>
    </span>
  );
});
