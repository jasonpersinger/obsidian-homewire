import { debounce, TFile } from "obsidian";
import { extractOpenTasks } from "../core/tasks";
import { dailyNotesAvailable, getDailyNoteFile, today } from "../obsidian/dailyNotes";
import { toggleTaskInFile } from "../obsidian/vaultEdits";
import { openAddTask } from "./buttons";
import type { HomeView } from "./HomeView";
import { aliveFlag, panelError, panelFrame } from "./panel";

const LOOKBACK_DAYS = 7;

export function mountToday(view: HomeView, panelEl: HTMLElement): void {
  const { plugin } = view;
  const { app } = plugin;
  const sec = view.section();
  const alive = aliveFlag(sec);
  const f = panelFrame(panelEl, "Today");
  f.label.createEl("a", { cls: "hw-link", text: "+ add", href: "#" }).addEventListener("click", (e) => {
    e.preventDefault();
    openAddTask(plugin);
  });

  if (!dailyNotesAvailable()) {
    f.body.createDiv({ cls: "hw-muted", text: "Enable the core Daily notes plugin to use Today." });
    return;
  }

  let watched = new Set<string>();
  const draw = async () => {
    const days = Array.from({ length: LOOKBACK_DAYS + 1 }, (_, i) => today().subtract(i, "days"));
    const items: { file: TFile; line: number; text: string; date: string | null }[] = [];
    watched = new Set();
    for (const [i, d] of days.entries()) {
      const file = getDailyNoteFile(app, d);
      if (!file) continue;
      watched.add(file.path);
      for (const t of extractOpenTasks(await app.vault.cachedRead(file))) {
        items.push({ file, ...t, date: i === 0 ? null : d.format("MM/DD") });
      }
    }

    if (!alive()) return;
    f.body.empty();
    if (items.length === 0) {
      f.body.createDiv({ cls: "hw-muted", text: "Nothing open." });
      return;
    }
    for (const it of items) {
      const row = f.body.createEl("label", { cls: it.date ? "hw-task hw-dim" : "hw-task" });
      const box = row.createEl("input", { type: "checkbox", cls: "task-list-item-checkbox" });
      if (it.date) row.createSpan({ cls: "hw-task-date", text: it.date });
      row.createSpan({ text: it.text });
      box.addEventListener("change", () => {
        box.disabled = true;
        void toggleTaskInFile(app, it.file.path, it.line, it.text, true).then(() => redraw());
      });
    }
  };
  const safeDraw = () => draw().catch((e) => alive() && (f.body.empty(), panelError(f.body, "Today", e)));
  const redraw = debounce(() => void safeDraw(), 300, true);

  const isDaily = (file: unknown) => file instanceof TFile && (watched.has(file.path) || getDailyNoteFile(app, today())?.path === file.path);
  sec.registerEvent(app.vault.on("modify", (file) => isDaily(file) && redraw()));
  sec.registerEvent(app.vault.on("create", (file) => isDaily(file) && redraw()));
  sec.registerEvent(app.vault.on("delete", (file) => file instanceof TFile && watched.has(file.path) && redraw()));
  void safeDraw();
}
