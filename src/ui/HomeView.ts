// The homepage: banner on top, three Glance-style columns below.
// Each render is a "generation": a child Component that owns every panel's
// events and timers, so a config change tears them all down cleanly.
import { Component, MarkdownRenderChild } from "obsidian";
import { localYmd, relativeAge } from "../core/dates";
import type HomewirePlugin from "../main";
import { getOrCreateDailyNote, today } from "../obsidian/dailyNotes";
import { renderBanner } from "./banner";
import { renderButtons, runButtonAction } from "./buttons";
import { mountBills } from "./billsPanel";
import { mountCalendar } from "./calendarPanel";
import { mountMarketGroup } from "./marketsPanel";
import { mountNewsGroup } from "./newsPanel";
import { mountToday } from "./todayPanel";
import { panelError } from "./panel";
import { mountWeather } from "./weatherPanel";

export class HomeView extends MarkdownRenderChild {
  slots!: { bannerWeather: HTMLElement; left: HTMLElement; center: HTMLElement; right: HTMLElement };
  private generation: Component | null = null;
  private renderedDay = "";

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
      this.renderedDay = localYmd(new Date());

      const root = this.containerEl;
      root.empty();
      root.addClass("hw-root");
      const store = this.plugin.configStore;
      const openDaily = () => void getOrCreateDailyNote(this.plugin.app, today())
        .then((f) => this.plugin.app.workspace.getLeaf(false).openFile(f));

      const banner = root.createDiv({ cls: "hw-banner" });
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
    for (const group of config.news) guard(center, group.title, () => mountNewsGroup(this, center, group));
    let calendar: { setBillDates(d: Set<string>): void } | null = null;
    guard(right, "Calendar", () => (calendar = mountCalendar(this, right)));
    guard(right, "Bills", () => mountBills(this, right, (dates) => calendar?.setBillDates(dates)));
    for (const group of config.markets) guard(right, group.title, () => mountMarketGroup(this, right, group));
  }
}
