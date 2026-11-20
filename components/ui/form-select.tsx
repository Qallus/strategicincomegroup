"use client";

import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

// Uncontrolled branded select for plain <form>s that read values via FormData.
// Radix renders a visually-hidden native <select name=…> inside the form, so
// `new FormData(form).get(name)` returns the chosen value and `required`
// participates in native form validation.
//
// Like a native <select>, it defaults to the first option unless a valid
// `defaultValue` is given or `placeholder` is set (then it starts empty).
export type FormSelectOption = string | { value: string; label: React.ReactNode; disabled?: boolean };

export function FormSelect({
  name, options, defaultValue, required, placeholder, disabled, className, contentClassName, id, onValueChange, "aria-label": ariaLabel,
}: {
  name: string;
  options: FormSelectOption[];
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  id?: string;
  onValueChange?: (v: string) => void;
  "aria-label"?: string;
}) {
  const items = options.map((o) => (typeof o === "string" ? { value: o, label: o as React.ReactNode, disabled: false } : o));
  const valid = (v?: string) => v !== undefined && v !== "" && items.some((i) => i.value === v);
  const initial = valid(defaultValue) ? defaultValue : placeholder ? undefined : items[0]?.value;

  return (
    <Select name={name} defaultValue={initial} required={required} disabled={disabled} onValueChange={onValueChange}>
      <SelectTrigger id={id} aria-label={ariaLabel} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value} disabled={o.disabled}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
