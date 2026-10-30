// Open-Meteo forecast, air quality and geocoding (no API key needed).

export interface Weather {
  now: { temp: number; feelsLike: number; code: number; isDay: boolean };
  hourly: { hour: number; temp: number }[];
  daily: { date: string; min: number; max: number; precipPct: number; code: number }[];
  sunrise: string;
  sunset: string;
}

export function forecastUrl(lat: number, lon: number, units: "imperial" | "metric"): string {
  const p = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,apparent_temperature,weather_code,is_day",
    hourly: "temperature_2m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
    timezone: "auto",
    forecast_days: "7",
  });
  if (units === "imperial") p.set("temperature_unit", "fahrenheit");
  return `https://api.open-meteo.com/v1/forecast?${p.toString()}`;
}

export function airQualityUrl(lat: number, lon: number): string {
  return `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi&timezone=auto`;
}

const placeParts = (place: string) => place.split(",").map((s) => s.trim()).filter(Boolean);

export function geocodeUrl(place: string): string {
  return `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(placeParts(place)[0] ?? "")}&count=10&format=json`;
}

type Num = number | null | undefined;
const nums = (v: unknown): Num[] | null => (Array.isArray(v) ? (v as Num[]) : null);
const strs = (v: unknown): string[] | null => (Array.isArray(v) ? (v as string[]) : null);

export function parseForecast(json: unknown): Weather | null {
  const j = json as {
    current?: Record<string, unknown>;
    hourly?: Record<string, unknown>;
    daily?: Record<string, unknown>;
  } | null;
  const c = j?.current, h = j?.hourly, d = j?.daily;
  if (!c || !h || !d) return null;
  const hourT = nums(h.temperature_2m), dayDates = strs(d.time);
  const max = nums(d.temperature_2m_max), min = nums(d.temperature_2m_min);
  const pp = nums(d.precipitation_probability_max), dc = nums(d.weather_code);
  const sunrise = strs(d.sunrise), sunset = strs(d.sunset);
  if (typeof c.temperature_2m !== "number" || !hourT || !dayDates || !max || !min || !sunrise || !sunset) return null;

  return {
    now: {
      temp: c.temperature_2m,
      feelsLike: typeof c.apparent_temperature === "number" ? c.apparent_temperature : c.temperature_2m,
      code: typeof c.weather_code === "number" ? c.weather_code : -1,
      isDay: c.is_day === 1,
    },
    hourly: hourT.slice(0, 24).map((temp, hour) => ({ hour, temp: temp ?? NaN })),
    daily: dayDates.slice(0, 7).map((date, i) => ({
      date,
      min: min[i] ?? NaN,
      max: max[i] ?? NaN,
      precipPct: pp?.[i] ?? 0,
      code: dc?.[i] ?? -1,
    })),
    sunrise: sunrise[0] ?? "",
    sunset: sunset[0] ?? "",
  };
}

export function parseAqi(json: unknown): number | null {
  const v = (json as { current?: { us_aqi?: unknown } } | null)?.current?.us_aqi;
  return typeof v === "number" ? v : null;
}

interface GeoResult { name?: string; admin1?: string; country?: string; country_code?: string; latitude?: number; longitude?: number }

export function parseGeocode(json: unknown, place: string): { lat: number; lon: number; label: string } | null {
  const results = (json as { results?: GeoResult[] } | null)?.results;
  if (!Array.isArray(results) || results.length === 0) return null;
  const qualifiers = placeParts(place).slice(1).map((s) => s.toLowerCase());
  const fits = (r: GeoResult) =>
    qualifiers.every((q) => [r.admin1, r.country, r.country_code].some((v) => v?.toLowerCase() === q));
  const r = results.find(fits) ?? results[0]!;
  if (typeof r.latitude !== "number" || typeof r.longitude !== "number") return null;
  return { lat: r.latitude, lon: r.longitude, label: [r.name, r.admin1].filter(Boolean).join(", ") };
}

/** WMO weather code → short text and a Lucide icon id. */
export function weatherLabel(code: number, isDay: boolean): { text: string; icon: string } {
  const clear = isDay ? "sun" : "moon";
  const partly = isDay ? "cloud-sun" : "cloud-moon";
  const table: Record<number, [string, string]> = {
    0: ["Clear", clear], 1: ["Mainly Clear", clear], 2: ["Partly Cloudy", partly], 3: ["Overcast", "cloud"],
    45: ["Fog", "cloud-fog"], 48: ["Rime Fog", "cloud-fog"],
    51: ["Light Drizzle", "cloud-drizzle"], 53: ["Drizzle", "cloud-drizzle"], 55: ["Heavy Drizzle", "cloud-drizzle"],
    56: ["Freezing Drizzle", "cloud-drizzle"], 57: ["Freezing Drizzle", "cloud-drizzle"],
    61: ["Light Rain", "cloud-rain"], 63: ["Rain", "cloud-rain"], 65: ["Heavy Rain", "cloud-rain"],
    66: ["Freezing Rain", "cloud-rain"], 67: ["Freezing Rain", "cloud-rain"],
    71: ["Light Snow", "cloud-snow"], 73: ["Snow", "cloud-snow"], 75: ["Heavy Snow", "cloud-snow"], 77: ["Snow Grains", "cloud-snow"],
    80: ["Rain Showers", "cloud-rain"], 81: ["Rain Showers", "cloud-rain"], 82: ["Heavy Rain Showers", "cloud-rain"],
    85: ["Snow Showers", "cloud-snow"], 86: ["Snow Showers", "cloud-snow"],
    95: ["Thunderstorm", "cloud-lightning"], 96: ["Thunderstorm, Hail", "cloud-lightning"], 99: ["Thunderstorm, Hail", "cloud-lightning"],
  };
  const [text, icon] = table[code] ?? ["Unknown", "cloud"];
  return { text, icon };
}
