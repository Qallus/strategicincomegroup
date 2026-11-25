"use client";

import { cn } from "@/lib/utils";
import type { WeatherCondition } from "@/lib/weather/open-meteo";

// Animated weather glyphs (inline SVG). Motion classes live in app/globals.css
// (sig-wx-*) and are disabled under prefers-reduced-motion.

const SUN = "#f2b544";
const SUN_CORE = "#f7c65f";
const MOON = "#e7dcc2";
const CLOUD = "hsl(var(--muted-foreground) / 0.18)";
const CLOUD_STROKE = "hsl(var(--muted-foreground) / 0.55)";
const RAIN = "#3b82f6";

function Sun({ cx = 24, cy = 24, r = 8, small = false }: { cx?: number; cy?: number; r?: number; small?: boolean }) {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const r1 = r + (small ? 3 : 4);
    const r2 = r + (small ? 6 : 8);
    return <line key={i} x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1} x2={cx + Math.cos(a) * r2} y2={cy + Math.sin(a) * r2} />;
  });
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 5} fill={SUN} opacity={0.18} className="sig-wx-glow" />
      <g className="sig-wx-spin" stroke={SUN} strokeWidth={2.2} strokeLinecap="round">
        {rays}
      </g>
      <circle cx={cx} cy={cy} r={r} fill={SUN_CORE} />
    </g>
  );
}

function Moon({ cx = 22, cy = 22 }: { cx?: number; cy?: number }) {
  return (
    <g className="sig-wx-glow">
      <path d={`M${cx + 6} ${cy - 9} a10 10 0 1 0 6 16 a8 8 0 0 1 -6 -16z`} fill={MOON} />
      <circle cx={cx + 13} cy={cy - 8} r={0.9} fill={MOON} />
      <circle cx={cx - 9} cy={cy - 6} r={0.7} fill={MOON} />
    </g>
  );
}

function Cloud({ x = 0, y = 0, scale = 1, className }: { x?: number; y?: number; scale?: number; className?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} className={className}>
      <path
        d="M14 36h20a8 8 0 0 0 0-16 11 11 0 0 0-21-2 7 7 0 0 0 1 18z"
        fill="hsl(var(--card))"
        stroke={CLOUD_STROKE}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <path d="M14 36h20a8 8 0 0 0 0-16 11 11 0 0 0-21-2 7 7 0 0 0 1 18z" fill={CLOUD} />
    </g>
  );
}

export function WeatherIcon({ condition, isDay = true, className }: { condition: WeatherCondition; isDay?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("h-12 w-12 overflow-visible", className)} role="img" aria-hidden>
      {condition === "clear" ? isDay ? <Sun /> : <Moon /> : null}
      {condition === "partly" ? (
        <>
          {isDay ? <Sun cx={17} cy={17} r={6.5} small /> : <Moon cx={16} cy={18} />}
          <Cloud x={4} y={4} className="sig-wx-drift" />
        </>
      ) : null}
      {condition === "cloudy" ? (
        <>
          <Cloud x={-4} y={-4} scale={0.8} className="sig-wx-drift" />
          <Cloud x={4} y={3} className="sig-wx-drift" />
        </>
      ) : null}
      {condition === "fog" ? (
        <>
          <Cloud x={2} y={-4} className="sig-wx-drift" />
          {[36, 41].map((y, i) => (
            <line key={y} x1={10} x2={38} y1={y} y2={y} stroke={CLOUD_STROKE} strokeWidth={2} strokeLinecap="round" className="sig-wx-fog" style={{ animationDelay: `${i * 0.6}s` }} />
          ))}
        </>
      ) : null}
      {condition === "drizzle" || condition === "rain" ? (
        <>
          <Cloud x={2} y={-6} className="sig-wx-drift" />
          {(condition === "rain" ? [16, 22, 28, 34] : [19, 27]).map((x, i) => (
            <line key={x} x1={x} x2={x - 2} y1={34} y2={39} stroke={RAIN} strokeWidth={2} strokeLinecap="round" className="sig-wx-rain" style={{ animationDelay: `${i * 0.27}s` }} />
          ))}
        </>
      ) : null}
      {condition === "snow" ? (
        <>
          <Cloud x={2} y={-6} className="sig-wx-drift" />
          {[16, 24, 32].map((x, i) => (
            <g key={x} className="sig-wx-snow" style={{ animationDelay: `${i * 0.7}s` }}>
              <circle cx={x} cy={37} r={1.8} fill="#9ec5ff" />
            </g>
          ))}
        </>
      ) : null}
      {condition === "storm" ? (
        <>
          <Cloud x={2} y={-6} className="sig-wx-drift" />
          <path d="M25 31l-5 8h4l-3 7 8-10h-4l3-5z" fill={SUN} className="sig-wx-flash" />
          {[15, 33].map((x, i) => (
            <line key={x} x1={x} x2={x - 2} y1={34} y2={39} stroke={RAIN} strokeWidth={2} strokeLinecap="round" className="sig-wx-rain" style={{ animationDelay: `${i * 0.4}s` }} />
          ))}
        </>
      ) : null}
    </svg>
  );
}
