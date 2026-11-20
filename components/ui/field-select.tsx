"use client";

import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

// Thin wrapper over the branded Radix Select for the common
// "value + options" case. Radix forbids an empty-string item value, so we map
// "" <-> a reserved sentinel internally (lets callers keep an "All"/"None" option).
const EMPTY = "__empty__";

export type FieldSelectOption = { value: string; label: string; disabled?: boolean };

export function FieldSelect({
  value, onChange, options, placeholder, className, contentClassName, disabled, id, name, "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: FieldSelectOption[];
  placeholder?: string;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  "aria-label"?: string;
}) {
  // "" shows the placeholder unless an option explicitly uses "" (e.g. "All").
  const hasEmpty = options.some((o) => o.value === "");
  return (
    <Select value={value === "" ? (hasEmpty ? EMPTY : "") : value} onValueChange={(v) => onChange(v === EMPTY ? "" : v)} disabled={disabled} name={name}>
      <SelectTrigger id={id} aria-label={ariaLabel} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value === "" ? EMPTY : o.value} disabled={o.disabled}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
