"use client";

import * as React from "react";
import { GripVertical, Settings2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SettingDef, WidgetDef } from "@/lib/dashboard/registry";
import type { DashboardViewer, WidgetInstance, WidgetSettings, WidgetSize } from "@/lib/dashboard/types";
import { FieldSelect } from "@/components/ui/field-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { widgetComponent } from "./widgets";

const SIZE_LABEL: Record<WidgetSize, string> = { s: "S", m: "M", l: "L" };

/** The settings form for one widget (selects, sliders, switches, text). */
export function WidgetSettingsForm({ def, settings, viewer, onChange }: { def: WidgetDef; settings: WidgetSettings; viewer: DashboardViewer; onChange: (patch: WidgetSettings) => void }) {
  const defs = (def.settings ?? []).filter((s) => !s.adminOnly || viewer.isAdmin);
  if (!defs.length) return <p className="text-xs text-muted-foreground">This card has no settings.</p>;
  return (
    <div className="space-y-4">
      {defs.map((s) => (
        <SettingField key={s.key} s={s} value={settings[s.key]} onChange={(v) => onChange({ [s.key]: v })} viewer={viewer} />
      ))}
    </div>
  );
}

function SettingField({ s, value, onChange, viewer }: { s: SettingDef; value: WidgetSettings[string]; onChange: (v: string | number | boolean) => void; viewer: DashboardViewer }) {
  const id = React.useId();
  if (s.type === "switch") {
    return (
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className="text-xs font-medium">{s.label}</Label>
        <Switch id={id} checked={value === true || (value === undefined && false)} onCheckedChange={(v) => onChange(v)} />
      </div>
    );
  }
  if (s.type === "slider") {
    const n = typeof value === "number" ? value : s.min;
    return <SliderField id={id} s={s} value={n} onCommit={onChange} />;
  }
  if (s.type === "select") {
    const fallback = s.key === "scope" ? (viewer.isAdmin ? "firm" : "mine") : s.options[0]?.value ?? "";
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id} className="text-xs font-medium">{s.label}</Label>
        <FieldSelect id={id} value={typeof value === "string" ? value : fallback} onChange={onChange} options={s.options} className="h-8 text-xs" />
        {s.help ? <p className="text-[11px] text-muted-foreground">{s.help}</p> : null}
      </div>
    );
  }
  return <TextField id={id} s={s} value={typeof value === "string" ? value : ""} onCommit={onChange} />;
}

function SliderField({ id, s, value, onCommit }: { id: string; s: Extract<SettingDef, { type: "slider" }>; value: number; onCommit: (v: number) => void }) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => setV(value), [value]);
  const fmt = (x: number) => (s.unit === "s" && x >= 60 ? `${Math.round(x / 6) / 10} min` : `${x}${s.unit ?? ""}`);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-xs font-medium">{s.label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">{fmt(v)}</span>
      </div>
      <Slider id={id} min={s.min} max={s.max} step={s.step} value={[v]} onValueChange={([x]) => setV(x)} onValueCommit={([x]) => onCommit(x)} aria-label={s.label} />
    </div>
  );
}

function TextField({ id, s, value, onCommit }: { id: string; s: Extract<SettingDef, { type: "text" }>; value: string; onCommit: (v: string) => void }) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => setV(value), [value]);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium">{s.label}</Label>
      <Input
        id={id}
        value={v}
        maxLength={s.maxLength}
        placeholder={s.placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== value && onCommit(v.trim())}
        onKeyDown={(e) => e.key === "Enter" && onCommit(v.trim())}
        className="h-8 text-xs"
      />
    </div>
  );
}

export type FrameHandle = {
  attributes?: React.HTMLAttributes<HTMLElement>;
  listeners?: Record<string, (e: unknown) => void>;
  setActivatorNodeRef?: (el: HTMLElement | null) => void;
};

/** Glass card around one widget, with the Customize-mode controls on top. */
export function WidgetFrame({
  widget,
  def,
  viewer,
  customizing,
  index = 0,
  handle,
  dragging,
  onSize,
  onSettings,
  onRemove,
  className,
}: {
  widget: WidgetInstance;
  def: WidgetDef;
  viewer: DashboardViewer;
  customizing: boolean;
  index?: number;
  handle?: FrameHandle;
  dragging?: boolean;
  onSize: (size: WidgetSize) => void;
  onSettings: (patch: WidgetSettings) => void;
  onRemove: () => void;
  className?: string;
}) {
  const Component = widgetComponent(widget.kind);
  const hasSettings = (def.settings ?? []).some((s) => !s.adminOnly || viewer.isAdmin);
  const onSettingsChange = React.useCallback((patch: WidgetSettings) => onSettings(patch), [onSettings]);

  return (
    <div
      className={cn("sig-dash-card sig-card-in flex h-full min-w-0 flex-col", customizing && "ring-1 ring-dashed ring-brand-gold/40", dragging && "opacity-40", className)}
      data-interactive={!customizing}
      style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
    >
      {customizing ? (
        <div className="flex items-center gap-1 border-b border-border/60 px-2 py-1.5">
          <button
            type="button"
            ref={handle?.setActivatorNodeRef as React.Ref<HTMLButtonElement>}
            {...(handle?.attributes as React.ButtonHTMLAttributes<HTMLButtonElement>)}
            {...(handle?.listeners as React.DOMAttributes<HTMLButtonElement>)}
            className="flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
            aria-label={`Move ${def.title}`}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="min-w-0 flex-1 truncate text-xs font-semibold">{def.title}</span>
          {def.sizes.length > 1 ? (
            <ToggleGroup type="single" size="sm" value={widget.size} onValueChange={(v) => v && onSize(v as WidgetSize)} aria-label={`${def.title} size`}>
              {def.sizes.map((s) => (
                <ToggleGroupItem key={s} value={s} aria-label={`Size ${s.toUpperCase()}`} className="w-6 px-0">
                  {SIZE_LABEL[s]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}
          {hasSettings ? (
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`${def.title} settings`}>
                  <Settings2 className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72">
                <p className="mb-3 text-sm font-semibold">{def.title}</p>
                <WidgetSettingsForm def={def} settings={widget.settings} viewer={viewer} onChange={onSettingsChange} />
              </PopoverContent>
            </Popover>
          ) : null}
          <button type="button" onClick={onRemove} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Remove ${def.title}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
      <div className={cn("min-h-0 flex-1", customizing && "pointer-events-none select-none opacity-80")} aria-hidden={customizing || undefined}>
        {Component ? <Component widget={widget} def={def} onSettingsChange={onSettingsChange} /> : <p className="p-4 text-xs text-muted-foreground">This card isn&apos;t available.</p>}
      </div>
    </div>
  );
}
