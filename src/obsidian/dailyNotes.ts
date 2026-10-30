// Daily notes, located through the core Daily notes plugin's own settings.
import { moment, normalizePath, type App, type TFile } from "obsidian";
import {
  appHasDailyNotesPluginLoaded,
  createDailyNote,
  getAllDailyNotes,
  getDailyNote,
  getDailyNoteSettings,
  getDateFromFile,
} from "obsidian-daily-notes-interface";
import { ensureFolder } from "./vaultEdits";

/** "Now" as a Moment. Obsidian's `moment` export isn't typed as callable under bundler resolution. */
export const today = (): moment.Moment => (moment as unknown as () => moment.Moment)();

export function dailyNotesAvailable(): boolean {
  return appHasDailyNotesPluginLoaded();
}

export function dailyNotePath(date: moment.Moment): string {
  const { folder, format } = getDailyNoteSettings();
  const name = date.format(format || "YYYY-MM-DD");
  return normalizePath(folder ? `${folder}/${name}.md` : `${name}.md`);
}

export function getDailyNoteFile(app: App, date: moment.Moment): TFile | null {
  return app.vault.getFileByPath(dailyNotePath(date)) ?? getDailyNote(date, getAllDailyNotes()) ?? null;
}

export async function getOrCreateDailyNote(app: App, date: moment.Moment): Promise<TFile> {
  const existing = getDailyNoteFile(app, date);
  if (existing) return existing;
  const { template } = getDailyNoteSettings();
  const templateExists = !!template && !!app.metadataCache.getFirstLinkpathDest(template, "");
  if (templateExists) {
    const created = await createDailyNote(date);
    if (created) return created;
  }
  // No usable template: create an empty note ourselves (the library would show an error notice).
  const path = dailyNotePath(date);
  await ensureFolder(app, path);
  return app.vault.create(path, "");
}

export function daysWithDailyNotes(): Set<string> {
  const out = new Set<string>();
  for (const f of Object.values(getAllDailyNotes())) {
    const d = getDateFromFile(f, "day");
    if (d) out.add(d.format("YYYY-MM-DD"));
  }
  return out;
}

export function weekStart(): 0 | 1 {
  return moment.localeData().firstDayOfWeek() === 1 ? 1 : 0;
}
