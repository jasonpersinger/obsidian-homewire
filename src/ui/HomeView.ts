// The homepage: banner on top, three Glance-style columns below.
// Each render is a "generation": a child Component that owns every panel's
// events and timers, so a config change tears them all down cleanly.
import { Component, MarkdownRenderChild } from "obsidian";
import { localYmd } from "../core/dates";
import type SalamanderHomePlugin from "../main";
import { getOrCreateDailyNote, today } from "../obsidian/dailyNotes";
import { renderBanner } from "./banner";
import { renderButtons, runButtonAction } from "./buttons";
import { mountToday } from "./todayPanel";
import { mountWeather } from "./weatherPanel";

export class HomeView extends MarkdownRenderChild {
  slots!: { bannerWeather: HTMLElement; left: HTMLElement; center: HTMLElement; right: HTMLElement };
  private generation: Component | null = null;
  private renderedDay = "";

  constructor(containerEl: HTMLElement, readonly plugin: SalamanderHomePlugin) {
    super(containerEl);
  }

  onload(): void {
    this.plugin.views.add(this);
    this.registerEvent(this.plugin.configStore.on("change", () => this.render()));
    // Re-render after local midnight so the date, Today box and calendar roll over.
    this.registerInterval(window.setInterval(() => {
      if (localYmd(new Date()) !== this.renderedDay) this.render();
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
    if (this.generation) this.removeChild(this.generation);
    this.generation = this.addChild(new Component());
    this.renderedDay = localYmd(new Date());

    const root = this.containerEl;
    root.empty();
    root.addClass("sh-root");
    const store = this.plugin.configStore;
    const openDaily = () => void getOrCreateDailyNote(this.plugin.app, today())
      .then((f) => this.plugin.app.workspace.getLeaf(false).openFile(f));

    const banner = root.createDiv({ cls: "sh-banner" });
    const bannerWeather = renderBanner(banner, new Date(), [{ label: "daily note", onClick: openDaily }]);

    if (store.missing || !store.config) {
      root.createDiv({
        cls: "sh-muted sh-notice",
        text: store.missing
          ? "No config note found. Run “Salamander Home: Create homepage”."
          : store.error ?? "Loading config…",
      });
      return;
    }
    renderButtons(banner.createDiv({ cls: "sh-buttons" }), store.config.buttons, (a) => runButtonAction(this.plugin, a));
    if (store.error) root.createDiv({ cls: "sh-faint sh-notice", text: store.error });

    const cols = root.createDiv({ cls: "sh-cols" });
    this.slots = {
      bannerWeather,
      left: cols.createDiv({ cls: "sh-col sh-col-left" }),
      center: cols.createDiv({ cls: "sh-col sh-col-center" }),
      right: cols.createDiv({ cls: "sh-col sh-col-right" }),
    };
    this.mountPanels();
  }

  private mountPanels(): void {
    const { left } = this.slots;
    mountWeather(this, left, this.slots.bannerWeather);
    mountToday(this, left);
  }
}
