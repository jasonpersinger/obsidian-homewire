import { describe, expect, test } from "vitest";
import type { FeedItem } from "../../src/core/rss";
import { daySummary, wireItems } from "../../src/core/wire";

const item = (title: string, published: number | null, link: string | null = `https://x/${published}`): FeedItem =>
  ({ title, link, source: "S", published, summary: "", image: null });

describe("wireItems", () => {
  test("merges groups newest first and limits", () => {
    const out = wireItems([[item("a", 1), item("c", 3)], [item("b", 2)]], 2);
    expect(out.map((i) => i.title)).toEqual(["c", "b"]);
  });
  test("drops the same story arriving through two feeds (title match, case and punctuation insensitive)", () => {
    const out = wireItems([[item("Big Oil Scores $56B", 5)], [item("big oil scores $56b!", 4), item("Other", 3)]], 10);
    expect(out.map((i) => i.title)).toEqual(["Big Oil Scores $56B", "Other"]);
  });
  test("skips items without a usable link or title", () => {
    expect(wireItems([[item("no link", 3, null), item("", 2), item("ok", 1)]], 10).map((i) => i.title)).toEqual(["ok"]);
  });
});

describe("daySummary", () => {
  const today = "2026-10-30";
  const now = Date.parse("2026-10-30T12:49:00");
  const sunset = { at: Date.parse("2026-10-30T18:24:00"), label: "6:24 PM" };
  test("all parts", () => {
    expect(daySummary({ openTasks: 3, nextBill: { name: "Phone", due: "2026-11-05" }, sunset, today, now }))
      .toBe("3 open · next bill: Phone in 6d · sunset 6:24 PM");
  });
  test("nothing open, bill due today, late bill", () => {
    expect(daySummary({ openTasks: 0, nextBill: { name: "AEP", due: today }, sunset: null, today, now })).toBe("nothing open · AEP due today");
    expect(daySummary({ openTasks: 1, nextBill: { name: "AEP", due: "2026-10-28" }, sunset: null, today, now })).toBe("1 open · AEP 2d late");
  });
  test("after sunset and unknown parts are left out", () => {
    expect(daySummary({ openTasks: null, nextBill: null, sunset, today, now: Date.parse("2026-10-30T19:00:00") })).toBe("");
  });
});
