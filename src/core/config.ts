// Shape and validation of the YAML block in the user's config note.
// Pure: no `obsidian` import, so it is unit-tested directly.

export type ButtonAction =
  | { command: string }
  | { file: string }
  | { url: string }
  | { builtin: "add-bill" | "add-today" | "open-daily" };

export interface ButtonConfig { label: string; icon?: string; primary?: boolean; action: ButtonAction }
export interface FeedConfig { url: string; title: string; limit?: number }
export interface NewsGroupConfig {
  title: string;
  style: "cards" | "list";
  limit: number;
  collapseAfter: number;
  cacheMinutes: number;
  feeds: FeedConfig[];
}
export interface MarketConfig { symbol: string; name: string }
export interface MarketGroupConfig { title: string; collapseAfter: number; markets: MarketConfig[] }
export interface WeatherConfig { place?: string; lat?: number; lon?: number; units: "imperial" | "metric" }
export interface BannerConfig { fearGreed: boolean; clock: boolean; marketSession: boolean; wire: boolean; summary: boolean }
export interface ClippingsConfig { folder: string; limit: number }
export interface HomeConfig {
  banner: BannerConfig;
  clippings: ClippingsConfig | null;
  weather: WeatherConfig;
  buttons: ButtonConfig[];
  news: NewsGroupConfig[];
  markets: MarketGroupConfig[];
}

const BUILTINS = ["add-bill", "add-today", "open-daily"] as const;

export function extractYamlBlock(markdown: string): string | null {
  const m = /^```ya?ml[^\n]*\n([\s\S]*?)^```/m.exec(markdown);
  return m ? (m[1] ?? "") : null;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

export function validateConfig(raw: unknown): { config: HomeConfig | null; errors: string[] } {
  if (!isObj(raw)) return { config: null, errors: ["config must be a YAML mapping"] };
  const errors: string[] = [];

  const str = (v: unknown, path: string): string => {
    if (!isStr(v)) errors.push(`${path} must be a non-empty string`);
    return isStr(v) ? v : "";
  };
  const num = (v: unknown, path: string, fallback: number, min = -Infinity): number => {
    if (v === undefined) return fallback;
    if (typeof v !== "number" || !Number.isFinite(v)) errors.push(`${path} must be a number`);
    else if (v < min) errors.push(`${path} must be at least ${min}`);
    return typeof v === "number" ? v : fallback;
  };
  const list = (v: unknown, path: string): unknown[] => {
    if (v === undefined) return [];
    if (!Array.isArray(v)) {
      errors.push(`${path} must be a list`);
      return [];
    }
    return v;
  };

  // weather
  const w = raw.weather === undefined ? {} : raw.weather;
  const weather: WeatherConfig = { units: "imperial" };
  if (!isObj(w)) errors.push("weather must be a mapping");
  else {
    if (w.units !== undefined) {
      if (w.units === "imperial" || w.units === "metric") weather.units = w.units;
      else errors.push("weather.units must be 'imperial' or 'metric'");
    }
    if (w.place !== undefined) weather.place = str(w.place, "weather.place");
    if (w.lat !== undefined || w.lon !== undefined) {
      weather.lat = num(w.lat, "weather.lat", NaN);
      weather.lon = num(w.lon, "weather.lon", NaN);
      if (Number.isNaN(weather.lat) || Number.isNaN(weather.lon)) errors.push("weather.lat and weather.lon must be given together");
    }
  }

  // buttons
  const buttons: ButtonConfig[] = list(raw.buttons, "buttons").map((b, i) => {
    const p = `buttons[${i}]`;
    if (!isObj(b)) {
      errors.push(`${p} must be a mapping`);
      return { label: "", action: { command: "" } };
    }
    const a = b.action;
    let action: ButtonAction | null = null;
    if (isObj(a)) {
      if (isStr(a.command)) action = { command: a.command };
      else if (isStr(a.file)) action = { file: a.file };
      else if (isStr(a.url)) action = { url: a.url };
      else if (BUILTINS.includes(a.builtin as (typeof BUILTINS)[number])) action = { builtin: a.builtin as (typeof BUILTINS)[number] };
    }
    if (!action) errors.push(`${p}.action must have one of command, file, url or builtin (${BUILTINS.join(", ")})`);
    const btn: ButtonConfig = { label: str(b.label, `${p}.label`), action: action ?? { command: "" } };
    if (b.icon !== undefined) btn.icon = str(b.icon, `${p}.icon`);
    if (b.primary !== undefined) btn.primary = b.primary === true;
    return btn;
  });

  // news
  const news: NewsGroupConfig[] = list(raw.news, "news").map((g, i) => {
    const p = `news[${i}]`;
    if (!isObj(g)) {
      errors.push(`${p} must be a mapping`);
      return { title: "", style: "list", limit: 14, collapseAfter: 6, cacheMinutes: 15, feeds: [] };
    }
    let style: "cards" | "list" = "list";
    if (g.style !== undefined) {
      if (g.style === "cards" || g.style === "list") style = g.style;
      else errors.push(`${p}.style must be 'cards' or 'list'`);
    }
    const feeds = list(g.feeds, `${p}.feeds`).map((f, j) => {
      const fp = `${p}.feeds[${j}]`;
      if (!isObj(f)) {
        errors.push(`${fp} must be a mapping`);
        return { url: "", title: "" };
      }
      const feed: FeedConfig = { url: str(f.url, `${fp}.url`), title: str(f.title, `${fp}.title`) };
      if (f.limit !== undefined) feed.limit = num(f.limit, `${fp}.limit`, 0, 0);
      return feed;
    });
    if (feeds.length === 0) errors.push(`${p}.feeds must list at least one feed`);
    return {
      title: str(g.title, `${p}.title`),
      style,
      limit: num(g.limit, `${p}.limit`, 14, 0),
      collapseAfter: num(g.collapseAfter, `${p}.collapseAfter`, 6, 0),
      cacheMinutes: num(g.cacheMinutes, `${p}.cacheMinutes`, 15, 1),
      feeds,
    };
  });

  // markets
  const markets: MarketGroupConfig[] = list(raw.markets, "markets").map((g, i) => {
    const p = `markets[${i}]`;
    if (!isObj(g)) {
      errors.push(`${p} must be a mapping`);
      return { title: "", collapseAfter: 6, markets: [] };
    }
    return {
      title: str(g.title, `${p}.title`),
      collapseAfter: num(g.collapseAfter, `${p}.collapseAfter`, 6, 0),
      markets: list(g.markets, `${p}.markets`).map((m, j) => {
        const mp = `${p}.markets[${j}]`;
        if (!isObj(m)) {
          errors.push(`${mp} must be a mapping`);
          return { symbol: "", name: "" };
        }
        return { symbol: str(m.symbol, `${mp}.symbol`), name: str(m.name, `${mp}.name`) };
      }),
    };
  });

  // banner
  const banner: BannerConfig = { fearGreed: false, clock: true, marketSession: true, wire: true, summary: true };
  if (raw.banner !== undefined) {
    if (!isObj(raw.banner)) errors.push("banner must be a mapping");
    else {
      for (const key of ["fearGreed", "clock", "marketSession", "wire", "summary"] as const) {
        const v = raw.banner[key];
        if (v === undefined) continue;
        if (typeof v === "boolean") banner[key] = v;
        else errors.push(`banner.${key} must be true or false`);
      }
    }
  }

  // clippings (false hides the panel)
  let clippings: ClippingsConfig | null = { folder: "Clippings", limit: 5 };
  if (raw.clippings === false) clippings = null;
  else if (raw.clippings !== undefined) {
    if (!isObj(raw.clippings)) errors.push("clippings must be a mapping or false");
    else {
      clippings = {
        folder: raw.clippings.folder === undefined ? "Clippings" : str(raw.clippings.folder, "clippings.folder"),
        limit: num(raw.clippings.limit, "clippings.limit", 5, 1),
      };
    }
  }

  if (errors.length) return { config: null, errors };
  return { config: { banner, clippings, weather, buttons, news, markets }, errors };
}

/** Cache key that changes whenever the group's sources change, not just its title. */
export function groupCacheKey(kind: string, title: string, parts: string[]): string {
  let h = 0x811c9dc5; // FNV-1a
  for (const ch of parts.join("\n")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${kind}:${title}:${h.toString(36)}`;
}

/** A vault note path from a user-typed setting: slashes collapsed, no leading slash, `.md` added. */
export function notePath(raw: string): string {
  const p = raw.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
  return p.toLowerCase().endsWith(".md") ? p : `${p}.md`;
}

/** Vault paths a `{ file: … }` button may mean, most specific first: a bare name can be a folder or a note. */
export function fileTargets(raw: string): string[] {
  const p = raw.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
  if (/\.[a-z0-9]+$/i.test(p)) return [p];
  return [p, `${p}.md`];
}

export const DEFAULT_CONFIG_NOTE = `This note configures your Homewire page. Edit the YAML below; the page updates when you save.
Set \`weather.place\` (or \`lat\` and \`lon\`) to see the weather.

\`\`\`yaml
banner:
  clock: true              # large clock
  marketSession: true      # US market pre-market / open / after hours / closed
  wire: true               # rotating headline from all your news groups
  summary: true            # one line: open tasks, next bill, sunset
  fearGreed: false         # CNN Fear & Greed index (unofficial source; may stop working)

clippings:                 # newest notes saved by Obsidian Web Clipper; "false" hides the panel
  folder: Clippings
  limit: 5

weather:
  units: imperial          # or metric
  # place: Paris, France   # a place name, looked up once
  # lat: 48.85             # or exact coordinates
  # lon: 2.35

buttons:
  - label: "+ Capture"
    primary: true
    action: { builtin: add-today }
  - label: Daily
    action: { builtin: open-daily }
  - label: Search
    action: { command: "global-search:open" }
  - label: Bills
    action: { builtin: add-bill }

news:
  - title: Top Stories
    style: cards
    limit: 12
    collapseAfter: 6
    cacheMinutes: 15
    feeds:
      - { title: BBC World, url: "https://feeds.bbci.co.uk/news/world/rss.xml", limit: 6 }
      - { title: Hacker News, url: "https://hnrss.org/frontpage", limit: 6 }

markets:
  - title: Macro
    markets:
      - { symbol: "^GSPC", name: S&P 500 }
      - { symbol: "^DJI", name: Dow }
      - { symbol: "^IXIC", name: Nasdaq }
  - title: Crypto
    markets:
      - { symbol: BTC-USD, name: Bitcoin }
\`\`\`
`;
