import { setIcon } from "obsidian";
import { moonPhase } from "../core/moon";
import { airQualityUrl, forecastUrl, geocodeUrl, parseAqi, parseForecast, parseGeocode, weatherLabel, type Weather } from "../core/weather";
import { loadPanel, type PanelState } from "../data/panelLoader";
import { fetchJson } from "../obsidian/http";
import type { HomeView } from "./HomeView";
import { aliveFlag, panelFrame, renderStatus, TICK_MS } from "./panel";

const WEATHER_MS = 15 * 60_000;
interface WeatherData { weather: Weather; aqi: number | null }

const deg = (n: number) => `${Math.round(n)}°`;
const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const hourLabel = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: "numeric" }).replace(/\s?([AP])M/i, (_, a: string) => a.toLowerCase());

export function mountWeather(view: HomeView, panelEl: HTMLElement, bannerLineEl: HTMLElement): void {
  const { plugin } = view;
  const cfg = plugin.configStore.config!.weather;
  const sec = view.section();
  const alive = aliveFlag(sec);
  const f = panelFrame(panelEl, "Weather");

  const start = (lat: number, lon: number, label: string) => {
    if (!alive()) return;
    f.label.firstElementChild!.setText(`Weather · ${label}`);
    const load = (force: boolean) =>
      loadPanel<WeatherData>({
        cache: plugin.cache,
        key: `weather:${lat},${lon},${cfg.units}`,
        maxAgeMs: WEATHER_MS,
        force,
        isValid: (v) => Array.isArray((v as WeatherData | null)?.weather?.daily),
        fetch: async () => {
          const [fc, aq] = await Promise.all([
            fetchJson(forecastUrl(lat, lon, cfg.units)),
            fetchJson(airQualityUrl(lat, lon)).catch(() => null), // AQI is optional
          ]);
          const weather = parseForecast(fc);
          if (!weather) throw new Error("unexpected forecast data");
          return { weather, aqi: parseAqi(aq) };
        },
        onUpdate: (s) => draw(s),
      });
    sec.registerInterval(window.setInterval(() => void load(false), TICK_MS));
    void load(view.forceNext);
  };

  const draw = (s: PanelState<WeatherData>) => {
    if (!alive()) return;
    renderStatus(f.status, s);
    if (!s.data) return;
    view.report({ sunset: { at: Date.parse(s.data.weather.sunset), label: clock(s.data.weather.sunset) } });
    drawPanel(f.body, s.data, cfg.units);
    drawBannerLine(bannerLineEl, s.data.weather);
  };

  if (cfg.lat !== undefined && cfg.lon !== undefined) {
    start(cfg.lat, cfg.lon, cfg.place ?? `${cfg.lat}, ${cfg.lon}`);
  } else if (cfg.place) {
    const place = cfg.place;
    void loadPanel<{ lat: number; lon: number; label: string }>({
      cache: plugin.cache,
      key: `geo:${place}`,
      maxAgeMs: Infinity,
      fetch: async () => {
        const g = parseGeocode(await fetchJson(geocodeUrl(place)), place);
        if (!g) throw new Error(`couldn't find “${place}”`);
        return g;
      },
      onUpdate: (s) => {
        if (s.data) start(s.data.lat, s.data.lon, s.data.label);
        else if (s.error) renderStatus(f.status, s);
      },
    });
  } else {
    f.body.createDiv({ cls: "hw-muted", text: "Set weather.place in your config note." });
  }
}

function drawBannerLine(el: HTMLElement, w: Weather): void {
  el.empty();
  const icon = el.createSpan({ cls: "hw-inline-icon" });
  setIcon(icon, weatherLabel(w.now.code, w.now.isDay).icon);
  const t = w.daily[1];
  el.createSpan({ text: ` ${deg(w.now.temp)} now` + (t ? ` · Tomorrow H${deg(t.max)} L${deg(t.min)} · ${t.precipPct}% rain` : "") });
}

function drawPanel(body: HTMLElement, { weather: w, aqi }: WeatherData, units: "imperial" | "metric"): void {
  body.empty();
  const label = weatherLabel(w.now.code, w.now.isDay);

  const now = body.createDiv({ cls: "hw-wx-now" });
  setIcon(now.createSpan({ cls: "hw-inline-icon" }), label.icon);
  now.createSpan({ cls: "hw-strong", text: ` ${label.text} · ${deg(w.now.temp)}${units === "imperial" ? "F" : "C"}` });
  now.createSpan({ cls: "hw-muted", text: ` feels ${deg(w.now.feelsLike)}${aqi !== null ? ` · AQI ${aqi}` : ""}` });

  // Hourly bars for today, current hour highlighted.
  const temps = w.hourly.map((h) => h.temp);
  const lo = Math.min(...temps), hi = Math.max(...temps), span = hi - lo || 1;
  const nowHour = new Date().getHours();
  const bars = body.createDiv({ cls: "hw-bars" });
  for (const h of w.hourly) {
    const bar = bars.createDiv({ cls: h.hour === nowHour ? "hw-bar hw-bar-now" : "hw-bar", attr: { title: `${hourLabel(h.hour)} ${deg(h.temp)}` } });
    bar.style.setProperty("--h", `${20 + ((h.temp - lo) / span) * 80}%`);
  }
  const ticks = body.createDiv({ cls: "hw-bar-ticks hw-faint" });
  for (const h of [6, 14, 22]) ticks.createSpan({ text: hourLabel(h) }).style.setProperty("--col", String(h + 1));

  // 7-day ranges positioned on the week's overall min/max.
  const wLo = Math.min(...w.daily.map((d) => d.min)), wHi = Math.max(...w.daily.map((d) => d.max)), wSpan = wHi - wLo || 1;
  const days = body.createDiv({ cls: "hw-days" });
  w.daily.forEach((d, i) => {
    const row = days.createDiv({ cls: "hw-row hw-day" });
    const name = i === 0 ? "Today" : new Date(`${d.date}T12:00`).toLocaleDateString(undefined, { weekday: "short" });
    row.createSpan({ cls: "hw-day-name", text: name });
    const range = row.createDiv({ cls: "hw-range" }).createDiv({ cls: "hw-range-fill" });
    range.style.setProperty("--from", `${((d.min - wLo) / wSpan) * 100}%`);
    range.style.setProperty("--to", `${100 - ((d.max - wLo) / wSpan) * 100}%`);
    row.createSpan({ cls: "hw-day-temps", text: `${Math.round(d.min)}/${Math.round(d.max)}` });
    row.createSpan({ cls: "hw-day-rain hw-muted", text: d.precipPct >= 20 ? `${d.precipPct}%` : "" });
  });

  const dayMs = new Date(w.sunset).getTime() - new Date(w.sunrise).getTime();
  const moon = moonPhase(new Date());
  const sun = body.createDiv({ cls: "hw-faint hw-wx-sun" });
  sun.createDiv({ text: `☀ ${clock(w.sunrise)} – ${clock(w.sunset)} · ${Math.floor(dayMs / 3_600_000)}h ${Math.round((dayMs % 3_600_000) / 60_000)}m` });
  sun.createDiv({ text: `◐ ${moon.name} · ${Math.round(moon.illumination * 100)}%` });
}
