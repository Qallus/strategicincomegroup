import "server-only";

// Weather from Open-Meteo (free, no key). Cached in memory for 10 minutes per location.
// Location = the user's office (Chandler / Peoria from their team profile), else Phoenix.

export type WeatherLocationId = "chandler" | "peoria" | "phoenix";

export const WEATHER_LOCATIONS: Record<WeatherLocationId, { name: string; lat: number; lon: number }> = {
  chandler: { name: "Chandler", lat: 33.3062, lon: -111.8413 },
  peoria: { name: "Peoria", lat: 33.5806, lon: -112.2374 },
  phoenix: { name: "Phoenix", lat: 33.4484, lon: -112.074 },
};

export type WeatherCondition = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm";

export type WeatherReport = {
  location: string;
  locationId: WeatherLocationId;
  temperature: number;
  feelsLike: number;
  humidity: number;
  wind: number;
  code: number;
  condition: WeatherCondition;
  label: string;
  isDay: boolean;
  high: number | null;
  low: number | null;
  daily: { date: string; high: number; low: number; condition: WeatherCondition; label: string }[];
  fetchedAt: string;
};

const TTL_MS = 10 * 60 * 1000;
const cache = new Map<WeatherLocationId, { at: number; report: WeatherReport }>();

/** WMO weather interpretation codes → condition + label. */
export function describeWeatherCode(code: number): { condition: WeatherCondition; label: string } {
  if (code === 0) return { condition: "clear", label: "Clear" };
  if (code === 1) return { condition: "partly", label: "Mostly clear" };
  if (code === 2) return { condition: "partly", label: "Partly cloudy" };
  if (code === 3) return { condition: "cloudy", label: "Overcast" };
  if (code === 45 || code === 48) return { condition: "fog", label: "Fog" };
  if (code >= 51 && code <= 57) return { condition: "drizzle", label: "Drizzle" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { condition: "rain", label: code >= 80 ? "Showers" : "Rain" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { condition: "snow", label: "Snow" };
  if (code >= 95) return { condition: "storm", label: "Thunderstorms" };
  return { condition: "cloudy", label: "Cloudy" };
}

export async function getWeather(locationId: WeatherLocationId): Promise<WeatherReport> {
  const hit = cache.get(locationId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.report;

  const loc = WEATHER_LOCATIONS[locationId];
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(loc.lat));
  url.searchParams.set("longitude", String(loc.lon));
  url.searchParams.set("current", "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("timezone", "America/Phoenix");
  url.searchParams.set("forecast_days", "4");

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const j = (await res.json()) as {
      current?: { temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; weather_code: number; is_day: number; wind_speed_10m: number };
      daily?: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] };
    };
    if (!j.current) throw new Error("Open-Meteo returned no current conditions.");
    const d = describeWeatherCode(j.current.weather_code);
    const daily = (j.daily?.time ?? []).map((date, i) => {
      const dd = describeWeatherCode(j.daily!.weather_code[i]);
      return { date, high: Math.round(j.daily!.temperature_2m_max[i]), low: Math.round(j.daily!.temperature_2m_min[i]), condition: dd.condition, label: dd.label };
    });
    const report: WeatherReport = {
      location: loc.name,
      locationId,
      temperature: Math.round(j.current.temperature_2m),
      feelsLike: Math.round(j.current.apparent_temperature),
      humidity: Math.round(j.current.relative_humidity_2m),
      wind: Math.round(j.current.wind_speed_10m),
      code: j.current.weather_code,
      condition: d.condition,
      label: d.label,
      isDay: j.current.is_day === 1,
      high: daily[0]?.high ?? null,
      low: daily[0]?.low ?? null,
      daily,
      fetchedAt: new Date().toISOString(),
    };
    cache.set(locationId, { at: Date.now(), report });
    return report;
  } catch (e) {
    if (hit) return hit.report; // serve stale rather than nothing
    throw e instanceof Error ? e : new Error("Weather is unavailable.");
  }
}

/** Office name (team profile) → weather location. */
export function locationForOffice(office: string | null | undefined): WeatherLocationId {
  const o = (office ?? "").toLowerCase();
  if (o.includes("east") || o.includes("chandler")) return "chandler";
  if (o.includes("west") || o.includes("peoria")) return "peoria";
  return "phoenix";
}
