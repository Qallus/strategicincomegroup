"use client";

import * as React from "react";
import { useMounted, type WidgetProps } from "./shell";

export default function ClockWidget({ widget }: WidgetProps) {
  const seconds = widget.settings.seconds === true;
  const hour12 = widget.settings.hour12 !== false;
  const mounted = useMounted();
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), seconds ? 1000 : 5000);
    return () => clearInterval(t);
  }, [seconds]);

  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", ...(seconds ? { second: "2-digit" } : {}), hour12 });
  const [clock, meridiem] = hour12 ? [time.replace(/\s?[AP]M$/i, ""), time.match(/[AP]M$/i)?.[0] ?? ""] : [time, ""];
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="flex h-full min-h-[7.5rem] flex-col justify-between gap-3 p-4" aria-live="off">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{mounted ? now.toLocaleDateString("en-US", { weekday: "long" }) : " "}</p>
        <p className="mt-0.5 text-sm font-medium">{mounted ? now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : " "}</p>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="font-semibold leading-none tracking-tight tabular-nums">
          <span className="text-3xl">{mounted ? clock : "--:--"}</span>
          {meridiem && mounted ? <span className="ml-1 text-sm text-muted-foreground">{meridiem}</span> : null}
        </p>
        <span className="truncate text-[10px] text-muted-foreground/80">{mounted ? tz.replace(/_/g, " ").split("/").pop() : ""}</span>
      </div>
    </div>
  );
}
