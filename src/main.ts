import { Plugin } from "obsidian";
import { notePath } from "./core/config";
import { Cache } from "./data/cache";
import { RadioPlayer } from "./obsidian/radioPlayer";
import { ConfigStore } from "./obsidian/configStore";
import { createHomepage } from "./obsidian/createHomepage";
import { DEFAULT_SETTINGS, HomewireSettingTab, type HomewireSettings } from "./settings";
import { HomeView } from "./ui/HomeView";
import { openAddBill, openAddTask } from "./ui/buttons";

export default class HomewirePlugin extends Plugin {
  settings: HomewireSettings = { ...DEFAULT_SETTINGS };
  configStore!: ConfigStore;
  cache!: Cache;
  readonly views = new Set<HomeView>();
  readonly radio = new RadioPlayer();

  async onload(): Promise<void> {
    const saved = { ...DEFAULT_SETTINGS, ...((await this.loadData()) as Partial<HomewireSettings> | null) };
    this.settings = { homePath: notePath(saved.homePath), configPath: notePath(saved.configPath), billsPath: notePath(saved.billsPath) };
    this.cache = new Cache({
      load: (k) => this.app.loadLocalStorage(k) as unknown,
      save: (k, v) => this.app.saveLocalStorage(k, v),
    });
    this.configStore = new ConfigStore(this.app, () => this.settings.configPath);
    this.configStore.register(this);
    this.app.workspace.onLayoutReady(() => void this.configStore.load());

    this.registerMarkdownCodeBlockProcessor("homewire", (_src, el, ctx) => ctx.addChild(new HomeView(el, this)));

    this.addSettingTab(new HomewireSettingTab(this.app, this));
    this.addCommand({ id: "create-homepage", name: "Create homepage", callback: () => void createHomepage(this) });
    this.addCommand({ id: "add-bill", name: "Add bill", callback: () => openAddBill(this) });
    this.addCommand({ id: "add-today", name: "Add task to today", callback: () => openAddTask(this) });
    this.addCommand({
      id: "refresh",
      name: "Refresh homepage",
      callback: () => {
        for (const view of this.views) view.refreshAll(true);
      },
    });
  }

  onunload(): void {
    this.radio.stop();
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    await this.configStore.load();
  }
}
