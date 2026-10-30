// @vitest-environment happy-dom
import { describe, expect, test } from "vitest";
import { mergeGroup, parseFeed, type FeedItem } from "../../src/core/rss";

const rss = (items: string) => `<?xml version="1.0"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>T</title>${items}</channel></rss>`;

const twoItems = rss(`
  <item><title>First</title><link>https://ex.com/1</link><pubDate>Thu, 29 Oct 2026 10:00:00 GMT</pubDate>
    <description>&lt;p&gt;Hello &lt;b&gt;world&lt;/b&gt;&lt;/p&gt;</description>
    <media:content url="https://img/x.jpg" medium="image"/></item>
  <item><title>Second</title><link>https://ex.com/2</link><pubDate>Thu, 29 Oct 2026 11:00:00 GMT</pubDate></item>`);

describe("parseFeed RSS 2.0", () => {
  const items = parseFeed(twoItems, "Src");
  test("reads both items", () => expect(items).toHaveLength(2));
  test("summary is plain text", () => expect(items[0]!.summary).toBe("Hello world"));
  test("media:content image", () => expect(items[0]!.image).toBe("https://img/x.jpg"));
  test("published from pubDate", () => expect(items[0]!.published).toBe(Date.parse("Thu, 29 Oct 2026 10:00:00 GMT")));
  test("link and source", () => expect(items[1]).toMatchObject({ title: "Second", link: "https://ex.com/2", source: "Src", image: null }));
});

test("parseFeed Atom", () => {
  const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
    <entry><title>A1</title><link href="https://ex.com/a1"/><updated>2026-10-29T12:00:00Z</updated><summary>Sum</summary></entry></feed>`;
  expect(parseFeed(atom, "At")).toEqual([
    { title: "A1", link: "https://ex.com/a1", source: "At", published: Date.parse("2026-10-29T12:00:00Z"), summary: "Sum", image: null },
  ]);
});

describe("image fallbacks", () => {
  const img = (inner: string) => parseFeed(rss(`<item><title>X</title><link>https://e/x</link>${inner}</item>`), "S")[0]!.image;
  test("media:thumbnail", () => expect(img(`<media:thumbnail url="https://img/t.jpg"/>`)).toBe("https://img/t.jpg"));
  test("image enclosure", () => expect(img(`<enclosure url="https://img/e.png" type="image/png"/>`)).toBe("https://img/e.png"));
  test("non-image enclosure ignored", () => expect(img(`<enclosure url="https://a/e.mp3" type="audio/mpeg"/>`)).toBeNull());
  test("first img in description", () =>
    expect(img(`<description>&lt;p&gt;x &lt;img src="https://img/d.gif"&gt;&lt;/p&gt;</description>`)).toBe("https://img/d.gif"));
});

describe("hostile content", () => {
  const item = parseFeed(
    rss(`<item><title>&lt;img src=x onerror=alert(1)&gt;</title><link>javascript:alert(1)</link>
      <media:content url="javascript:alert(2)"/></item>`),
    "Evil",
  )[0]!;
  test("title is literal text", () => expect(item.title).toBe("<img src=x onerror=alert(1)>"));
  test("javascript link dropped", () => expect(item.link).toBeNull());
  test("javascript image dropped", () => expect(item.image).toBeNull());
});

describe("dead feeds never throw", () => {
  test("html error page", () => expect(parseFeed("<!DOCTYPE html><html>403</html>", "X")).toEqual([]));
  test("empty", () => expect(parseFeed("", "X")).toEqual([]));
  test("truncated", () => expect(parseFeed("<rss><channel>", "X")).toEqual([]));
});

test("summary truncated to 280 chars with an ellipsis", () => {
  const long = "word ".repeat(100);
  const s = parseFeed(rss(`<item><title>L</title><description>${long}</description></item>`), "S")[0]!.summary;
  expect(s.length).toBe(280);
  expect(s.endsWith("…")).toBe(true);
});

test("mergeGroup sorts newest first, nulls last, then limits", () => {
  const mk = (title: string, published: number | null): FeedItem => ({ title, link: null, source: "s", published, summary: "", image: null });
  const a = mk("a", 1), b = mk("b", 3), c = mk("c", null);
  expect(mergeGroup([[a], [b, c]], 2)).toEqual([b, a]);
  expect(mergeGroup([[c], [a]], 5)).toEqual([a, c]);
});
