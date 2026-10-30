import { expect, test } from "vitest";
import fixture from "../fixtures/fear-greed.json";
import { FEAR_GREED_URL, parseFearGreed } from "../../src/core/fearGreed";

test("parses CNN's fear_and_greed block", () => {
  expect(parseFearGreed(fixture)).toEqual({
    score: 27.7058823529412,
    rating: "Fear",
    previousClose: 34.6,
    week: 16.685714285714287,
    month: 30.314285714285717,
    year: 37.05714285714286,
  });
});

test("rating is title-cased, including two-word ratings", () => {
  const fg = { ...fixture.fear_and_greed, rating: "extreme greed", score: 81 };
  expect(parseFearGreed({ fear_and_greed: fg })!.rating).toBe("Extreme Greed");
});

test("missing previous values become null", () => {
  const r = parseFearGreed({ fear_and_greed: { score: 50, rating: "neutral" } })!;
  expect(r).toMatchObject({ score: 50, rating: "Neutral", previousClose: null, week: null, month: null, year: null });
});

test("bad or blocked responses give null", () => {
  expect(parseFearGreed(null)).toBeNull();
  expect(parseFearGreed({})).toBeNull();
  expect(parseFearGreed({ fear_and_greed: { score: "x", rating: "fear" } })).toBeNull();
  expect(parseFearGreed({ fear_and_greed: { score: 120, rating: "fear" } })).toBeNull();
});

test("url", () => {
  expect(FEAR_GREED_URL).toBe("https://production.dataviz.cnn.io/index/fearandgreed/graphdata");
});
