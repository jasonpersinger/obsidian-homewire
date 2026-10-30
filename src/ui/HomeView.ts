// The homepage: banner on top, three Glance-style columns below.
// Each render is a "generation": a child Component that owns every panel's
// events and timers, so a config change tears them all down cleanly.
import { Component, Events, MarkdownRenderChild } from "obsidian";
import type { FeedItem } from "../core/rss";
import { localYmd, relativeAge } from "../core/dates";
import type HomewirePlugin from "../main";
import { getOrCreateDailyNote, today } from "../obsidian/dailyNotes";
import { renderBanner } from "./banner";
import { mountClippings } from "./clippingsPanel";
import { mountClock } from "./clockPanel";
import { mountFearGreed } from "./fearGreedPanel";
import { renderButtons, runButtonAction } from "./buttons";
import { mountBills } from "./billsPanel";
import { mountCalendar } from "./calendarPanel";
import { mountMarketGroup } from "./marketsPanel";
import { mountNewsGroup } from "./newsPanel";
import { mountToday } from "./todayPanel";
import { panelError } from "./panel";
import { mountWeather } from "./weatherPanel";
import { mountRadio } from "./radioPanel";
import { mountWire } from "./wirePanel";

/** What panels publish for the banner wire and day summary; reset on every render. */
export interface Board {
  news: Map<string, FeedItem[]>;
  openTasks: number | null;
  nextBill: { name: string; due: string } | null;
  sunset: { at: number; label: string } | null;
}
const emptyBoard = (): Board => ({ news: new Map(), openTasks: null, nextBill: null, sunset: null });

export class HomeView extends MarkdownRenderChild {
  readonly board = new Events();
  boardState: Board = emptyBoard();
  slots!: { bannerWeather: HTMLElement; bannerWire: HTMLElement; bannerSide: HTMLElement; left: HTMLElement; center: HTMLElement; right: HTMLElement };
  private generation: Component | null = null;
  private renderedDay = "";
  /** The month the calendar shows, kept across re-renders; null means "the current month". */
  calendarMonth: { year: number; month: number } | null = null;

  constructor(containerEl: HTMLElement, readonly plugin: HomewirePlugin) {
    super(containerEl);
  }

  onload(): void {
    this.plugin.views.add(this);
    this.registerEvent(this.plugin.configStore.on("change", () => this.render()));
    // Each minute: roll over after local midnight, otherwise just age the "updated Xm ago" labels.
    this.registerInterval(window.setInterval(() => {
      if (localYmd(new Date()) !== this.renderedDay) return this.render();
      const now = Date.now();
      this.containerEl.querySelectorAll<HTMLElement>("[data-fetched]").forEach((el) => {
        el.setText(`updated ${relativeAge(now - Number(el.dataset.fetched))} ago`);
      });
    }, 60_000));
    this.render();
  }

  onunload(): void {
    this.plugin.views.delete(this);
  }

  /** A component tied to the current render; panels register events and timers on it. */
  section(): Component {
    const c = new Component();
    this.generation!.addChild(c);
    return c;
  }

  /** Panels publish here; the wire re-renders on "change". */
  report(patch: Partial<Omit<Board, "news">> & { news?: [string, FeedItem[]] }): void {
    const { news, ...rest } = patch;
    if (news) this.boardState.news.set(news[0], news[1]);
    Object.assign(this.boardState, rest);
    this.board.trigger("change");
  }

  refreshAll(force: boolean): void {
    this.forceNext = force;
    this.render();
    this.forceNext = false;
  }
  /** Read by panels during render: true when the user asked for a forced refresh. */
  forceNext = false;

  render(): void {
    try {
      if (this.generation) this.removeChild(this.generation);
      this.generation = this.addChild(new Component());
      this.boardState = emptyBoard();
      this.renderedDay = localYmd(new Date());

      const root = this.containerEl;
      root.empty();
      root.addClass("hw-root");
      const store = this.plugin.configStore;
      const openDaily = () => void getOrCreateDailyNote(this.plugin.app, today())
        .then((f) => this.plugin.app.workspace.getLeaf(false).openFile(f));

      const bannerRow = root.createDiv({ cls: "hw-banner" });
      const banner = bannerRow.createDiv({ cls: "hw-banner-main" });
      const bannerWire = bannerRow.createDiv({ cls: "hw-banner-wire" });
      const bannerSide = bannerRow.createDiv({ cls: "hw-banner-side" });
      const bannerWeather = renderBanner(banner, new Date(), [{ label: "daily note", onClick: openDaily }]);

      if (store.missing || !store.config) {
        root.createDiv({
          cls: "hw-muted hw-notice",
          text: store.missing
            ? "No config note found. Run “Homewire: Create homepage”."
            : store.error ?? "Loading config…",
        });
        return;
      }
      renderButtons(banner.createDiv({ cls: "hw-buttons" }), store.config.buttons, (a) => runButtonAction(this.plugin, a));
      if (store.error) root.createDiv({ cls: "hw-faint hw-notice", text: store.error });

      const cols = root.createDiv({ cls: "hw-cols" });
      this.slots = {
        bannerWeather,
        bannerWire,
        bannerSide,
        left: cols.createDiv({ cls: "hw-col hw-col-left" }),
        center: cols.createDiv({ cls: "hw-col hw-col-center" }),
        right: cols.createDiv({ cls: "hw-col hw-col-right" }),
      };
      this.mountPanels();
    } catch (err) {
      console.error("Homewire render error:", err);
      const root = this.containerEl;
      root.empty();
      root.addClass("hw-root");
      root.createDiv({
        cls: "hw-notice hw-neg",
        text: `Homewire error: ${err instanceof Error ? err.message : String(err)} (details in the developer console)`,
      });
    }
  }

  private mountPanels(): void {
    const { left, center, right } = this.slots;
    const config = this.plugin.configStore.config!;
    // Each panel fails on its own: one throwing while mounting leaves the rest intact.
    const guard = (el: HTMLElement, title: string, mount: () => void) => {
      try {
        mount();
      } catch (e) {
        panelError(el, title, e);
      }
    };
    guard(left, "Weather", () => mountWeather(this, left, this.slots.bannerWeather));
    guard(left, "Today", () => mountToday(this, left));
    if (config.clippings) {
      const clip = config.clippings;
      guard(left, "Clippings", () => mountClippings(this, left, clip));
    }
    if (config.radio) {
      const radio = config.radio;
      guard(left, "Radio", () => mountRadio(this, left, radio));
    }
    const wireEl = this.slots.bannerWire;
    if (config.banner.wire || config.banner.summary) guard(wireEl, "Wire", () => mountWire(this, wireEl, config.banner));
    const side = this.slots.bannerSide;
    if (config.banner.clock || config.banner.marketSession) guard(side, "Clock", () => mountClock(this, side, config.banner));
    if (config.banner.fearGreed) guard(side, "Fear & Greed", () => mountFearGreed(this, side));
    for (const group of config.news) guard(center, group.title, () => mountNewsGroup(this, center, group));
    let calendar: { setBillDates(d: Set<string>): void } | null = null;
    guard(right, "Calendar", () => (calendar = mountCalendar(this, right)));
    guard(right, "Bills", () => mountBills(this, right, (dates) => calendar?.setBillDates(dates)));
    for (const group of config.markets) guard(right, group.title, () => mountMarketGroup(this, right, group));
  }
}
