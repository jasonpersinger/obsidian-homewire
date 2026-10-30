import { Plugin } from "obsidian";
import { Cache } from "./data/cache";
import { ConfigStore } from "./obsidian/configStore";
import { createHomepage } from "./obsidian/createHomepage";
import { DEFAULT_SETTINGS, SalamanderHomeSettingTab, type SalamanderHomeSettings } from "./settings";
import { HomeView } from "./ui/HomeView";
import { openAddBill, openAddTask } from "./ui/buttons";

export default class SalamanderHomePlugin extends Plugin {
  settings: SalamanderHomeSettings = { ...DEFAULT_SETTINGS };
  configStore!: ConfigStore;
  cache!: Cache;
  readonly views = new Set<HomeView>();

  async onload(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...((await this.loadData()) as Partial<SalamanderHomeSettings> | null) };
    this.cache = new Cache({
      load: (k) => this.app.loadLocalStorage(k) as unknown,
      save: (k, v) => this.app.saveLocalStorage(k, v),
    });
    this.configStore = new ConfigStore(this.app, () => this.settings.configPath);
    this.configStore.register(this);
    this.app.workspace.onLayoutReady(() => void this.configStore.load());

    this.registerMarkdownCodeBlockProcessor("salamander-home", (_src, el, ctx) => ctx.addChild(new HomeView(el, this)));

    this.addSettingTab(new SalamanderHomeSettingTab(this.app, this));
    this.addCommand({ id: "create-homepage", name: "Create homepage", callback: () => void createHomepage(this) });
    this.addCommand({ id: "add-bill", name: "Add bill", callback: () => openAddBill(this) });
    this.addCommand({ id: "add-today", name: "Add task to today", callback: () => openAddTask(this) });
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    await this.configStore.load();
  }
}
