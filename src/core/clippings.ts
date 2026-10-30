// Notes saved by Obsidian Web Clipper (title, source, created in frontmatter).
import { isHttpUrl } from "./safeUrl";

export interface Clipping { path: string; title: string; source: string | null; site: string | null; created: number }

export function toClipping(path: string, basename: string, frontmatter: Record<string, unknown> | undefined, mtime: number): Clipping {
  const fm = frontmatter ?? {};
  const source = typeof fm.source === "string" && isHttpUrl(fm.source) ? fm.source : null;
  // A date-only value is read as local midnight, matching how Web Clipper writes it.
  const createdRaw = typeof fm.created === "string" ? fm.created : "";
  const created = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(createdRaw) ? `${createdRaw}T00:00` : createdRaw);
  return {
    path,
    title: typeof fm.title === "string" && fm.title.trim() ? fm.title.trim() : basename,
    source,
    site: source ? new URL(source).hostname.replace(/^www\./, "") : null,
    created: Number.isNaN(created) ? mtime : created,
  };
}

export function recentClippings(items: Clipping[], limit: number): Clipping[] {
  return [...items].sort((a, b) => b.created - a.created).slice(0, limit);
}
