import { describe, expect, test } from "vitest";
import { parse } from "yaml";
import { DEFAULT_CONFIG_NOTE, extractYamlBlock, groupCacheKey, notePath, validateConfig } from "../../src/core/config";

const defaults = () => validateConfig(parse(extractYamlBlock(DEFAULT_CONFIG_NOTE)!));

describe("extractYamlBlock", () => {
  test("returns the body of the first yaml fence", () => {
    expect(extractYamlBlock("intro\n```yaml\na: 1\n```\n")).toBe("a: 1\n");
  });
  test("returns null without a yaml fence", () => {
    expect(extractYamlBlock("just text\n```js\nx\n```")).toBeNull();
  });
});

describe("default config note", () => {
  test("validates cleanly with no weather location", () => {
    const { config, errors } = defaults();
    expect(errors).toEqual([]);
    expect(config!.weather).toEqual({ units: "imperial" });
  });
  test("ships the neutral default buttons", () => {
    const { config } = defaults();
    expect(config!.buttons.map((b) => b.label)).toEqual(["+ Capture", "Daily", "Search", "Bills"]);
    expect(config!.buttons[2]!.action).toEqual({ command: "global-search:open" });
  });
  test("has news groups with feeds and the index tickers", () => {
    const { config } = defaults();
    expect(config!.news.length).toBeGreaterThanOrEqual(1);
    for (const g of config!.news) expect(g.feeds.length).toBeGreaterThanOrEqual(1);
    const symbols = config!.markets.flatMap((g) => g.markets.map((m) => m.symbol));
    expect(symbols).toEqual(expect.arrayContaining(["^GSPC", "^DJI", "BTC-USD"]));
  });
  test("contains no personal values", () => {
    expect(DEFAULT_CONFIG_NOTE).not.toMatch(/Roanoke|100\.119|DAILY/);
  });
});

describe("validateConfig defaults for optional fields", () => {
  test("news group and market group get default numbers and style", () => {
    const { config, errors } = validateConfig({
      news: [{ title: "N", feeds: [{ url: "https://x/rss", title: "X" }] }],
      markets: [{ title: "M", markets: [{ symbol: "^GSPC", name: "S&P" }] }],
    });
    expect(errors).toEqual([]);
    expect(config!.news[0]).toMatchObject({ limit: 14, collapseAfter: 6, cacheMinutes: 15, style: "list" });
    expect(config!.markets[0]!.collapseAfter).toBe(6);
    expect(config!.weather.units).toBe("imperial");
    expect(config!.buttons).toEqual([]);
  });
});

describe("validateConfig errors", () => {
  const errorsFor = (raw: unknown) => {
    const r = validateConfig(raw);
    expect(r.config).toBeNull();
    return r.errors.join("\n");
  };
  test("news not a list", () => {
    expect(errorsFor({ news: "x" })).toMatch(/news/);
  });
  test("feed without url", () => {
    expect(errorsFor({ news: [{ title: "N", feeds: [{ title: "X" }] }] })).toMatch(/news\[0\]\.feeds\[0\]\.url/);
  });
  test("bad units", () => {
    expect(errorsFor({ weather: { units: "kelvin" } })).toMatch(/weather\.units/);
  });
  test("button without a recognised action", () => {
    expect(errorsFor({ buttons: [{ label: "B", action: { nope: 1 } }] })).toMatch(/buttons\[0\]\.action/);
  });
  test("null input gives exactly one error", () => {
    const r = validateConfig(null);
    expect(r.config).toBeNull();
    expect(r.errors).toHaveLength(1);
  });
});

describe("review fixes", () => {
  test("cacheMinutes below 1 is rejected (would refresh in a tight loop)", () => {
    for (const cacheMinutes of [0, -5]) {
      const r = validateConfig({ news: [{ title: "N", cacheMinutes, feeds: [{ url: "https://x/rss", title: "X" }] }] });
      expect(r.config).toBeNull();
      expect(r.errors.join()).toMatch(/news\[0\]\.cacheMinutes/);
    }
  });
  test("negative limit and collapseAfter are rejected", () => {
    const r = validateConfig({
      news: [{ title: "N", limit: -1, feeds: [{ url: "https://x/rss", title: "X" }] }],
      markets: [{ title: "M", collapseAfter: -2, markets: [{ symbol: "A", name: "A" }] }],
    });
    expect(r.errors.join()).toMatch(/news\[0\]\.limit/);
    expect(r.errors.join()).toMatch(/markets\[0\]\.collapseAfter/);
  });
  test("groupCacheKey changes when the feeds change, not just the title", () => {
    const a = groupCacheKey("news", "Top", ["https://a", "6"]);
    expect(groupCacheKey("news", "Top", ["https://a", "6"])).toBe(a);
    expect(groupCacheKey("news", "Top", ["https://b", "6"])).not.toBe(a);
    expect(groupCacheKey("markets", "Top", ["https://a", "6"])).not.toBe(a);
  });
  test("notePath normalizes and adds .md", () => {
    expect(notePath("Bills")).toBe("Bills.md");
    expect(notePath(" Finance//Bills.md ")).toBe("Finance/Bills.md");
    expect(notePath("/Home Config")).toBe("Home Config.md");
  });
});

describe("banner and clippings options", () => {
  const minimal = {};
  test("defaults: fear & greed off, clippings on from the Clippings folder", () => {
    const { config } = validateConfig(minimal);
    expect(config!.banner).toEqual({ fearGreed: false, clock: true, marketSession: true, wire: true, summary: true });
    expect(config!.clippings).toEqual({ folder: "Clippings", limit: 5 });
  });
  test("can turn fear & greed on and configure or hide clippings", () => {
    expect(validateConfig({ banner: { fearGreed: true } }).config!.banner.fearGreed).toBe(true);
    expect(validateConfig({ banner: { clock: false, marketSession: false } }).config!.banner).toEqual({ fearGreed: false, clock: false, marketSession: false, wire: true, summary: true });
    expect(validateConfig({ clippings: { folder: "Reading", limit: 8 } }).config!.clippings).toEqual({ folder: "Reading", limit: 8 });
    expect(validateConfig({ clippings: false }).config!.clippings).toBeNull();
  });
  test("bad values are errors", () => {
    expect(validateConfig({ banner: { fearGreed: "yes" } }).errors.join()).toMatch(/banner\.fearGreed/);
    expect(validateConfig({ banner: { clock: 1 } }).errors.join()).toMatch(/banner\.clock/);
    expect(validateConfig({ clippings: { limit: 0 } }).errors.join()).toMatch(/clippings\.limit/);
  });
  test("the default note leaves fear & greed off", () => {
    expect(defaults().config!.banner.fearGreed).toBe(false);
  });
});
