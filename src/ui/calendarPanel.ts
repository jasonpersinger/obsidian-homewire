import { Modal, Setting, TFile, debounce, type App } from "obsidian";
import { localYmd, monthGrid } from "../core/dates";
import { daysWithDailyNotes, getDailyNoteFile, getOrCreateDailyNote, today, weekStart } from "../obsidian/dailyNotes";
import type { HomeView } from "./HomeView";
import { panelFrame } from "./panel";

class ConfirmModal extends Modal {
  constructor(app: App, private readonly message: string, private readonly onYes: () => void) {
    super(app);
  }
  onOpen(): void {
    this.contentEl.createEl("p", { text: this.message });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((b) => b.setButtonText("Create").setCta().onClick(() => {
        this.close();
        this.onYes();
      }));
  }
  onClose(): void {
    this.contentEl.empty();
  }
}

export function mountCalendar(view: HomeView, el: HTMLElement): { setBillDates(dates: Set<string>): void } {
  const { app } = view.plugin;
  const sec = view.section();
  const f = panelFrame(el, "Calendar");
  const now = new Date();
  let year = view.calendarMonth?.year ?? now.getFullYear(), month = view.calendarMonth?.month ?? now.getMonth();
  let billDates = new Set<string>();

  const open = (ymd: string) => {
    const date = today().clone().set({ year: +ymd.slice(0, 4), month: +ymd.slice(5, 7) - 1, date: +ymd.slice(8, 10) });
    const existing = getDailyNoteFile(app, date);
    const go = () => void getOrCreateDailyNote(app, date).then((file) => app.workspace.getLeaf(false).openFile(file));
    if (existing) go();
    else new ConfirmModal(app, `Create daily note for ${ymd}?`, go).open();
  };

  const draw = () => {
    f.label.firstElementChild!.setText(new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" }));
    f.body.empty();
    const nav = f.body.createDiv({ cls: "hw-cal-nav" });
    const step = (d: number) => {
      month += d;
      if (month < 0) { month = 11; year--; }
      if (month > 11) { month = 0; year++; }
      view.calendarMonth = { year, month };
      draw();
    };
    nav.createEl("button", { cls: "hw-more", text: "‹" }).addEventListener("click", () => step(-1));
    nav.createEl("button", { cls: "hw-more", text: "Today" }).addEventListener("click", () => {
      year = new Date().getFullYear();
      month = new Date().getMonth();
      view.calendarMonth = null;
      draw();
    });
    nav.createEl("button", { cls: "hw-more", text: "›" }).addEventListener("click", () => step(1));

    const grid = f.body.createDiv({ cls: "hw-cal" });
    const ws = weekStart();
    for (let i = 0; i < 7; i++) {
      grid.createSpan({ cls: "hw-cal-head", text: new Date(2023, 0, 1 + ((i + ws) % 7)).toLocaleDateString(undefined, { weekday: "narrow" }) });
    }
    const notes = daysWithDailyNotes();
    const todayYmd = localYmd(new Date());
    for (const cell of monthGrid(year, month, ws)) {
      const cls = ["hw-cal-day"];
      if (!cell.inMonth) cls.push("hw-cal-out");
      if (cell.date === todayYmd) cls.push("hw-cal-today");
      if (billDates.has(cell.date)) cls.push("hw-bill");
      if (notes.has(cell.date)) cls.push("hw-cal-note");
      const day = grid.createEl("button", { cls: cls.join(" "), text: String(+cell.date.slice(8)) });
      day.setAttr("aria-label", cell.date);
      day.addEventListener("click", () => open(cell.date));
    }
  };

  const redraw = debounce(draw, 300, true);
  const isMarkdown = (file: unknown) => file instanceof TFile && file.extension === "md";
  sec.registerEvent(app.vault.on("create", (file) => isMarkdown(file) && redraw()));
  sec.registerEvent(app.vault.on("delete", (file) => isMarkdown(file) && redraw()));
  sec.registerEvent(app.vault.on("rename", (file) => isMarkdown(file) && redraw()));
  draw();

  return {
    setBillDates(dates) {
      billDates = dates;
      draw();
    },
  };
}
