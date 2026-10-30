import { FEAR_GREED_URL, parseFearGreed, type FearGreed } from "../core/fearGreed";
import { loadPanel, type PanelState } from "../data/panelLoader";
import { fetchJson } from "../obsidian/http";
import type { HomeView } from "./HomeView";
import { aliveFlag, renderStatus, TICK_MS } from "./panel";

const FEAR_GREED_MS = 15 * 60_000;
// CNN answers only browser-like requests (anything else gets HTTP 418).
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  Referer: "https://www.cnn.com/",
  Accept: "application/json",
};

/** 0–24 extreme fear … 75–100 extreme greed, matching CNN's bands. */
const tone = (score: number) => (score < 25 ? "hw-fg-xfear" : score < 45 ? "hw-fg-fear" : score <= 55 ? "hw-fg-neutral" : score <= 75 ? "hw-fg-greed" : "hw-fg-xgreed");

export function mountFearGreed(view: HomeView, el: HTMLElement): void {
  const sec = view.section();
  const alive = aliveFlag(sec);
  const box = el.createDiv({ cls: "hw-fg" });
  box.createDiv({ cls: "hw-label", text: "Fear & Greed" });
  const body = box.createDiv();
  const status = box.createDiv({ cls: "hw-faint hw-status" });

  const draw = (s: PanelState<FearGreed>) => {
    if (!alive()) return;
    renderStatus(status, s);
    if (!s.data) return;
    const fg = s.data;
    body.empty();
    const head = body.createDiv({ cls: `hw-fg-head ${tone(fg.score)}` });
    head.createSpan({ cls: "hw-fg-score", text: String(Math.round(fg.score)) });
    head.createSpan({ cls: "hw-fg-rating", text: fg.rating });
    const bar = body.createDiv({ cls: "hw-fg-bar" });
    bar.createDiv({ cls: "hw-fg-marker" }).style.setProperty("--pos", `${fg.score}%`);
    const prev = [["prev", fg.previousClose], ["1w", fg.week], ["1m", fg.month], ["1y", fg.year]]
      .filter((p): p is [string, number] => p[1] !== null)
      .map(([k, v]) => `${k} ${Math.round(v)}`)
      .join(" · ");
    if (prev) body.createDiv({ cls: "hw-faint", text: prev });
  };

  const load = (force: boolean) =>
    loadPanel({
      cache: view.plugin.cache,
      key: "fearGreed",
      maxAgeMs: FEAR_GREED_MS,
      force,
      isValid: (v) => typeof (v as FearGreed | null)?.score === "number",
      fetch: async () => {
        const fg = parseFearGreed(await fetchJson(FEAR_GREED_URL, BROWSER_HEADERS));
        if (!fg) throw new Error("unexpected response");
        return fg;
      },
      onUpdate: draw,
    });
  sec.registerInterval(window.setInterval(() => void load(false), TICK_MS));
  void load(view.forceNext);
}
