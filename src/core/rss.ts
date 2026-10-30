// RSS 2.0 / Atom parsing. Feed content is untrusted: everything returned is
// plain text or an http(s) URL, and this module never throws on bad input.
import { isHttpUrl } from "./safeUrl";

export interface FeedItem {
  title: string;
  link: string | null;
  source: string;
  published: number | null;
  summary: string;
  image: string | null;
}

const SUMMARY_MAX = 280;

const text = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const first = (parent: Element, ...tags: string[]) => {
  for (const t of tags) {
    const el = parent.getElementsByTagName(t)[0];
    if (el) return el;
  }
  return null;
};
const httpOrNull = (v: string | null | undefined) => (v && isHttpUrl(v.trim()) ? v.trim() : null);

/** Parses an HTML fragment in a detached, inert document (no scripts run, nothing loads). */
const htmlDoc = (html: string) => new DOMParser().parseFromString(html, "text/html");

function truncate(s: string): string {
  return s.length <= SUMMARY_MAX ? s : s.slice(0, SUMMARY_MAX - 1) + "…";
}

function pickImage(item: Element, descriptionHtml: string): string | null {
  const media = first(item, "media:content", "media:thumbnail");
  const fromMedia = httpOrNull(media?.getAttribute("url"));
  if (fromMedia) return fromMedia;
  const enc = item.getElementsByTagName("enclosure")[0];
  if (enc && (enc.getAttribute("type") ?? "").startsWith("image/")) {
    const e = httpOrNull(enc.getAttribute("url"));
    if (e) return e;
  }
  if (descriptionHtml.includes("<img")) return httpOrNull(htmlDoc(descriptionHtml).querySelector("img")?.getAttribute("src"));
  return null;
}

export function parseFeed(xml: string, source: string): FeedItem[] {
  try {
    if (!xml.trim()) return [];
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const root = doc.documentElement;
    if (!root || doc.getElementsByTagName("parsererror").length) return [];
    const isAtom = root.nodeName === "feed";
    if (!isAtom && root.nodeName !== "rss" && root.nodeName !== "rdf:RDF") return [];

    const nodes = Array.from(doc.getElementsByTagName(isAtom ? "entry" : "item"));
    return nodes.map((item) => {
      const descEl = first(item, "description", "summary", "content");
      const descriptionHtml = descEl?.textContent ?? "";
      const linkEl = first(item, "link");
      const rawLink = isAtom ? linkEl?.getAttribute("href") : text(linkEl);
      const dateText = text(first(item, "pubDate", "published", "updated", "dc:date"));
      const published = dateText ? Date.parse(dateText) : NaN;
      return {
        title: text(first(item, "title")),
        link: httpOrNull(rawLink),
        source,
        published: Number.isNaN(published) ? null : published,
        summary: truncate(text(htmlDoc(descriptionHtml).body)),
        image: pickImage(item, descriptionHtml),
      };
    });
  } catch {
    return [];
  }
}

export function mergeGroup(perFeed: FeedItem[][], limit: number): FeedItem[] {
  return perFeed
    .flat()
    .sort((a, b) => (b.published ?? -Infinity) - (a.published ?? -Infinity))
    .slice(0, limit);
}
