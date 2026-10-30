import { PluginSettingTab, Setting, type App } from "obsidian";
import { notePath } from "./core/config";
import type SalamanderHomePlugin from "./main";

export interface SalamanderHomeSettings { homePath: string; configPath: string; billsPath: string }

export const DEFAULT_SETTINGS: SalamanderHomeSettings = {
  homePath: "Home.md",
  configPath: "Home Config.md",
  billsPath: "Bills.md",
};

export class SalamanderHomeSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: SalamanderHomePlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const field = (key: keyof SalamanderHomeSettings, name: string, desc: string) =>
      new Setting(containerEl).setName(name).setDesc(desc).addText((t) =>
        t.setPlaceholder(DEFAULT_SETTINGS[key]).setValue(this.plugin.settings[key]).onChange(async (v) => {
          this.plugin.settings[key] = v.trim() ? notePath(v) : DEFAULT_SETTINGS[key];
          await this.plugin.saveSettings();
        }),
      );
    field("homePath", "Homepage note", "The note that holds the salamander-home block.");
    field("configPath", "Config note", "Feeds, tickers, weather and buttons, as a YAML block.");
    field("billsPath", "Bills note", "One bill per line: - [ ] Name · $12.34 · due 2026-11-03");
  }
}
