// Banner wire: one headline at a time from every news group, plus a faint day summary.
import type { BannerConfig } from "../core/config";
import { localYmd, relativeAge } from "../core/dates";
import { isHttpUrl } from "../core/safeUrl";
import { daySummary, wireItems } from "../core/wire";
import type { HomeView } from "./HomeView";

const ROTATE_MS = 8000;
const MAX_ITEMS = 20;

export function mountWire(view: HomeView, el: HTMLElement, cfg: BannerConfig): void {
  const sec = view.section();
  const box = el.createDiv({ cls: "hw-wire" });
  const headline = cfg.wire ? box.createDiv({ cls: "hw-wire-line" }) : null;
  const summary = cfg.summary ? box.createDiv({ cls: "hw-faint hw-wire-summary" }) : null;

  let index = 0;
  let paused = false;
  headline?.addEventListener("mouseenter", () => (paused = true));
  headline?.addEventListener("mouseleave", () => (paused = false));

  const drawHeadline = () => {
    if (!headline) return;
    const items = wireItems([...view.boardState.news.values()], MAX_ITEMS);
    headline.empty();
    headline.createSpan({ cls: "hw-wire-mark", text: "> " });
    if (items.length === 0) {
      headline.createSpan({ cls: "hw-faint", text: "waiting for the wire…" });
      return;
    }
    const item = items[index % items.length]!;
    const meta = [item.published !== null ? relativeAge(Date.now() - item.published) : null, item.source].filter(Boolean).join(" · ");
    headline.createSpan({ cls: "hw-faint hw-wire-meta", text: `${meta}  ` });
    if (item.link && isHttpUrl(item.link)) {
      const a = headline.createEl("a", { cls: "hw-link hw-wire-title", text: item.title, href: item.link });
      a.setAttr("target", "_blank");
      a.setAttr("rel", "noopener noreferrer");
    }
    headline.createSpan({ cls: "hw-faint hw-wire-count", text: `  ${(index % items.length) + 1}/${items.length}` });
  };

  const drawSummary = () => {
    const b = view.boardState;
    summary?.setText(daySummary({ openTasks: b.openTasks, nextBill: b.nextBill, sunset: b.sunset, today: localYmd(new Date()), now: Date.now() }));
  };

  sec.registerEvent(view.board.on("change", () => {
    drawHeadline();
    drawSummary();
  }));
  sec.registerInterval(window.setInterval(() => {
    if (paused) return;
    index++;
    drawHeadline();
    drawSummary(); // keeps "sunset" honest as the day passes
  }, ROTATE_MS));
  drawHeadline();
  drawSummary();
}
