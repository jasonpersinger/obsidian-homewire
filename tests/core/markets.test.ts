import { expect, test } from "vitest";
import { parseYahooChart, yahooChartUrl } from "../../src/core/markets";

const chart = (meta: object, close: (number | null)[]) => ({
  chart: { result: [{ meta, indicators: { quote: [{ close }] } }], error: null },
});

test("change is against the second-to-last non-null close (Glance's rule)", () => {
  const q = parseYahooChart(chart({ regularMarketPrice: 105, currency: "USD" }, [100, null, 98, 100]), "^GSPC", "S&P 500")!;
  expect(q).toMatchObject({ symbol: "^GSPC", name: "S&P 500", price: 105, currency: "USD", closes: [100, 98, 100] });
  expect(q.changePct).toBeCloseTo(7.1429, 3);
});

test("fewer than two closes gives zero change", () => {
  expect(parseYahooChart(chart({ regularMarketPrice: 5, currency: "USD" }, [5]), "X", "X")!.changePct).toBe(0);
});

test("missing result or an error gives null", () => {
  expect(parseYahooChart({ chart: { result: null, error: { code: "Not Found" } } }, "BAD", "Bad")).toBeNull();
  expect(parseYahooChart({}, "X", "X")).toBeNull();
  expect(parseYahooChart(null, "X", "X")).toBeNull();
});

test("url encodes the symbol", () => {
  expect(yahooChartUrl("^GSPC")).toBe("https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=1mo&interval=1d");
});
