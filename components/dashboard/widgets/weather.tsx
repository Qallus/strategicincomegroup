"use client";

import * as React from "react";
import { Droplets, MapPin, Wind } from "lucide-react";
import { widgetRequest, widgetRefreshMs } from "@/lib/dashboard/requests";
import type { WeatherReport } from "@/lib/weather/open-meteo";
import { useWidgetData } from "../use-widget-data";
import { WeatherIcon } from "./weather-icon";
import { WidgetError, type WidgetProps } from "./shell";

const DAY = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });

export default function WeatherWidget({ widget, preview }: WidgetProps) {
  const req = React.useMemo(() => widgetRequest(widget), [widget]);
  const { data, error, status, loading, refresh } = useWidgetData<WeatherReport>(req, { refreshMs: preview ? 0 : widgetRefreshMs(widget) });
  const large = widget.size !== "s";

  if (loading && !data) {
    return (
      <div className="flex h-full min-h-[7.5rem] items-center gap-3 p-4">
        <div className="sig-skeleton h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="sig-skeleton h-6 w-16" />
          <div className="sig-skeleton h-3 w-24" />
        </div>
      </div>
    );
  }
  if (error || !data) return <div className="p-4"><WidgetError error={error ?? "Weather is unavailable."} status={status} onRetry={refresh} /></div>;

  return (
    <div className="flex h-full min-h-[7.5rem] flex-col justify-between gap-3 p-4">
      <div className="flex items-center gap-3">
        <WeatherIcon condition={data.condition} isDay={data.isDay} className="h-12 w-12 shrink-0" />
        <div className="min-w-0">
          <p className="text-3xl font-semibold leading-none tracking-tight tabular-nums">
            {data.temperature}
            <span className="align-top text-lg text-muted-foreground">°F</span>
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{data.label}</p>
        </div>
        {large ? (
          <div className="ml-auto hidden shrink-0 space-y-1 text-right text-[11px] text-muted-foreground sm:block">
            <p className="flex items-center justify-end gap-1"><Droplets className="h-3 w-3" aria-hidden /> {data.humidity}%</p>
            <p className="flex items-center justify-end gap-1"><Wind className="h-3 w-3" aria-hidden /> {data.wind} mph</p>
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1 truncate">
          <MapPin className="h-3 w-3 shrink-0 text-brand-gold" aria-hidden />
          {data.location}
        </span>
        {data.high != null ? <span className="shrink-0 tabular-nums">H {data.high}° · L {data.low}°</span> : null}
      </div>
      {large && data.daily.length > 1 ? (
        <div className="grid grid-cols-3 gap-1.5 border-t border-border/60 pt-2.5">
          {data.daily.slice(1, 4).map((d) => (
            <div key={d.date} className="flex flex-col items-center gap-0.5 rounded-lg py-1 text-[11px]">
              <span className="text-muted-foreground">{DAY(d.date)}</span>
              <WeatherIcon condition={d.condition} className="h-6 w-6" />
              <span className="tabular-nums">{d.high}° <span className="text-muted-foreground">{d.low}°</span></span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
