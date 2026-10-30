import { Notice, setIcon, TFile, TFolder, type App } from "obsidian";
import { fileTargets, type ButtonAction, type ButtonConfig } from "../core/config";
import { localYmd } from "../core/dates";
import { isHttpUrl } from "../core/safeUrl";
import type HomewirePlugin from "../main";
import { dailyNotesAvailable, getOrCreateDailyNote, today } from "../obsidian/dailyNotes";
import { appendLineToFile } from "../obsidian/vaultEdits";
import { AddBillModal, AddTaskModal } from "./modals";

export function renderButtons(el: HTMLElement, buttons: ButtonConfig[], run: (a: ButtonAction) => void): void {
  for (const b of buttons) {
    const btn = el.createEl("button", { cls: b.primary ? "hw-btn hw-btn-primary" : "hw-btn" });
    if (b.icon) setIcon(btn.createSpan({ cls: "hw-btn-icon" }), b.icon);
    btn.createSpan({ text: b.label });
    btn.addEventListener("click", () => run(b.action));
  }
}

// `app.commands` is not in Obsidian's public typings; this is the one place it is used.
interface Commands { commands: Record<string, unknown>; executeCommandById(id: string): boolean }
const commandsOf = (app: App) => (app as unknown as { commands: Commands }).commands;

// The file explorer's revealInFolder is not in the public typings.
interface FileExplorerView { revealInFolder(target: TFolder | TFile): void }

/** Opens a note, or reveals a folder in the file explorer. Never creates anything. */
function openVaultPath(app: App, raw: string): void {
  const target = fileTargets(raw).map((p) => app.vault.getAbstractFileByPath(p)).find((f) => f !== null);
  if (target instanceof TFile) {
    void app.workspace.getLeaf(false).openFile(target);
  } else if (target instanceof TFolder) {
    const explorer = app.workspace.getLeavesOfType("file-explorer")[0];
    if (!explorer) {
      new Notice(`Open the file explorer to see “${target.path}”.`);
      return;
    }
    void app.workspace.revealLeaf(explorer);
    (explorer.view as unknown as FileExplorerView).revealInFolder(target);
  } else {
    new Notice(`Not found in your vault: ${raw}`);
  }
}

export function openAddTask(plugin: HomewirePlugin): void {
  if (!dailyNotesAvailable()) {
    new Notice("Enable the core daily notes plugin to add tasks to today.");
    return;
  }
  new AddTaskModal(plugin.app, async (text) => {
    const note = await getOrCreateDailyNote(plugin.app, today());
    await appendLineToFile(plugin.app, note.path, `- [ ] ${text}`);
  }).open();
}

export function openAddBill(plugin: HomewirePlugin): void {
  new AddBillModal(plugin.app, localYmd(new Date()), async (line, name) => {
    await appendLineToFile(plugin.app, plugin.settings.billsPath, line);
    new Notice(`Added ${name}`);
  }).open();
}

export function runButtonAction(plugin: HomewirePlugin, action: ButtonAction): void {
  const { app } = plugin;
  if ("command" in action) {
    const cmds = commandsOf(app);
    let id = action.command;
    if (!(id in cmds.commands) && (id === "global-search:open" || id.startsWith("omnisearch:"))) id = "global-search:open";
    if (!(id in cmds.commands) || !cmds.executeCommandById(id)) new Notice(`Command not found: ${action.command}`);
  } else if ("file" in action) {
    openVaultPath(app, action.file);
  } else if ("url" in action) {
    if (isHttpUrl(action.url)) window.open(action.url);
  } else if (action.builtin === "add-bill") {
    openAddBill(plugin);
  } else if (action.builtin === "add-today") {
    openAddTask(plugin);
  } else {
    void getOrCreateDailyNote(app, today()).then((f) => app.workspace.getLeaf(false).openFile(f));
  }
}
