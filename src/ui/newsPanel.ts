// News groups. Feed content is untrusted: every string goes in as text, and
// links/images are only used when they are plain http(s) URLs.
import type { NewsGroupConfig } from "../core/config";
import { relativeAge } from "../core/dates";
import { mergeGroup, parseFeed, type FeedItem } from "../core/rss";
import { isHttpUrl } from "../core/safeUrl";
import { loadPanel, type PanelState } from "../data/panelLoader";
import { fetchText } from "../obsidian/http";
import type { HomeView } from "./HomeView";
import { collapse, panelFrame, renderStatus } from "./panel";

async function fetchGroup(group: NewsGroupConfig): Promise<FeedItem[]> {
  const results = await Promise.allSettled(
    group.feeds.map(async (feed) => parseFeed(await fetchText(feed.url), feed.title).slice(0, feed.limit ?? group.limit)),
  );
  const ok = results.filter((r): r is PromiseFulfilledResult<FeedItem[]> => r.status === "fulfilled");
  if (ok.length === 0) {
    const first = results[0];
    throw first?.status === "rejected" && first.reason instanceof Error ? first.reason : new Error("all feeds failed");
  }
  return mergeGroup(ok.map((r) => r.value), group.limit);
}

function titleEl(parent: HTMLElement, item: FeedItem, cls: string): void {
  if (item.link && isHttpUrl(item.link)) {
    const a = parent.createEl("a", { cls: `${cls} sh-link`, text: item.title, href: item.link });
    a.setAttr("target", "_blank");
    a.setAttr("rel", "noopener noreferrer");
  } else {
    parent.createDiv({ cls, text: item.title });
  }
}

const meta = (item: FeedItem, now: number) =>
  [item.published !== null ? relativeAge(now - item.published) : null, item.source].filter(Boolean).join(" · ");

function drawCards(body: HTMLElement, items: FeedItem[], now: number): void {
  const row = body.createDiv({ cls: "sh-cards" });
  for (const item of items) {
    const card = row.createDiv({ cls: "sh-card" });
    const img = card.createDiv({ cls: "sh-card-img" });
    if (item.image && isHttpUrl(item.image)) {
      img.createEl("img", { attr: { src: item.image, loading: "lazy", referrerpolicy: "no-referrer", alt: "" } });
    }
    titleEl(card, item, "sh-card-title");
    card.createDiv({ cls: "sh-card-meta sh-faint", text: meta(item, now) });
  }
}

function drawList(body: HTMLElement, items: FeedItem[], now: number): HTMLElement {
  const list = body.createDiv({ cls: "sh-news" });
  for (const item of items) {
    const row = list.createDiv({ cls: "sh-news-item" });
    titleEl(row, item, "sh-news-title");
    row.createDiv({ cls: "sh-faint", text: meta(item, now) });
    if (item.summary) row.createDiv({ cls: "sh-news-summary sh-muted", text: item.summary });
  }
  return list;
}

export function mountNewsGroup(view: HomeView, el: HTMLElement, group: NewsGroupConfig): void {
  const sec = view.section();
  const f = panelFrame(el, group.title, false);
  const maxAgeMs = group.cacheMinutes * 60_000;

  const draw = (s: PanelState<FeedItem[]>) => {
    renderStatus(f.status, s);
    if (!s.data) return;
    f.body.empty();
    const now = Date.now();
    if (group.style === "cards") {
      const shown = s.data.slice(0, group.collapseAfter);
      drawCards(f.body, shown, now);
      if (s.data.length > shown.length) drawList(f.body, s.data.slice(group.collapseAfter), now).addClass("sh-card-overflow");
      const overflow = f.body.querySelector<HTMLElement>(".sh-card-overflow");
      if (overflow) collapse(overflow, 0);
    } else {
      collapse(drawList(f.body, s.data, now), group.collapseAfter);
    }
  };

  const load = (force: boolean) =>
    loadPanel({ cache: view.plugin.cache, key: `news:${group.title}`, maxAgeMs, force, fetch: () => fetchGroup(group), onUpdate: draw });
  sec.registerInterval(window.setInterval(() => void load(false), maxAgeMs));
  void load(view.forceNext);
}
