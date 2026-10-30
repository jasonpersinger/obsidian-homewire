import { describe, expect, test } from "vitest";
import { markdownUnder, recentClippings, toClipping } from "../../src/core/clippings";

// Frontmatter as Obsidian Web Clipper writes it.
const webClipper = {
  title: "Why the Markets Don't Care About the Midterms",
  source: "https://www.nytimes.com/2026/10/30/business/markets.html",
  author: ["[[Jane Doe]]"],
  published: "2026-10-29",
  created: "2026-10-30",
  description: "…",
  tags: ["clippings"],
};

describe("toClipping", () => {
  test("Web Clipper frontmatter", () => {
    expect(toClipping("Clippings/Why the Markets.md", "Why the Markets", webClipper, 1000)).toEqual({
      path: "Clippings/Why the Markets.md",
      title: "Why the Markets Don't Care About the Midterms",
      source: "https://www.nytimes.com/2026/10/30/business/markets.html",
      site: "nytimes.com",
      created: Date.parse("2026-10-30T00:00"),
    });
  });
  test("no frontmatter falls back to file name and modified time", () => {
    expect(toClipping("Clippings/Note.md", "Note", undefined, 1234)).toEqual({
      path: "Clippings/Note.md", title: "Note", source: null, site: null, created: 1234,
    });
  });
  test("a non-http source is dropped", () => {
    const c = toClipping("a.md", "a", { source: "javascript:alert(1)", created: "2026-10-30" }, 0);
    expect(c.source).toBeNull();
    expect(c.site).toBeNull();
  });
  test("created with a time, and an unparseable created", () => {
    expect(toClipping("a.md", "a", { created: "2026-10-30T09:15" }, 0).created).toBe(Date.parse("2026-10-30T09:15"));
    expect(toClipping("a.md", "a", { created: "yesterday-ish" }, 77).created).toBe(77);
  });
  test("non-string title falls back to the file name", () => {
    expect(toClipping("a.md", "a", { title: 42 }, 0).title).toBe("a");
  });
});

test("recentClippings sorts newest first and limits", () => {
  const mk = (title: string, created: number) => ({ path: `${title}.md`, title, source: null, site: null, created });
  expect(recentClippings([mk("old", 1), mk("new", 3), mk("mid", 2)], 2).map((c) => c.title)).toEqual(["new", "mid"]);
});

describe("markdownUnder (walks one folder instead of the whole vault)", () => {
  const md = (path: string) => ({ path, extension: "md" });
  test("collects markdown files recursively and skips other files", () => {
    const tree = {
      children: [
        md("Clippings/a.md"),
        { path: "Clippings/img.png", extension: "png" },
        { children: [md("Clippings/sub/b.md"), { children: [md("Clippings/sub/deep/c.md")] }] },
      ],
    };
    expect(markdownUnder(tree).map((f) => f.path)).toEqual(["Clippings/a.md", "Clippings/sub/b.md", "Clippings/sub/deep/c.md"]);
  });
  test("a missing folder gives nothing", () => {
    expect(markdownUnder(null)).toEqual([]);
  });
});
