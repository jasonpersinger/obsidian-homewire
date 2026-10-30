// Reads the YAML block of the config note; keeps the last good config on errors.
import { debounce, Events, parseYaml, TFile, type App, type Plugin } from "obsidian";
import { extractYamlBlock, validateConfig, type HomeConfig } from "../core/config";

export class ConfigStore extends Events {
  config: HomeConfig | null = null;
  error: string | null = null;
  missing = false;

  constructor(private readonly app: App, private readonly getPath: () => string) {
    super();
  }

  async load(): Promise<void> {
    const file = this.app.vault.getFileByPath(this.getPath());
    if (!file) {
      this.missing = true;
      this.config = null;
      this.error = null;
    } else {
      this.missing = false;
      const yaml = extractYamlBlock(await this.app.vault.cachedRead(file));
      let parsed: unknown;
      try {
        parsed = yaml === null ? null : parseYaml(yaml);
      } catch (e) {
        parsed = undefined;
        this.error = `Config YAML: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`;
      }
      if (parsed !== undefined) {
        const { config, errors } = yaml === null ? { config: null, errors: ["no ```yaml block found"] } : validateConfig(parsed);
        if (config) {
          this.config = config;
          this.error = null;
        } else {
          this.error = `Config: ${errors[0]}`;
        }
      }
    }
    this.trigger("change");
  }

  register(plugin: Plugin): void {
    const reload = debounce(() => void this.load(), 300, true);
    const touches = (f: unknown, oldPath?: string) =>
      f instanceof TFile && (f.path === this.getPath() || oldPath === this.getPath());
    plugin.registerEvent(this.app.vault.on("modify", (f) => touches(f) && reload()));
    plugin.registerEvent(this.app.vault.on("create", (f) => touches(f) && reload()));
    plugin.registerEvent(this.app.vault.on("delete", (f) => touches(f) && reload()));
    plugin.registerEvent(this.app.vault.on("rename", (f, old) => touches(f, old) && reload()));
  }
}
