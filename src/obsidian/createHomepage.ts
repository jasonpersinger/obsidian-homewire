// "Create homepage": makes the three notes only when missing; never overwrites.
import { normalizePath } from "obsidian";
import { DEFAULT_CONFIG_NOTE } from "../core/config";
import { localYmd } from "../core/dates";
import type SalamanderHomePlugin from "../main";
import { ensureFolder } from "./vaultEdits";

const HOME_NOTE = "---\ncssclasses: [sh-home]\n---\n```salamander-home\n```\n";
const billsNote = () =>
  `One bill per line. Tick a bill when it's paid.\n\n- [ ] Example bill · $0.00 · due ${localYmd(new Date())}\n`;

export async function createHomepage(plugin: SalamanderHomePlugin): Promise<void> {
  const { app, settings } = plugin;
  const files: [string, string][] = [
    [settings.homePath, HOME_NOTE],
    [settings.configPath, DEFAULT_CONFIG_NOTE],
    [settings.billsPath, billsNote()],
  ];
  for (const [raw, content] of files) {
    const path = normalizePath(raw);
    if (app.vault.getAbstractFileByPath(path)) continue;
    await ensureFolder(app, path);
    await app.vault.create(path, content);
  }
  await app.workspace.openLinkText(normalizePath(settings.homePath), "", false);
}
