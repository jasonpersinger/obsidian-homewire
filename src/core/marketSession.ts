// US equity market session (NYSE/Nasdaq), always computed in New York time.
// Pre-market 4:00–9:30, regular 9:30–16:00 (13:00 on early-close days),
// after hours until 20:00 (17:00 on early-close days).

export type SessionKind = "pre" | "open" | "after" | "closed";
/** changeAt: when the current state ends; opensAt: the next (or current day's) 9:30 open. */
export interface MarketSession { kind: SessionKind; changeAt: number; opensAt: number }

const NY = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
});

const PRE = 4 * 60, OPEN = 9 * 60 + 30, CLOSE = 16 * 60, EARLY_CLOSE = 13 * 60, AFTER = 20 * 60, EARLY_AFTER = 17 * 60;

const pad = (n: number) => String(n).padStart(2, "0");
const ymdOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const utcDay = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
const dow = (ymd: string) => utcDay(ymd).getUTCDay();
const addDays = (ymd: string, n: number) => {
  const t = utcDay(ymd);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

function nyParts(t: number): { ymd: string; minutes: number; weekday: string } {
  const p = Object.fromEntries(NY.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return { ymd: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute), weekday: p.weekday ?? "" };
}

/** The instant at which New York's wall clock reads `ymd` + `minutes`. */
function nyInstant(ymd: string, minutes: number): number {
  const target = Date.parse(`${ymd}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00Z`);
  let t = target;
  for (let i = 0; i < 3; i++) {
    const p = nyParts(t);
    const wall = Date.parse(`${p.ymd}T${pad(Math.floor(p.minutes / 60))}:${pad(p.minutes % 60)}:00Z`);
    t += target - wall;
  }
  return t;
}

function nthWeekday(y: number, month: number, weekday: number, n: number): string {
  const first = dow(ymdOf(y, month, 1));
  return ymdOf(y, month, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
}
function lastWeekday(y: number, month: number, weekday: number): string {
  const last = new Date(Date.UTC(y, month, 0)).getUTCDate();
  return ymdOf(y, month, last - ((dow(ymdOf(y, month, last)) - weekday + 7) % 7));
}
/** Saturday holidays move to Friday, Sunday holidays to Monday. */
function observed(ymd: string): string {
  const d = dow(ymd);
  return d === 6 ? addDays(ymd, -1) : d === 0 ? addDays(ymd, 1) : ymd;
}
function easter(y: number): string {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return ymdOf(y, Math.floor((h + l - 7 * m + 114) / 31), ((h + l - 7 * m + 114) % 31) + 1);
}

const holidayCache = new Map<number, Set<string>>();
function holidays(y: number): Set<string> {
  let set = holidayCache.get(y);
  if (set) return set;
  const newYear = ymdOf(y, 1, 1);
  set = new Set([
    nthWeekday(y, 1, 1, 3), // Martin Luther King Jr. Day
    nthWeekday(y, 2, 1, 3), // Presidents' Day
    addDays(easter(y), -2), // Good Friday
    lastWeekday(y, 5, 1), // Memorial Day
    observed(ymdOf(y, 6, 19)), // Juneteenth
    observed(ymdOf(y, 7, 4)), // Independence Day
    nthWeekday(y, 9, 1, 1), // Labor Day
    nthWeekday(y, 11, 4, 4), // Thanksgiving
    observed(ymdOf(y, 12, 25)), // Christmas
  ]);
  // NYSE doesn't close the previous Friday when New Year's Day falls on a Saturday.
  if (dow(newYear) !== 6) set.add(observed(newYear));
  holidayCache.set(y, set);
  return set;
}

export function isTradingDay(ymd: string): boolean {
  const d = dow(ymd);
  return d !== 0 && d !== 6 && !holidays(Number(ymd.slice(0, 4))).has(ymd);
}

function isEarlyClose(ymd: string): boolean {
  if (!isTradingDay(ymd)) return false;
  const y = Number(ymd.slice(0, 4)), md = ymd.slice(5);
  return md === "07-03" || md === "12-24" || ymd === addDays(nthWeekday(y, 11, 4, 4), 1);
}

function nextTradingDay(ymd: string): string {
  let d = addDays(ymd, 1);
  while (!isTradingDay(d)) d = addDays(d, 1);
  return d;
}

export function marketSession(now: Date): MarketSession {
  const { ymd, minutes } = nyParts(now.getTime());
  const nextDay = nextTradingDay(ymd);
  const nextOpen = nyInstant(nextDay, OPEN);
  if (!isTradingDay(ymd)) return { kind: "closed", changeAt: nyInstant(nextDay, PRE), opensAt: nextOpen };

  const early = isEarlyClose(ymd);
  const close = early ? EARLY_CLOSE : CLOSE, afterEnd = early ? EARLY_AFTER : AFTER;
  const todayOpen = nyInstant(ymd, OPEN);
  if (minutes < PRE) return { kind: "closed", changeAt: nyInstant(ymd, PRE), opensAt: todayOpen };
  if (minutes < OPEN) return { kind: "pre", changeAt: todayOpen, opensAt: todayOpen };
  if (minutes < close) return { kind: "open", changeAt: nyInstant(ymd, close), opensAt: nextOpen };
  if (minutes < afterEnd) return { kind: "after", changeAt: nyInstant(ymd, afterEnd), opensAt: nextOpen };
  return { kind: "closed", changeAt: nyInstant(nextDay, PRE), opensAt: nextOpen };
}

const TAGS: Record<SessionKind, string> = { pre: "Pre-market", open: "Open", after: "After hours", closed: "Closed" };

function duration(ms: number): string {
  const total = Math.max(1, Math.ceil(ms / 60_000));
  const h = Math.floor(total / 60), m = total % 60;
  return h > 0 ? `${h}h ${pad(m)}m` : `${m}m`;
}

export function sessionText(s: MarketSession, now: Date): { tag: string; detail: string } {
  const t = now.getTime();
  if (s.kind === "pre") return { tag: TAGS.pre, detail: `opens in ${duration(s.opensAt - t)}` };
  if (s.kind === "open") return { tag: TAGS.open, detail: `closes in ${duration(s.changeAt - t)}` };
  // Within half a day, a countdown reads better than a weekday.
  if (s.opensAt - t < 12 * 3_600_000) return { tag: TAGS[s.kind], detail: `opens in ${duration(s.opensAt - t)}` };
  const o = nyParts(s.opensAt);
  const h = Math.floor(o.minutes / 60) % 12 || 12;
  return { tag: TAGS[s.kind], detail: `opens ${o.weekday} ${h}:${pad(o.minutes % 60)} ET` };
}
