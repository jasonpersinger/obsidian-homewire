import { describe, expect, test } from "vitest";
import { parse } from "yaml";
import { DEFAULT_CONFIG_NOTE, extractYamlBlock, validateConfig } from "../../src/core/config";

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
