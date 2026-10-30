// Yahoo Finance chart endpoint (the same one Glance uses).

export interface Quote { symbol: string; name: string; price: number; changePct: number; closes: number[]; currency: string }

export function yahooChartUrl(symbol: string): string {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`;
}

export function parseYahooChart(json: unknown, symbol: string, name: string): Quote | null {
  const result = (json as { chart?: { result?: unknown[] | null } } | null)?.chart?.result?.[0] as
    | { meta?: { regularMarketPrice?: unknown; currency?: unknown }; indicators?: { quote?: { close?: unknown[] }[] } }
    | undefined;
  const price = result?.meta?.regularMarketPrice;
  if (typeof price !== "number") return null;
  const closes = (result?.indicators?.quote?.[0]?.close ?? []).filter((c): c is number => typeof c === "number");
  const previous = closes.length >= 2 ? closes[closes.length - 2]! : 0;
  return {
    symbol,
    name,
    price,
    changePct: previous ? ((price - previous) / previous) * 100 : 0,
    closes,
    currency: typeof result?.meta?.currency === "string" ? result.meta.currency : "",
  };
}
