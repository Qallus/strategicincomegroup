"use client";

import * as React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

// Branded checkbox (no native OS styling). A real <input type="checkbox"> is
// kept for accessibility, keyboard support and FormData; it is visually hidden
// and a styled box is drawn with `peer` selectors.
type NativeProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size">;

export interface CheckboxProps extends NativeProps {
  /** Shows a dash and sets the native `indeterminate` flag. */
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Size of the box. */
  size?: "sm" | "md";
  /** Classes for the outer wrapper span. `className` styles the box. */
  wrapperClassName?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, wrapperClassName, indeterminate = false, onChange, onCheckedChange, size = "md", disabled, ...props },
  forwarded,
) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useImperativeHandle(forwarded, () => ref.current as HTMLInputElement);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const box = size === "sm" ? "h-3.5 w-3.5 rounded-[3px]" : "h-4 w-4 rounded";
  const icon = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";

  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center align-middle", disabled ? "cursor-not-allowed" : "cursor-pointer", wrapperClassName)}>
      <input
        ref={ref}
        type="checkbox"
        disabled={disabled}
        aria-checked={indeterminate ? "mixed" : undefined}
        onChange={(e) => {
          onChange?.(e);
          onCheckedChange?.(e.target.checked);
        }}
        className="peer absolute inset-0 m-0 h-full w-full cursor-[inherit] appearance-none opacity-0"
        {...props}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none flex items-center justify-center border border-input bg-background text-primary-foreground shadow-sm transition-colors",
          "peer-hover:border-ring/70 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
          "peer-checked:border-primary peer-checked:bg-primary [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100",
          "peer-disabled:opacity-50",
          indeterminate && "border-primary bg-primary [&>svg]:opacity-100",
          box,
          className,
        )}
      >
        {indeterminate ? <Minus className={icon} strokeWidth={3} /> : <Check className={icon} strokeWidth={3} />}
      </span>
    </span>
  );
});
