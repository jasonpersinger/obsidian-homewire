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
  const direct = app.vault.getFileByPath(dailyNotePath(date));
  if (direct) return direct;
  try {
    return getDailyNote(date, getAllDailyNotes()) ?? null;
  } catch {
    return null;
  }
}

export async function getOrCreateDailyNote(app: App, date: moment.Moment): Promise<TFile> {
  const existing = getDailyNoteFile(app, date);
  if (existing) return existing;
  let templateExists = false;
  try {
    const { template } = getDailyNoteSettings();
    templateExists = !!template && !!app.metadataCache.getFirstLinkpathDest(template, "");
  } catch {
    templateExists = false;
  }
  if (templateExists) {
    try {
      const created = await createDailyNote(date);
      if (created) return created;
    } catch {
      // Fall through to manual creation
    }
  }
  // No usable template or folder missing: create note ourselves
  const path = dailyNotePath(date);
  await ensureFolder(app, path);
  return app.vault.create(path, "");
}

export function daysWithDailyNotes(): Set<string> {
  const out = new Set<string>();
  try {
    for (const f of Object.values(getAllDailyNotes())) {
      const d = getDateFromFile(f, "day");
      if (d) out.add(d.format("YYYY-MM-DD"));
    }
  } catch {
    // Daily notes folder does not exist yet or no notes found
  }
  return out;
}

export function weekStart(): 0 | 1 {
  return moment.localeData().firstDayOfWeek() === 1 ? 1 : 0;
}
