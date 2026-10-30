import { groupCacheKey, type MarketGroupConfig } from "../core/config";
import { parseYahooChart, yahooChartUrl, type Quote } from "../core/markets";
import { loadPanel, type PanelState } from "../data/panelLoader";
import { fetchJson } from "../obsidian/http";
import type { HomeView } from "./HomeView";
import { aliveFlag, collapse, panelFrame, renderStatus, TICK_MS } from "./panel";
import { sparkline } from "./sparkline";

const MARKETS_MS = 5 * 60_000;
type Row = Quote | { symbol: string; name: string; missing: true };

async function fetchGroup(group: MarketGroupConfig): Promise<Row[]> {
  const results = await Promise.allSettled(
    group.markets.map(async (m) => parseYahooChart(await fetchJson(yahooChartUrl(m.symbol)), m.symbol, m.name)),
  );
  if (results.every((r) => r.status === "rejected")) {
    const first = results[0];
    throw first?.status === "rejected" && first.reason instanceof Error ? first.reason : new Error("all symbols failed");
  }
  return results.map((r, i) =>
    r.status === "fulfilled" && r.value ? r.value : { symbol: group.markets[i]!.symbol, name: group.markets[i]!.name, missing: true as const },
  );
}

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function mountMarketGroup(view: HomeView, el: HTMLElement, group: MarketGroupConfig): void {
  const sec = view.section();
  const alive = aliveFlag(sec);
  const f = panelFrame(el, group.title);

  const draw = (s: PanelState<Row[]>) => {
    if (!alive()) return;
    renderStatus(f.status, s);
    if (!s.data) return;
    f.body.empty();
    const list = f.body.createDiv({ cls: "sh-markets" });
    for (const q of s.data) {
      const row = list.createDiv({ cls: "sh-row sh-quote" });
      const id = row.createDiv({ cls: "sh-quote-id" });
      id.createDiv({ cls: "sh-strong", text: q.symbol });
      id.createDiv({ cls: "sh-faint sh-ellipsis", text: q.name });
      if ("missing" in q) {
        row.createDiv({ cls: "sh-muted", text: "—" });
        continue;
      }
      const tone = q.changePct >= 0 ? "sh-pos" : "sh-neg";
      sparkline(row.createDiv({ cls: `sh-quote-spark ${tone}` }), q.closes, 80, 24);
      const num = row.createDiv({ cls: "sh-quote-num" });
      num.createDiv({ cls: tone, text: `${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%` });
      num.createDiv({ text: fmt(q.price) });
    }
    collapse(list, group.collapseAfter);
  };

  const load = (force: boolean) =>
    loadPanel({
      cache: view.plugin.cache,
      key: groupCacheKey("markets", group.title, group.markets.flatMap((m) => [m.symbol, m.name])),
      maxAgeMs: MARKETS_MS,
      force,
      isValid: Array.isArray,
      fetch: () => fetchGroup(group),
      onUpdate: draw,
    });
  sec.registerInterval(window.setInterval(() => void load(false), TICK_MS));
  void load(view.forceNext);
}
