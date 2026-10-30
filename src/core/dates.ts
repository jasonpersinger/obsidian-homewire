// Calendar-day helpers. Day counts use UTC midnights of the Y-M-D parts,
// so a DST change can never shift a result by a day.

const pad = (n: number) => String(n).padStart(2, "0");

export function localYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const ymdToUtc = (ymd: string): number => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1);
};

export function daysBetween(fromYmd: string, toYmd: string): number {
  return Math.round((ymdToUtc(toYmd) - ymdToUtc(fromYmd)) / 86_400_000);
}

export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7)); // Thursday of this week
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

export function dayOfYear(d: Date): number {
  return daysBetween(`${d.getFullYear()}-01-01`, localYmd(d)) + 1;
}

/** Always 42 cells (6 weeks), starting on the week-start day on or before the 1st. */
export function monthGrid(year: number, month0: number, weekStart: 0 | 1): { date: string; inMonth: boolean }[] {
  const firstDow = new Date(Date.UTC(year, month0, 1)).getUTCDay();
  const offset = (firstDow - weekStart + 7) % 7;
  return Array.from({ length: 42 }, (_, i) => {
    const t = new Date(Date.UTC(year, month0, 1 - offset + i));
    return {
      date: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`,
      inMonth: t.getUTCMonth() === month0,
    };
  });
}

export function relativeAge(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}
