import { debounce, normalizePath, TFile, type TAbstractFile } from "obsidian";
import { recentClippings, toClipping } from "../core/clippings";
import type { ClippingsConfig } from "../core/config";
import { relativeAge } from "../core/dates";
import type { HomeView } from "./HomeView";
import { aliveFlag, panelFrame } from "./panel";

export function mountClippings(view: HomeView, el: HTMLElement, cfg: ClippingsConfig): void {
  const { app } = view.plugin;
  const sec = view.section();
  const alive = aliveFlag(sec);
  const f = panelFrame(el, "Recent clippings");
  const prefix = `${normalizePath(cfg.folder)}/`;
  const inFolder = (file: TAbstractFile | null, oldPath?: string) =>
    (file instanceof TFile && file.extension === "md" && file.path.startsWith(prefix)) || !!oldPath?.startsWith(prefix);

  const draw = () => {
    if (!alive()) return;
    f.body.empty();
    const all = app.vault.getMarkdownFiles().filter((file) => file.path.startsWith(prefix))
      .map((file) => toClipping(file.path, file.basename, app.metadataCache.getFileCache(file)?.frontmatter, file.stat.mtime));
    const items = recentClippings(all, cfg.limit);
    if (items.length === 0) {
      f.body.createDiv({ cls: "hw-muted", text: "Nothing clipped yet." });
      return;
    }
    const now = Date.now();
    for (const c of items) {
      const row = f.body.createDiv({ cls: "hw-clip" });
      const title = row.createEl("a", { cls: "hw-link hw-clip-title", text: c.title, href: "#" });
      title.addEventListener("click", (e) => {
        e.preventDefault();
        void app.workspace.openLinkText(c.path, "", false);
      });
      const meta = row.createDiv({ cls: "hw-faint" });
      meta.createSpan({ text: [c.site, relativeAge(now - c.created)].filter(Boolean).join(" · ") });
      if (c.source) {
        const out = meta.createEl("a", { cls: "hw-link hw-clip-out", text: " ↗", href: c.source, attr: { "aria-label": "Open original" } });
        out.setAttr("target", "_blank");
        out.setAttr("rel", "noopener noreferrer");
      }
    }
  };
  const redraw = debounce(draw, 300, true);

  // metadataCache "changed" fires after a new clip's frontmatter is parsed.
  sec.registerEvent(app.metadataCache.on("changed", (file) => inFolder(file) && redraw()));
  sec.registerEvent(app.vault.on("delete", (file) => inFolder(file) && redraw()));
  sec.registerEvent(app.vault.on("rename", (file, old) => inFolder(file, old) && redraw()));
  draw();
}
