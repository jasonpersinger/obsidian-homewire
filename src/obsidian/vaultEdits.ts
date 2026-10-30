import { normalizePath, Notice, TFile, type App } from "obsidian";
import { setTaskChecked } from "../core/tasks";

/** Ticks a checkbox atomically; a no-op with a notice if the line no longer matches. */
export async function toggleTaskInFile(app: App, path: string, line: number, text: string, checked: boolean): Promise<boolean> {
  const file = app.vault.getFileByPath(path);
  let changed = false;
  if (file) {
    await app.vault.process(file, (md) => {
      const next = setTaskChecked(md, line, text, checked);
      changed = next !== null;
      return next ?? md;
    });
  }
  if (!changed) new Notice("That item changed since the page loaded — refreshed.");
  return changed;
}

async function ensureFolder(app: App, path: string): Promise<void> {
  const folder = path.split("/").slice(0, -1).join("/");
  if (folder && !app.vault.getFolderByPath(folder)) await app.vault.createFolder(folder);
}

/** Appends one line, creating the file (and its folders) when missing. */
export async function appendLineToFile(app: App, path: string, line: string): Promise<TFile> {
  const p = normalizePath(path);
  const existing = app.vault.getFileByPath(p);
  if (!existing) {
    await ensureFolder(app, p);
    return app.vault.create(p, `${line}\n`);
  }
  await app.vault.process(existing, (md) => (md === "" || md.endsWith("\n") ? md : `${md}\n`) + `${line}\n`);
  return existing;
}

export { ensureFolder };
