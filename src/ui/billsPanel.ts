import { debounce, TFile } from "obsidian";
import { billStatus, parseBills, type Bill } from "../core/bills";
import { localYmd } from "../core/dates";
import { toggleTaskInFile } from "../obsidian/vaultEdits";
import { openAddBill } from "./buttons";
import type { HomeView } from "./HomeView";
import { panelFrame } from "./panel";

function dueText(b: Bill, todayYmd: string): { text: string; cls: string } {
  const s = billStatus(b.due, todayYmd);
  if (s.kind === "late") return { text: `${s.days}d late`, cls: "sh-neg" };
  if (s.kind === "soon") {
    const text = s.days === 0 ? "today" : s.days === 1 ? "tomorrow" : `in ${s.days}d`;
    return { text, cls: "sh-due-soon" };
  }
  return { text: new Date(`${b.due}T12:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }), cls: "" };
}

export function mountBills(view: HomeView, el: HTMLElement, onBillsChanged: (unpaidDue: Set<string>) => void): void {
  const { plugin } = view;
  const { app } = plugin;
  const path = () => plugin.settings.billsPath;
  const sec = view.section();
  const f = panelFrame(el, "Bills");
  f.label.createEl("a", { cls: "sh-link", text: "+ add", href: "#" }).addEventListener("click", (e) => {
    e.preventDefault();
    openAddBill(plugin);
  });

  const draw = async () => {
    f.body.empty();
    const file = app.vault.getFileByPath(path());
    const unpaid = file ? parseBills(await app.vault.cachedRead(file)).filter((b) => !b.paid).sort((a, b) => a.due.localeCompare(b.due)) : [];
    onBillsChanged(new Set(unpaid.map((b) => b.due)));
    if (unpaid.length === 0) {
      f.body.createDiv({ cls: "sh-muted", text: file ? "Nothing due." : "No bills yet." });
      return;
    }
    const todayYmd = localYmd(new Date());
    for (const b of unpaid) {
      const due = dueText(b, todayYmd);
      const row = f.body.createDiv({ cls: "sh-row sh-bill-row" });
      const left = row.createDiv({ cls: "sh-bill-left" });
      const box = left.createEl("input", { type: "checkbox", cls: "task-list-item-checkbox", attr: { "aria-label": `Mark ${b.name} paid` } });
      box.addEventListener("change", () => {
        box.disabled = true;
        void toggleTaskInFile(app, path(), b.line, b.raw, true).then(() => redraw());
      });
      left.createEl("a", { cls: `sh-bill-name ${due.cls === "sh-neg" ? "sh-neg" : ""}`, text: b.name, href: "#" }).addEventListener("click", (e) => {
        e.preventDefault();
        void app.workspace.openLinkText(path(), "", false);
      });
      const right = row.createDiv({ cls: "sh-bill-right" });
      if (b.amount !== null) right.createSpan({ cls: "sh-muted", text: `$${b.amount.toFixed(2)} ` });
      right.createSpan({ cls: due.cls, text: due.text });
    }
  };
  const redraw = debounce(() => void draw(), 300, true);

  const isBills = (file: unknown, oldPath?: string) => file instanceof TFile && (file.path === path() || oldPath === path());
  sec.registerEvent(app.vault.on("modify", (file) => isBills(file) && redraw()));
  sec.registerEvent(app.vault.on("create", (file) => isBills(file) && redraw()));
  sec.registerEvent(app.vault.on("delete", (file) => isBills(file) && redraw()));
  sec.registerEvent(app.vault.on("rename", (file, old) => isBills(file, old) && redraw()));
  void draw();
}
