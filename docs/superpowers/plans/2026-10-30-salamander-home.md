# Salamander Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An Obsidian community plugin, `salamander-home`, that renders a
Glance-style homepage from a `salamander-home` code block. It has a date and
weather banner, action buttons, live news, markets and weather, a Today box
fed by daily notes, a bill tracker, and a month calendar.

**Architecture:** Pure, Obsidian-free logic (parsers, date maths, config
validation, the cached panel loader) lives in `src/core` and `src/data/*.ts`
files that never import `obsidian`. It is unit-tested with Vitest. A thin
Obsidian layer (`src/obsidian/`) does HTTP through `requestUrl`, vault edits
through `vault.process`, and daily notes through
`obsidian-daily-notes-interface`. UI panels (`src/ui/`) are built with
`createEl` inside one `MarkdownRenderChild`, which is mounted by a code-block
processor.

**Tech Stack:** TypeScript 7.0.2, esbuild 0.28.2, obsidian (types) 1.14.4,
obsidian-daily-notes-interface 0.9.5, Vitest 5.0.5 + happy-dom 21.0.4,
eslint-plugin-obsidianmd 0.4.2, yaml 2.9.1 (dev only, for tests).

**Spec:** `docs/superpowers/specs/2026-10-30-homepage-design.md`. Read it
before starting any task. The mockup `docs/superpowers/specs/mockups/layout-v2.html`
is the visual target.

## Global Constraints

- Plugin id `salamander-home`, name `Salamander Home`, `isDesktopOnly: false`, `minAppVersion: 1.4.0`, MIT license, author `Jason`, authorUrl `https://messy.quest`.
- **Never insert feed-supplied strings as HTML.** No `innerHTML`, `outerHTML`, `insertAdjacentHTML`, or `MarkdownRenderer` on remote content. Use `createEl(tag, { text })` or `setText` only.
- Links and image `src` only allow `http:` and `https:` (`isHttpUrl`).
- Remote caches use per-device storage (`app.loadLocalStorage` / `app.saveLocalStorage`), never `data.json`.
- Vault edits to existing files go through `app.vault.process`.
- The plugin never creates vault files unless the user runs a command or clicks an add or open button.
- No personal values in code: no Roanoke, no `100.119.142.70`, no `DAILY`, no Jason feeds. They appear only in Task 14's install step.
- Refresh intervals: news = each group's `cacheMinutes`, markets 5 min, weather 15 min. Timers run only while a homepage block is mounted.
- Every panel fails on its own: an error shows faint "offline" next to the last data, or one muted line if there's no data. No modals or toasts for fetch failures.
- CSS classes use the prefix `sh-`. Inside `.sh-root`, never use `h1`–`h6` or `ul`/`li`, because Salamander restyles those inside `.markdown-rendered` (adds `//` prefixes and `>` chevrons).
- Files in `src/core/` and `src/data/` must not import `obsidian`. That's what keeps them testable.

## Review Focus

1. **A dead or hostile feed** (Bloomberg's URL returns HTML or a 403; a title contains `<img src=x onerror=…>`; a `javascript:` link) should give an empty or offline panel, literal text, and no link. Tests in Task 4.
2. **A note edited elsewhere between render and click** (LiveSync changes `Bills.md` or a daily note, so lines shift) should mean the tick lands on the right line or does nothing with a Notice. It must never tick the wrong line. Tests in Task 3 (`setTaskChecked` with a moved line). Checked by hand in Task 11 Step 4.
3. **Bill lines as people actually type them**: `$1,204.50`, no amount, uppercase `[X]`, a date typed as `11/3`, extra spaces, a `·` inside the name. Each should parse, or be skipped without being deleted. Tests in Task 3.
4. **Date edges**: due today is "due today", not late. Year boundaries in the calendar and ISO week 53. Tests in Tasks 3 and 5.
5. **Two homepage panes open at once** (split view, or a pop-out window) should mean one fetch per source, not two, and no double timers writing the cache. Test in Task 6 (in-flight dedupe).

---

## File Structure

```
manifest.json  versions.json  package.json  tsconfig.json  esbuild.config.mjs
eslint.config.mjs  vitest.config.ts  styles.css  LICENSE  README.md
.github/workflows/release.yml
src/
  main.ts                    Plugin entry: settings, commands, code-block processor
  settings.ts                SalamanderHomeSettings + SettingTab
  core/                      PURE, unit-tested
    config.ts                HomeConfig types, extractYamlBlock, validateConfig, DEFAULT_CONFIG_NOTE
    tasks.ts                 extractOpenTasks, setTaskChecked
    bills.ts                 parseBills, formatBillLine, billStatus
    rss.ts                   parseFeed, mergeGroup
    safeUrl.ts               isHttpUrl
    markets.ts               yahooChartUrl, parseYahooChart
    weather.ts               forecastUrl, airQualityUrl, geocodeUrl, parseForecast, parseAqi, parseGeocode, weatherLabel
    moon.ts                  moonPhase
    dates.ts                 localYmd, isoWeek, dayOfYear, monthGrid, daysBetween, relativeAge
  data/                      PURE, unit-tested
    cache.ts                 Cache over an injected KeyValueStore
    panelLoader.ts           loadPanel (cached-then-fresh, in-flight dedupe)
  obsidian/                  Obsidian-bound, checked by hand
    http.ts                  fetchText, fetchJson
    vaultEdits.ts            toggleTaskInFile, appendLineToFile
    dailyNotes.ts            daily-note helpers over obsidian-daily-notes-interface
    configStore.ts           ConfigStore (reads config note, keeps last good)
    createHomepage.ts        "Create homepage" command
  ui/
    HomeView.ts              MarkdownRenderChild: layout, timers, re-render wiring
    banner.ts  buttons.ts  modals.ts
    weatherPanel.ts  todayPanel.ts  newsPanel.ts
    calendarPanel.ts  billsPanel.ts  marketsPanel.ts  sparkline.ts
tests/core/*.test.ts  tests/data/*.test.ts
test-vault/                  gitignored throwaway vault for manual checks
```

---

### Task 1: Scaffold, build, lint and test tooling

**Files:**
- Create: `manifest.json`, `versions.json`, `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `styles.css`, `LICENSE`, `src/main.ts`, `tests/smoke.test.ts`
- Modify: `.gitignore` (add `test-vault/`, `data.json`)

**Interfaces:**
- Produces: `npm run build` (writes `main.js`), `npm run dev` (watch), `npm test` (vitest run), `npm run lint`, `npm run typecheck`. `export default class SalamanderHomePlugin extends Plugin` in `src/main.ts`.

- [ ] **Step 1:** Create `package.json` with the exact versions from Tech Stack (runtime dependency: `obsidian-daily-notes-interface` only; everything else is a devDependency, plus `typescript-eslint`, `@types/node` 26.6.6, `builtin-modules` 5.4.0). Scripts: `build` = `tsc --noEmit && node esbuild.config.mjs production`, `dev` = `node esbuild.config.mjs`, `test` = `vitest run`, `lint` = `eslint src tests`, `typecheck` = `tsc --noEmit`.
- [ ] **Step 2:** `esbuild.config.mjs`, following the official obsidian-sample-plugin: entry `src/main.ts`, out `main.js`, `format: 'cjs'`, `target: 'es2022'`, externals `obsidian`, `electron`, `@codemirror/*`, `@lezer/*` plus `builtin-modules`. Production minifies with no sourcemap; dev uses an inline sourcemap and watch mode.
- [ ] **Step 3:** `manifest.json` with the Global Constraints values, `version: "0.1.0"`, `description: "A Glance-style homepage: news, markets, weather, today's tasks, bills and a calendar in one note."` `versions.json`: `{"0.1.0": "1.4.0"}`. MIT `LICENSE` (copy the holder line from `~/obsidian-salamander/LICENSE`).
- [ ] **Step 4:** `src/main.ts`: a plugin class with an empty `onload`. `styles.css` contains only a header comment. `eslint.config.mjs`: flat config using `typescript-eslint` recommended plus `eslint-plugin-obsidianmd`'s recommended config (follow that package's README for the flat-config export). `vitest.config.ts`: `include: ['tests/**/*.test.ts']`, default environment `node`.
- [ ] **Step 5:** Write `tests/smoke.test.ts` with `expect(1 + 1).toBe(2)`.
- [ ] **Step 6:** Run `npm install && npm run build && npm test && npm run lint`. Expected: `main.js` exists, 1 test passes, lint exits 0.
- [ ] **Step 7:** Commit: `git add -A && git commit -m "chore: scaffold salamander-home plugin"`.

---

### Task 2: Config schema and validation

**Files:**
- Create: `src/core/config.ts`
- Test: `tests/core/config.test.ts`

**Interfaces:**
- Produces:
```ts
export type ButtonAction =
  | { command: string } | { file: string } | { url: string }
  | { builtin: 'add-bill' | 'add-today' | 'open-daily' };
export interface ButtonConfig { label: string; icon?: string; primary?: boolean; action: ButtonAction }
export interface FeedConfig { url: string; title: string; limit?: number }
export interface NewsGroupConfig { title: string; style: 'cards' | 'list'; limit: number; collapseAfter: number; cacheMinutes: number; feeds: FeedConfig[] }
export interface MarketConfig { symbol: string; name: string }
export interface MarketGroupConfig { title: string; collapseAfter: number; markets: MarketConfig[] }
export interface WeatherConfig { place?: string; lat?: number; lon?: number; units: 'imperial' | 'metric' }
export interface HomeConfig { weather: WeatherConfig; buttons: ButtonConfig[]; news: NewsGroupConfig[]; markets: MarketGroupConfig[] }
export function extractYamlBlock(markdown: string): string | null;     // body of the first ```yaml fence
export function validateConfig(raw: unknown): { config: HomeConfig | null; errors: string[] };
export const DEFAULT_CONFIG_NOTE: string;                              // full markdown of a fresh "Home Config.md"
```

- [ ] **Step 1: Write failing tests** in `tests/core/config.test.ts` (parse YAML with the `yaml` devDependency):
  - `extractYamlBlock` returns the fence body for `"intro\n```yaml\na: 1\n```\n"` → `"a: 1\n"`, and `null` when there's no yaml fence.
  - `validateConfig(parse(extractYamlBlock(DEFAULT_CONFIG_NOTE)!))` → `errors` is `[]`, and `config.weather` has no `place`, `lat` or `lon`, with `units: 'imperial'`.
  - Defaults: `buttons` labels are exactly `['+ Capture', 'Daily', 'Search', 'Bills']`. Search's action is `{ command: 'global-search:open' }`. News has at least 1 group, each with ≥1 feed. Markets includes symbols `^GSPC`, `^DJI` and `BTC-USD`.
  - Missing optional numbers get defaults: a news group without `limit`, `collapseAfter` or `cacheMinutes` → `14`, `6`, `15`, and `style` defaults to `'list'`. A market group without `collapseAfter` → `6`.
  - Invalid input reports errors and returns `config: null`. Cases: `{ news: 'x' }` → an error mentioning `news`. A feed with no `url` → an error mentioning `news[0].feeds[0].url`. `units: 'kelvin'` → an error mentioning `weather.units`. A button with no recognised action → an error mentioning `buttons[0].action`.
  - `validateConfig(null)` → `config: null` and a single error.
  - `DEFAULT_CONFIG_NOTE` doesn't contain `Roanoke`, `100.119` or `DAILY`.
- [ ] **Step 2:** Run `npx vitest run tests/core/config.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `src/core/config.ts`. Validation is hand-written (no schema library) and collects every error with a dotted path. `DEFAULT_CONFIG_NOTE` is a short markdown note: a one-paragraph explanation, then a ```yaml fence with neutral defaults. Use BBC World (`https://feeds.bbci.co.uk/news/world/rss.xml`) and Hacker News (`https://hnrss.org/frontpage`) as Top Stories (`style: cards`). Markets: Macro = `^GSPC` S&P 500, `^DJI` Dow, `^IXIC` Nasdaq; Crypto = `BTC-USD` Bitcoin. Include commented-out `place:` and `lat:`/`lon:` examples.
- [ ] **Step 4:** Run `npx vitest run tests/core/config.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: config schema, validation and default config note`.

---

### Task 3: Today tasks and bills parsing

**Files:**
- Create: `src/core/tasks.ts`, `src/core/bills.ts`, `src/core/dates.ts` (only `localYmd` and `daysBetween` for now; Task 5 adds the rest)
- Test: `tests/core/tasks.test.ts`, `tests/core/bills.test.ts`, `tests/core/dates.test.ts`

**Interfaces:**
- Produces:
```ts
// dates.ts (initial)
export function localYmd(d: Date): string;
export function daysBetween(fromYmd: string, toYmd: string): number;  // to - from, whole days; UTC-midnight maths, DST-proof
// tasks.ts
export interface OpenTask { line: number; text: string }               // line is 0-based
export function extractOpenTasks(markdown: string): OpenTask[];
export function setTaskChecked(markdown: string, line: number, expectedText: string, checked: boolean): string | null;
// bills.ts
export interface Bill { line: number; raw: string; name: string; amount: number | null; due: string; paid: boolean }
// due = 'YYYY-MM-DD'; raw = the line's text after "] " (what setTaskChecked compares against)
export type BillStatus = { kind: 'late' | 'soon' | 'upcoming'; days: number };  // days = |due - today|
export function parseBills(markdown: string): Bill[];
export function formatBillLine(input: { name: string; amount: number | null; due: string }): string;
export function billStatus(due: string, today: string): BillStatus;
```

- [ ] **Step 1: Write failing tests**:
  - `extractOpenTasks`: from `"# Day\n- [ ] call about truck\n- [x] done\n  - [ ] nested\n* [ ] star\ntext"` it returns `[{line:1,text:'call about truck'},{line:3,text:'nested'},{line:4,text:'star'}]`. `- [X] upper` counts as done. `- [ ]` with empty text is skipped.
  - `setTaskChecked(md, 1, 'call about truck', true)` returns md with line 1 as `- [x] call about truck` and every other line byte-identical (including `\r\n` endings if present).
  - **Moved line:** if the line at `line` no longer has `expectedText`, but exactly one other unchecked line does, that line is ticked. If none or several match → `null`. If the line at `line` is the task and is already checked, asking for `checked: true` → `null`.
  - `parseBills`:
    - `- [ ] Electric · $142.18 · due 2026-11-03` → `{name:'Electric', amount:142.18, due:'2026-11-03', paid:false}`.
    - `- [x] Rent · due 2026-11-01` → `amount: null`, `paid: true`.
    - `- [ ] Truck note · $1,204.50 · due 2026-12-01` → `amount: 1204.5`.
    - Extra spaces around `·` are tolerated.
    - `- [ ] Water · due 11/3` and plain prose lines are skipped. They're absent from the result, and `parseBills` never mutates input.
  - `formatBillLine({name:'Electric', amount:142.18, due:'2026-11-03'})` → `- [ ] Electric · $142.18 · due 2026-11-03`. Amount `null` drops the middle part. A name containing `·` becomes `-`. The amount always has 2 decimals.
  - `billStatus('2026-10-28','2026-10-30')` → `{kind:'late',days:2}`.
  - `billStatus('2026-10-30','2026-10-30')` → `{kind:'soon',days:0}`.
  - `billStatus('2026-11-02','2026-10-30')` → `{kind:'soon',days:3}`.
  - `billStatus('2026-11-03','2026-10-30')` → `{kind:'upcoming',days:4}`.
  - `billStatus('2027-01-02','2026-12-31')` → `{kind:'soon',days:2}` (year boundary).
  - `parseBills` sets `raw` to `Electric · $142.18 · due 2026-11-03` for the first fixture line.
  - `daysBetween('2026-12-31','2027-01-02')` → 2. Across the US DST change, `daysBetween('2026-10-31','2026-11-02')` → 2. `localYmd(new Date(2026, 9, 30, 23, 59))` → `2026-10-30`.
- [ ] **Step 2:** Run `npx vitest run tests/core/tasks.test.ts tests/core/bills.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement both. Task regex: `^(\s*)[-*] \[( |x|X)\] (.+)$`. Bill regex: `^\s*[-*] \[( |x|X)\]\s+(.+?)\s*·\s*(?:\$([\d,]+(?:\.\d{1,2})?)\s*·\s*)?due\s+(\d{4}-\d{2}-\d{2})\s*$`. `billStatus` uses `daysBetween`. `soon` means 0–3 days ahead.
- [ ] **Step 4:** Run `npx vitest run tests/core`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: parse today tasks and bill lines`.

---

### Task 4: RSS/Atom parsing and URL safety

**Files:**
- Create: `src/core/rss.ts`, `src/core/safeUrl.ts`
- Test: `tests/core/rss.test.ts` (first line `// @vitest-environment happy-dom`), `tests/core/safeUrl.test.ts`

**Interfaces:**
- Produces:
```ts
export function isHttpUrl(value: string | null | undefined): boolean;
export interface FeedItem { title: string; link: string | null; source: string; published: number | null; summary: string; image: string | null }
export function parseFeed(xml: string, source: string): FeedItem[];          // never throws
export function mergeGroup(perFeed: FeedItem[][], limit: number): FeedItem[]; // newest first, nulls last
```

- [ ] **Step 1: Write failing tests**:
  - `isHttpUrl`: `https://a.b` and `http://a.b` → true. `javascript:alert(1)`, `data:text/html,x`, `file:///etc/passwd`, `''` and `null` → false.
  - An RSS 2.0 fixture with 2 items (title, link, pubDate, a description containing `<p>Hello <b>world</b></p>`, one item with `<media:content url="https://img/x.jpg"/>`) → 2 items, `summary === 'Hello world'`, `image === 'https://img/x.jpg'`, and `published` equal to `Date.parse` of the pubDate.
  - An Atom fixture (`<entry><title>`, `<link href>`, `<updated>`, `<summary>`) → parsed the same way.
  - Image fallbacks, in order: `media:thumbnail`, then `enclosure` with `type="image/*"`, then the first `<img src>` inside the description. No candidate → `null`.
  - **Hostile:** the escaped title `&lt;img src=x onerror=alert(1)&gt;` → `title === '<img src=x onerror=alert(1)>'` (literal text, which the UI renders as text). `<link>javascript:alert(1)</link>` → `link === null`. An image URL of `javascript:…` → `image === null`.
  - **Dead feed:** `parseFeed('<!DOCTYPE html><html>403</html>', 'X')` → `[]`. `parseFeed('', 'X')` → `[]`. `parseFeed('<rss><channel>', 'X')` (truncated) → `[]` with no throw.
  - Summary is truncated to 280 characters, with `…` added when cut.
  - `mergeGroup([[a(t=1)], [b(t=3), c(null)]], 2)` → `[b, a]`.
- [ ] **Step 2:** Run `npx vitest run tests/core/rss.test.ts tests/core/safeUrl.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement with `new DOMParser().parseFromString(xml, 'text/xml')`. Detect `parsererror` and return `[]`. Reduce descriptions to text by parsing them in a separate detached `text/html` document and reading `textContent`, then collapsing whitespace. Read namespaced `media:*` elements with `getElementsByTagName('media:content')`.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: safe RSS/Atom parsing`.

---

### Task 5: Markets, weather, moon and dates

**Files:**
- Create: `src/core/markets.ts`, `src/core/weather.ts`, `src/core/moon.ts`
- Modify: `src/core/dates.ts` (add the remaining helpers)
- Test: `tests/core/markets.test.ts`, `tests/core/weather.test.ts`, `tests/core/moon.test.ts`, `tests/core/dates.test.ts` (extend)

**Interfaces:**
- Produces:
```ts
// markets.ts
export interface Quote { symbol: string; name: string; price: number; changePct: number; closes: number[]; currency: string }
export function yahooChartUrl(symbol: string): string; // https://query1.finance.yahoo.com/v8/finance/chart/<encoded>?range=1mo&interval=1d
export function parseYahooChart(json: unknown, symbol: string, name: string): Quote | null;
// weather.ts
export interface Weather {
  now: { temp: number; feelsLike: number; code: number; isDay: boolean };
  hourly: { hour: number; temp: number }[];   // today, 0–23 local
  daily: { date: string; min: number; max: number; precipPct: number; code: number }[]; // 7 days, [0] = today
  sunrise: string; sunset: string;            // local ISO 'YYYY-MM-DDTHH:mm'
}
export function forecastUrl(lat: number, lon: number, units: 'imperial' | 'metric'): string;
export function airQualityUrl(lat: number, lon: number): string;
export function geocodeUrl(place: string): string;
export function parseForecast(json: unknown): Weather | null;
export function parseAqi(json: unknown): number | null;
export function parseGeocode(json: unknown, place: string): { lat: number; lon: number; label: string } | null;
export function weatherLabel(code: number, isDay: boolean): { text: string; icon: string }; // icon = Lucide icon id
// moon.ts
export function moonPhase(at: Date): { name: string; illumination: number; waxing: boolean };
// dates.ts (added; localYmd and daysBetween already exist from Task 3)
export function isoWeek(d: Date): number;
export function dayOfYear(d: Date): number;
export function monthGrid(year: number, month0: number, weekStart: 0 | 1): { date: string; inMonth: boolean }[]; // always 42 cells
export function relativeAge(ms: number): string;                               // 'now' | '5m' | '2h' | '3d'
```

- [ ] **Step 1: Write failing tests**:
  - `parseYahooChart` (Glance's rule: drop null closes, previous = second-to-last close, `changePct = (price − previous) / previous × 100`, falling back to `0` with fewer than 2 closes): a fixture with `meta.regularMarketPrice = 105`, `meta.currency = 'USD'` and `indicators.quote[0].close = [100, null, 98, 100]` → `price 105`, `closes [100, 98, 100]`, `changePct ≈ 7.142857` (`toBeCloseTo(7.1429, 3)`). `chart.result: null` or `chart.error` set → `null`.
  - `yahooChartUrl('^GSPC')` contains `%5EGSPC`.
  - `forecastUrl(37.27, -79.94, 'imperial')` includes `temperature_unit=fahrenheit`, `timezone=auto` and `forecast_days=7`; with `'metric'` it doesn't include `fahrenheit`.
  - `parseForecast` on a trimmed Open-Meteo fixture (commit it as `tests/fixtures/open-meteo.json`) → `daily.length === 7`, `hourly.length === 24`, sunrise and sunset strings intact. Malformed input → `null`.
  - `parseAqi({ current: { us_aqi: 54 } })` → `54`, and `{}` → `null`.
  - `parseGeocode`: for place `"Roanoke, Virginia, US"`, results `[{name:'Roanoke', admin1:'Texas', …}, {name:'Roanoke', admin1:'Virginia', country_code:'US', latitude:37.27, longitude:-79.94}]` → the Virginia one. A plain `"Paris"` → the first result. No results → `null`. `geocodeUrl('Roanoke, Virginia, US')` searches `name=Roanoke`.
  - `weatherLabel(0, true)` → text `Clear`. Codes 61/63/65 → text containing `Rain`. An unknown code → `Unknown`.
  - `moonPhase(new Date('2026-10-30T10:26:00Z'))` → name `Waning Gibbous`, illumination within `0.79–0.83`, `waxing: false`. `2026-11-24T12:00Z` → `Full Moon`. `2026-11-09T12:00Z` → `New Moon`.
  - `isoWeek` on local dates: 2026-10-30 → 44, 2027-01-01 → 53, 2026-01-01 → 1, 2024-12-30 → 1. `dayOfYear(2026-10-30)` → 303.
  - `monthGrid(2026, 9, 0)[0].date` → `2026-09-27`, and `[4]` → `2026-10-01` with `inMonth: true`. `monthGrid(2026, 9, 1)[0]` → `2026-09-28`. `monthGrid(2026, 1, 0)[0]` → `2026-02-01`. `monthGrid(2026, 1, 1)[0]` → `2026-01-26`. Length is always 42.
  - `relativeAge`: `30_000` → `now`, `5*60_000` → `5m`, `2*3_600_000` → `2h`, `3*86_400_000` → `3d`.
- [ ] **Step 2:** Run `npx vitest run tests/core`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement. For the forecast, request `current=temperature_2m,apparent_temperature,weather_code,is_day`, `hourly=temperature_2m`, `daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset`. For air quality, `current=us_aqi`. Moon: synodic month `29.530588853` days, reference new moon `2000-01-06T18:14Z`, illumination `(1 - cos(2π·age/P)) / 2`. Names come from 8 equal buckets centred on new (0), first quarter, full and last quarter.
- [ ] **Step 4:** Run `npx vitest run tests/core`. Expected: all PASS.
- [ ] **Step 5:** Commit: `feat: markets, weather, moon and date helpers`.

---

### Task 6: Cache and cached panel loader

**Files:**
- Create: `src/data/cache.ts`, `src/data/panelLoader.ts`
- Test: `tests/data/cache.test.ts`, `tests/data/panelLoader.test.ts`

**Interfaces:**
- Produces:
```ts
// cache.ts
export interface KeyValueStore { load(key: string): unknown; save(key: string, value: unknown): void }
export interface CacheEntry<T> { value: T; fetchedAt: number }
export class Cache {
  constructor(store: KeyValueStore, namespace?: string /* default 'salamander-home' */, now?: () => number);
  get<T>(key: string): CacheEntry<T> | null;
  set<T>(key: string, value: T): CacheEntry<T>;
}
// panelLoader.ts
export interface PanelState<T> { data: T | null; fetchedAt: number | null; error: string | null; loading: boolean }
export function loadPanel<T>(opts: {
  cache: Cache; key: string; maxAgeMs: number; fetch: () => Promise<T>;
  onUpdate: (s: PanelState<T>) => void; force?: boolean;
}): Promise<void>;
```

- [ ] **Step 1: Write failing tests** with an in-memory `KeyValueStore` and an injected clock:
  - `Cache`: `set` then `get` round-trips, with `fetchedAt` equal to the clock. Keys are namespaced (the store sees `salamander-home:news:Top`). A corrupt stored value (a string, or an object with no `fetchedAt`) → `get` returns `null`.
  - `loadPanel` with fresh cache: `onUpdate` is called once with the cached data, `loading: false`, and `fetch` is never called.
  - Stale cache: first call → cached data with `loading: true`. Then `fetch` resolves → new data, `loading: false`, `error: null`, and the cache is updated.
  - `force: true` with fresh cache → fetches anyway.
  - `fetch` rejects with stale cache → the final state has the old data, `error` set to the message, and `loading: false`.
  - `fetch` rejects with no cache → `data: null`, `error` set.
  - **In-flight dedupe:** two `loadPanel` calls with the same `key` while the first fetch is pending → `fetch` is called once, and both `onUpdate` callbacks receive the final data.
- [ ] **Step 2:** Run `npx vitest run tests/data`. Expected: FAIL.
- [ ] **Step 3:** Implement. Keep the in-flight map at module level, `Map<string, Promise<T>>`, keyed by `namespace + key`, and delete the entry in `finally`.
- [ ] **Step 4:** Run `npx vitest run tests/data`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: per-device cache and cached panel loader`.

---

### Task 7: Obsidian adapters: HTTP, vault edits, daily notes, config store, settings, commands

**Files:**
- Create: `src/obsidian/http.ts`, `src/obsidian/vaultEdits.ts`, `src/obsidian/dailyNotes.ts`, `src/obsidian/configStore.ts`, `src/obsidian/createHomepage.ts`, `src/settings.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `setTaskChecked` (Task 3), `validateConfig`, `extractYamlBlock`, `DEFAULT_CONFIG_NOTE`, `HomeConfig` (Task 2), `KeyValueStore`, `Cache` (Task 6).
- Produces:
```ts
// http.ts
export function fetchText(url: string): Promise<string>;        // throws Error(`HTTP ${status}`) outside 200–299
export function fetchJson<T = unknown>(url: string): Promise<T>;
// vaultEdits.ts
export function toggleTaskInFile(app: App, path: string, line: number, text: string, checked: boolean): Promise<boolean>;
export function appendLineToFile(app: App, path: string, line: string): Promise<TFile>; // creates file if missing
// dailyNotes.ts
export function dailyNotesAvailable(): boolean;
export function dailyNotePath(date: moment.Moment): string;
export function getDailyNoteFile(app: App, date: moment.Moment): TFile | null;
export function getOrCreateDailyNote(app: App, date: moment.Moment): Promise<TFile>;
export function daysWithDailyNotes(): Set<string>;              // 'YYYY-MM-DD'
export function weekStart(): 0 | 1;                              // from moment.localeData().firstDayOfWeek()
// configStore.ts
export class ConfigStore extends Events {                        // emits 'change'
  constructor(app: App, getPath: () => string);
  config: HomeConfig | null; error: string | null; missing: boolean;
  load(): Promise<void>;                                         // keeps last good config on error
  register(plugin: Plugin): void;                                // vault modify/rename/delete → load()
}
// settings.ts
export interface SalamanderHomeSettings { homePath: string; configPath: string; billsPath: string }
export const DEFAULT_SETTINGS: SalamanderHomeSettings;          // 'Home.md', 'Home Config.md', 'Bills.md'
export class SalamanderHomeSettingTab extends PluginSettingTab {}
// main.ts (plugin fields used by the UI)
settings: SalamanderHomeSettings; configStore: ConfigStore; cache: Cache;
```

- [ ] **Step 1:** `http.ts`: `requestUrl({ url, throw: false, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; salamander-home)' } })`. Use `.text` or `.json`.
- [ ] **Step 2:** `vaultEdits.ts`: `toggleTaskInFile` runs `app.vault.process(file, md => setTaskChecked(...) ?? md)` and returns whether the content changed. When nothing changed, it shows `new Notice('That item changed since the page loaded — refreshed.')`. `appendLineToFile` adds the line at the end, with exactly one `\n` between it and the existing content, creating parent folders and the file if needed.
- [ ] **Step 3:** `dailyNotes.ts` over `obsidian-daily-notes-interface` (`appHasDailyNotesPluginLoaded`, `getDailyNoteSettings`, `getAllDailyNotes`, `getDailyNote`, `createDailyNote`). In `getOrCreateDailyNote`, if a template is configured but its file doesn't exist, create an empty note at `dailyNotePath` yourself instead of calling `createDailyNote` (the library shows an error notice for a missing template).
- [ ] **Step 4:** `configStore.ts` reads the note with `vault.cachedRead`, then `extractYamlBlock` → `parseYaml` → `validateConfig`. If the note is missing, set `missing = true` and `config = null`. If the YAML is invalid, keep the previous `config`, set `error` to the first message, and emit `'change'` either way. Debounce reloads by 300 ms.
- [ ] **Step 5:** `createHomepage.ts`: a command `create-homepage` ("Create homepage") that creates `homePath`, `configPath` and `billsPath` **only if missing** (never overwrites), then opens `homePath`. `Home.md` content:
  ```
  ---
  cssclasses: [sh-home]
  ---
  ```salamander-home
  ```
  `Bills.md` content: a one-line explanation plus the example line `- [ ] Example bill · $0.00 · due <today>`.
- [ ] **Step 6:** `settings.ts` and `main.ts`: load and save settings (`data.json` holds only these 3 paths). Build `cache = new Cache({ load: k => this.app.loadLocalStorage(k), save: (k, v) => this.app.saveLocalStorage(k, v) })`. Construct and register the `ConfigStore`. Register the `create-homepage` command (`add-bill` and `add-today` are registered in Task 8, alongside their modals).
- [ ] **Step 7: Manual check** in `test-vault/`. Create it with `.obsidian/plugins/salamander-home` as a symlink to the repo root, and `.obsidian/community-plugins.json` = `["salamander-home"]`. Copy `~/obsidian-salamander/theme.css` and `manifest.json` into `.obsidian/themes/Salamander/` and set it in `appearance.json`. Run `npm run build`, then **ask Jason to open `test-vault` in Obsidian** (do not launch Obsidian from the shell). Run "Create homepage" → three files appear. Running it again doesn't change them. Edit the yaml in `Home Config.md` to invalid → no crash.
- [ ] **Step 8:** Run `npm run build && npm test && npm run lint`. Expected: all green.
- [ ] **Step 9:** Commit: `feat: obsidian adapters, settings and create-homepage command`.

---

### Task 8: HomeView shell: layout, banner, buttons, modals, base styles

**Files:**
- Create: `src/ui/HomeView.ts`, `src/ui/banner.ts`, `src/ui/buttons.ts`, `src/ui/modals.ts`
- Modify: `src/main.ts`, `styles.css`

**Interfaces:**
- Consumes: plugin fields (Task 7), `HomeConfig` and `ButtonConfig` (Task 2), `isoWeek`, `dayOfYear`, `localYmd` (Task 5), `appendLineToFile`, `getOrCreateDailyNote`, `dailyNotePath` (Task 7), `formatBillLine` (Task 3).
- Produces:
```ts
export class HomeView extends MarkdownRenderChild {
  constructor(containerEl: HTMLElement, plugin: SalamanderHomePlugin);
  // Mounts: .sh-root > .sh-banner + .sh-cols > (.sh-col-left | .sh-col-center | .sh-col-right)
  readonly slots: { bannerWeather: HTMLElement; left: HTMLElement; center: HTMLElement; right: HTMLElement };
}
export function renderBanner(el: HTMLElement, now: Date, links: { label: string; onClick: () => void }[]): HTMLElement; // returns the weather-line slot
export function renderButtons(el: HTMLElement, buttons: ButtonConfig[], run: (a: ButtonAction) => void): void;
export class AddBillModal extends Modal { constructor(app: App, onSubmit: (line: string) => void) }
export class AddTaskModal extends Modal { constructor(app: App, onSubmit: (text: string) => void) }
export function runButtonAction(plugin: SalamanderHomePlugin, action: ButtonAction): void;
```

- [ ] **Step 1:** `main.ts`: `registerMarkdownCodeBlockProcessor('salamander-home', (_src, el, ctx) => ctx.addChild(new HomeView(el, this)))`. Register the commands `add-bill` ("Add bill") and `add-today` ("Add task to today"), which open the modals.
- [ ] **Step 2:** `HomeView.onload` builds the skeleton. The banner shows `// <WEEKDAY>, <MONTH> <D>` (month and day wrapped in `.sh-accent`), then the sub-line `Week <isoWeek> · day <dayOfYear> ·` followed by the link "daily note", then an empty weather-line slot, then the buttons row. With `configStore.missing` → render one line: "No config note found. Run *Salamander Home: Create homepage*." With `configStore.error` → a faint one-line error above the columns. Re-render the buttons on the ConfigStore `'change'` event, using `this.registerEvent`. Re-render the date line at local midnight, via `registerInterval` checking once a minute.
- [ ] **Step 3:** `runButtonAction`:
  - `command` → `app.commands.executeCommandById`. If the id is unknown: for `global-search:open` or an `omnisearch:*` id, fall back to `global-search:open`; otherwise show the Notice `Command not found: <id>`.
  - `file` → `workspace.openLinkText(path, '')`.
  - `url` → `window.open(url)` only if `isHttpUrl`.
  - `add-bill` / `add-today` → open the modals.
  - `open-daily` → `getOrCreateDailyNote(today)`, then open it.
- [ ] **Step 4:** Modals:
  - `AddTaskModal`: one text field. Enter submits; empty input doesn't submit. It appends `- [ ] <text>` to today's daily note.
  - `AddBillModal`: name (required), amount (optional, accepts `142.18`, `$142.18` or `1,204.50`), and due date (`<input type="date">`, default today). Submit calls `formatBillLine`, appends to `billsPath`, and shows a Notice `Added <name>`.
  - If daily notes are unavailable, `add-today` shows a Notice saying the core Daily notes plugin must be enabled.
- [ ] **Step 5:** `styles.css` base. Define on `.sh-root` exactly:
  ```css
  --sh-accent: var(--color-accent);
  --sh-accent-1: var(--color-accent-1, var(--color-accent));
  --sh-secondary: var(--salamander-secondary, var(--color-green));
  --sh-tertiary: var(--salamander-tertiary, var(--color-yellow));
  --sh-pos: var(--salamander-success, var(--color-green));
  --sh-neg: var(--salamander-danger, var(--color-red));
  --sh-panel: var(--background-secondary);
  --sh-line: var(--background-modifier-border);
  container-type: inline-size;
  ```
  - `.sh-cols` is a grid `1fr 2.3fr 1fr`, gap 14px.
  - `@container (max-width: 900px)` collapses it to one column.
  - `.sh-home .markdown-preview-sizer, .sh-home .cm-sizer { max-width: none; }`, and hide `.inline-title` under `.sh-home`.
  - Section labels (`.sh-label`) are 10px, uppercase, letter-spacing .14em, color `--text-muted`.
  - Banner styling as in `layout-v2.html` (`.hero`): 3px accent left border and an accent gradient at 10%.
  - Buttons: square corners, `--sh-panel` background, 1px `--sh-line` border; the primary button has an accent border and accent text.
- [ ] **Step 6: Manual check** in `test-vault` (Jason reloads the plugin): the banner shows today's date and correct week number. Each default button works. Adding a bill appends a correctly formatted line to `Bills.md`. Capture creates today's daily note if missing and appends the task. A narrow pane collapses to one column. Under the default Obsidian theme it still looks right.
- [ ] **Step 7:** Run `npm run build && npm test && npm run lint`. Expected: green.
- [ ] **Step 8:** Commit: `feat: homepage shell, banner, buttons and add modals`.

---

### Task 9: Left column: weather panel, banner weather line, Today box

**Files:**
- Create: `src/ui/weatherPanel.ts`, `src/ui/todayPanel.ts`
- Modify: `src/ui/HomeView.ts`, `styles.css`

**Interfaces:**
- Consumes: `loadPanel`, `PanelState` (Task 6), `fetchJson` (Task 7), `forecastUrl`, `airQualityUrl`, `geocodeUrl`, `parseForecast`, `parseAqi`, `parseGeocode`, `weatherLabel` (Task 5), `moonPhase`, `relativeAge` (Task 5), `extractOpenTasks` (Task 3), `getDailyNoteFile`, `dailyNotesAvailable`, `toggleTaskInFile` (Task 7), `AddTaskModal` (Task 8).
- Produces:
```ts
export function mountWeather(view: HomeView, panelEl: HTMLElement, bannerLineEl: HTMLElement): void;
export function mountToday(view: HomeView, panelEl: HTMLElement): void;
```

- [ ] **Step 1:** Weather location: if the config has `lat` and `lon`, use them. Otherwise geocode `place` once, cached under key `geo:<place>` with no expiry (`maxAgeMs: Infinity`). With neither → panel text "Set `weather.place` in your config note." and an empty banner line. Fetch forecast and AQI together under key `weather:<lat>,<lon>,<units>`, `maxAgeMs` 15 min. An AQI failure must not fail the forecast (AQI becomes `null`).
- [ ] **Step 2:** Render to match `layout-v2.html`:
  - First line: condition text, temperature, feels-like, AQI.
  - 24 hourly bars (height scaled to the day's min and max), with the current hour in `--sh-accent` and labels `6a`, `2p`, `10p`.
  - 7 daily rows: day name, a range bar positioned on the week's overall min and max with a `--sh-secondary` → `--sh-tertiary` → `--sh-accent` gradient, `min/max`, and precipitation % when ≥ 20.
  - The sunrise–sunset line with day length, and the moon name with its %.
  - A faint `updated <relativeAge>` and `offline` when `error`.
  - Banner line: `<icon> <temp>° now · Tomorrow H<max> L<min> · <precip>% rain`.
  - Units: `°` for both, and the label shows F or C on the first line only.
- [ ] **Step 3:** Today box: list `extractOpenTasks` for today's note, then for the previous 7 days' notes, oldest last. Previous days' items use the class `sh-dim` with a `MM/DD` prefix. Each item is a checkbox plus text. Clicking calls `toggleTaskInFile`. "+ add" opens `AddTaskModal`. Re-render when any daily note within those 8 days changes (`vault.on('modify')`, debounced 300 ms). If daily notes are unavailable → "Enable the core Daily notes plugin to use Today." No open items → a muted "Nothing open."
- [ ] **Step 4: Manual check:** a real forecast appears (set `place: Paris` in the test vault config). Disconnecting the network and reloading shows cached weather with `offline`. Ticking a Today item updates the daily note. Editing the note by hand updates the box.
- [ ] **Step 5:** Run `npm run build && npm test && npm run lint`, then commit: `feat: weather panel and today box`.

---

### Task 10: Center column: news groups

**Files:**
- Create: `src/ui/newsPanel.ts`
- Modify: `src/ui/HomeView.ts`, `styles.css`

**Interfaces:**
- Consumes: `loadPanel` (Task 6), `fetchText` (Task 7), `parseFeed`, `mergeGroup`, `isHttpUrl` (Task 4), `relativeAge` (Task 5), `NewsGroupConfig` (Task 2).
- Produces: `export function mountNewsGroup(view: HomeView, el: HTMLElement, group: NewsGroupConfig): void;`

- [ ] **Step 1:** Per group: cache key `news:<title>`, `maxAgeMs = cacheMinutes·60000`. Fetch all feeds with `Promise.allSettled`. Each fulfilled feed is `parseFeed(...).slice(0, feed.limit ?? group.limit)`, and its items' `source` = `feed.title`. Then `mergeGroup(..., group.limit)`. If **every** feed rejects → throw (panel is offline). If some fail, show the rest.
- [ ] **Step 2:** `style: 'cards'` renders a horizontally scrollable row of cards: image (an `img` only when `isHttpUrl(image)`, with `loading="lazy"` and `referrerpolicy="no-referrer"`; otherwise the striped placeholder), title in `--sh-accent`, and `<age> · <source>`. `style: 'list'` renders rows with title, `<age> · <source>`, and the summary clamped to 2 lines. All text goes through `createEl({ text })`. Clicking a title opens `link` with `window.open` only if `isHttpUrl`; titles without a valid link aren't clickable. Show the first `collapseAfter` items with a "Show more" toggle.
- [ ] **Step 3:** Mount one panel per `config.news` group in order. Re-mount all groups on the ConfigStore `'change'` event.
- [ ] **Step 4: Manual check:** default feeds load with images on BBC cards and placeholders on HN. Adding a feed with a bad URL to one group leaves the others intact, and that group shows `offline` only if all its feeds fail.
- [ ] **Step 5:** Run `npm run build && npm test && npm run lint`, then commit: `feat: news panels`.

---

### Task 11: Right column: calendar, bills, markets

**Files:**
- Create: `src/ui/calendarPanel.ts`, `src/ui/billsPanel.ts`, `src/ui/marketsPanel.ts`, `src/ui/sparkline.ts`
- Modify: `src/ui/HomeView.ts`, `styles.css`

**Interfaces:**
- Consumes: `monthGrid`, `localYmd`, `relativeAge` (Task 5), `parseBills`, `billStatus` (Task 3), `daysWithDailyNotes`, `weekStart`, `getOrCreateDailyNote`, `getDailyNoteFile` (Task 7), `toggleTaskInFile` (Task 7), `yahooChartUrl`, `parseYahooChart`, `Quote` (Task 5), `loadPanel` (Task 6), `AddBillModal`, `appendLineToFile` (Tasks 8, 7).
- Produces:
```ts
export function mountCalendar(view: HomeView, el: HTMLElement): void;
export function mountBills(view: HomeView, el: HTMLElement, onBillsChanged: (unpaidDue: Set<string>) => void): void;
export function mountMarketGroup(view: HomeView, el: HTMLElement, group: MarketGroupConfig): void;
export function sparkline(el: HTMLElement, values: number[], width: number, height: number): void; // inline SVG via createSvg
```

- [ ] **Step 1:** Bills panel: read `billsPath` (missing file → muted "No bills yet" plus "+ add"). Show unpaid bills sorted by `due`:
  - `late` → `--sh-neg`, with "Nd late".
  - `soon` → `--sh-tertiary`, with "today", "tomorrow" or "in Nd".
  - `upcoming` → plain, with `MMM D`.
  - Show the amount when present.
  - Each row has a checkbox → `toggleTaskInFile(app, billsPath, bill.line, bill.raw, true)`. The bill name opens `billsPath`. "+ add" opens `AddBillModal`.
  - Re-render on modify of `billsPath`. Call `onBillsChanged` with the set of unpaid due dates.
- [ ] **Step 2:** Calendar: a `monthGrid` using `weekStart()`, with a header `<Month> <YYYY>` and ‹ › arrows (view-local month state). Today has an accent fill. Days in `daysWithDailyNotes()` get a dot. Unpaid-bill due days get the `sh-bill` class (ochre underline). Days outside the month are dimmed. Clicking a day: if the note exists, open it; otherwise ask with a confirm `Modal` ("Create daily note for <date>?"), then `getOrCreateDailyNote`. Re-render on daily-note create/delete and on `onBillsChanged`.
- [ ] **Step 3:** Markets: cache key `markets:<group.title>`, `maxAgeMs` 5 min. Fetch every symbol with `Promise.allSettled`. A symbol that fails or parses to `null` shows a row with `—`. All failing → offline. Each row: symbol over name (muted), a sparkline of `closes` in 80×24, then `changePct` (2 dp, sign, `--sh-pos`/`--sh-neg`) over the price (2 dp, locale grouping). Apply `collapseAfter` with "Show more".
- [ ] **Step 4: Manual check:** add bills dated yesterday, today and next week → they show late, today and a plain date, and the calendar underlines those days. Ticking one removes it, and `Bills.md` shows `- [x]`. Editing `Bills.md` by hand while the page is open, then ticking a now-moved bill, ticks the right line. Market rows show sparklines, and a bogus symbol shows `—`.
- [ ] **Step 5:** Run `npm run build && npm test && npm run lint`, then commit: `feat: calendar, bills and markets panels`.

---

### Task 12: Refresh timers and lifecycle

**Files:**
- Modify: `src/ui/HomeView.ts`, `src/ui/weatherPanel.ts`, `src/ui/newsPanel.ts`, `src/ui/marketsPanel.ts`

**Interfaces:**
- Consumes: everything mounted in Tasks 9–11.
- Produces: `HomeView.refreshAll(force: boolean): void` and a `refresh` command, "Refresh homepage", that calls `refreshAll(true)` on every mounted view (the plugin keeps a `Set<HomeView>`, added in `onload` and removed in `onunload`).

- [ ] **Step 1:** Each mount function registers its own interval with `view.registerInterval(window.setInterval(..., ms))`: weather 15 min, markets 5 min, each news group `cacheMinutes`. Each tick calls `loadPanel` without `force`. Remount on config change by clearing the previous child elements and intervals. Do this by giving each mount its own `Component`, added with `view.addChild` and removed on remount.
- [ ] **Step 2:** Re-render the relative "updated Xm ago" labels once a minute.
- [ ] **Step 3: Manual check:** with two panes both showing `Home.md`, the developer console network tab shows one request per source per interval. Closing the homepage stops all requests. "Refresh homepage" refetches everything.
- [ ] **Step 4:** Run `npm run build && npm test && npm run lint`, then commit: `feat: refresh timers and refresh command`.

---

### Task 13: README, release workflow, submission check

**Files:**
- Create: `README.md`, `.github/workflows/release.yml`, `docs/screenshot.png` (taken by Jason)

- [ ] **Step 1:** `README.md` sections:
  - What it is, with a screenshot.
  - Install.
  - Getting started: run "Create homepage", then optionally point the Homepage plugin at `Home.md` in Reading view.
  - Config reference: every key from Task 2's types, with defaults.
  - Bills line format.
  - Today box behaviour.
  - **Network use**, listing each host: the user's RSS feeds and their image hosts, `query1.finance.yahoo.com`, `api.open-meteo.com`, `air-quality-api.open-meteo.com`, `geocoding-api.open-meteo.com`. It says no accounts, keys or telemetry are involved.
  - "Looks best with the Salamander theme."
- [ ] **Step 2:** `.github/workflows/release.yml`: on a tag push matching `*.*.*`, run `npm ci`, `npm test`, `npm run build`, then `gh release create "$GITHUB_REF_NAME" main.js manifest.json styles.css --title "$GITHUB_REF_NAME"`, with `permissions: contents: write`.
- [ ] **Step 3:** Check the manifest against the community plugin guidelines: the id has no "obsidian", the description has no "Obsidian" and is ≤ 250 chars, ends with a period, and the `minAppVersion` is correct. Run `npm run lint`, and grep `src` for `innerHTML|insertAdjacentHTML|outerHTML` and for personal values (`Roanoke|100\.119|DAILY`). Expected: lint is clean and both greps are empty.
- [ ] **Step 4:** Commit: `docs: README, release workflow`.

---

### Task 14: Install into Jason's vault (**gated: ask Jason first**)

**Files (in `/home/jason/Documents/Obsidian Vault`, only after Jason says go):**
- Create: `.obsidian/plugins/salamander-home/{main.js,manifest.json,styles.css}` (copied, not symlinked, so LiveSync carries real files), `Home.md`, `Home Config.md`, `Bills.md`
- Modify: `.obsidian/community-plugins.json` (add `salamander-home`), `.obsidian/plugins/homepage/data.json` (`homepages["Main Homepage"].value` → `"Home.md"`, `view` → `"Reading view"`)

- [ ] **Step 1:** Ask Jason for the go-ahead and for him to close Obsidian, so it can't overwrite the plugin config files.
- [ ] **Step 2:** Back up `community-plugins.json` and `homepage/data.json` to `*.bak` (`.bak` is already in the theme's gitignore pattern and is harmless in the vault).
- [ ] **Step 3:** Build `Home Config.md` from `ssh voidberry cat /home/jason/glance/glance.yml`. Copy **only** the `rss` widgets (4 groups: Top Stories `cards`, limit 16, collapseAfter 8, cacheMinutes 15; Business & Markets `list` 14/6/15; Politics & Analysis `list` 14/6/20; NFL & Cowboys `list` 14/6/20, keeping each feed's url, title and limit) and the `markets` widgets (Macro, Crypto, Bellwethers with collapseAfter 6), using their symbols and names. Weather: `place: Roanoke, Virginia, US`, `lat: 37.27`, `lon: -79.94`, `units: imperial`. Buttons: `+ Capture` (add-today, primary), `Daily` (open-daily), `Search` (`omnisearch:show-modal`; confirm the id in Omnisearch's manifest and commands first), `Bills` (add-bill), `Clippings` (`file: Clippings`), `Glance ↗` (`url: http://100.119.142.70:3000`). **Do not copy** the Pi-hole password or any other part of `glance.yml`.
- [ ] **Step 4:** Copy the build files and edit the two JSON files as listed. Show Jason the diff of both JSON files.
- [ ] **Step 5: Manual check with Jason:** Obsidian opens on `Home.md` in reading view, all panels load, and `notepad..md` is unchanged.
- [ ] **Step 6:** No commit (vault files aren't in this repo). Tell Jason the `dashboard.css` snippet is now unused and can be turned off.
