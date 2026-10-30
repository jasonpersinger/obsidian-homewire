// CNN Fear & Greed index. Unofficial endpoint: it only answers browser-like requests.

export const FEAR_GREED_URL = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";

export interface FearGreed {
  score: number;
  rating: string;
  previousClose: number | null;
  week: number | null;
  month: number | null;
  year: number | null;
}

const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function parseFearGreed(json: unknown): FearGreed | null {
  const fg = (json as { fear_and_greed?: Record<string, unknown> } | null)?.fear_and_greed;
  const score = numOrNull(fg?.score);
  if (!fg || score === null || score < 0 || score > 100 || typeof fg.rating !== "string") return null;
  return {
    score,
    rating: fg.rating.replace(/\b\w/g, (c) => c.toUpperCase()),
    previousClose: numOrNull(fg.previous_close),
    week: numOrNull(fg.previous_1_week),
    month: numOrNull(fg.previous_1_month),
    year: numOrNull(fg.previous_1_year),
  };
}
