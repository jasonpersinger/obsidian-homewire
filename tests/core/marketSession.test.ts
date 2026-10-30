import { describe, expect, test } from "vitest";
import { isTradingDay, marketSession, sessionText } from "../../src/core/marketSession";

const at = (iso: string) => new Date(iso); // ISO strings with explicit offsets
const ms = (iso: string) => Date.parse(iso);

describe("marketSession on a normal Friday (Oct 30 2026, EDT)", () => {
  test("pre-market before 9:30", () => {
    expect(marketSession(at("2026-10-30T08:00-04:00"))).toEqual({ kind: "pre", changeAt: ms("2026-10-30T09:30-04:00"), opensAt: ms("2026-10-30T09:30-04:00") });
  });
  test("open until 16:00", () => {
    expect(marketSession(at("2026-10-30T10:42-04:00"))).toMatchObject({ kind: "open", changeAt: ms("2026-10-30T16:00-04:00") });
  });
  test("after hours: next open is Monday 9:30 EST, after the DST change", () => {
    expect(marketSession(at("2026-10-30T17:00-04:00"))).toEqual({ kind: "after", changeAt: ms("2026-10-30T20:00-04:00"), opensAt: ms("2026-11-02T09:30-05:00") });
  });
  test("overnight before pre-market is closed", () => {
    expect(marketSession(at("2026-10-30T02:00-04:00"))).toMatchObject({ kind: "closed", opensAt: ms("2026-10-30T09:30-04:00") });
  });
  test("weekend is closed", () => {
    expect(marketSession(at("2026-10-31T12:00-04:00"))).toMatchObject({ kind: "closed", opensAt: ms("2026-11-02T09:30-05:00") });
  });
});

describe("NYSE holidays and early closes", () => {
  test.each([
    ["2026-11-26", false, "Thanksgiving"],
    ["2026-12-25", false, "Christmas"],
    ["2026-07-03", false, "Independence Day observed (Jul 4 is a Saturday)"],
    ["2027-03-26", false, "Good Friday 2027"],
    ["2027-06-18", false, "Juneteenth observed (Jun 19 is a Saturday)"],
    ["2027-01-18", false, "MLK Day 2027"],
    ["2026-05-25", false, "Memorial Day 2026"],
    ["2026-09-07", false, "Labor Day 2026"],
    ["2027-12-31", true, "Dec 31 2027 trades: New Year's on a Saturday is not observed"],
    ["2026-11-27", true, "day after Thanksgiving trades (early close)"],
  ])("%s trading=%s (%s)", (ymd, trading) => expect(isTradingDay(ymd)).toBe(trading));

  test("day after Thanksgiving closes at 13:00", () => {
    expect(marketSession(at("2026-11-27T11:00-05:00"))).toMatchObject({ kind: "open", changeAt: ms("2026-11-27T13:00-05:00") });
  });
  test("Christmas Eve closes at 13:00", () => {
    expect(marketSession(at("2026-12-24T11:00-05:00"))).toMatchObject({ kind: "open", changeAt: ms("2026-12-24T13:00-05:00") });
  });
  test("no early close on Jul 2 when Jul 3 is the observed holiday", () => {
    expect(marketSession(at("2026-07-02T11:00-04:00"))).toMatchObject({ kind: "open", changeAt: ms("2026-07-02T16:00-04:00") });
  });
  test("Thanksgiving morning: closed, opens Friday 9:30", () => {
    expect(marketSession(at("2026-11-26T10:00-05:00"))).toMatchObject({ kind: "closed", opensAt: ms("2026-11-27T09:30-05:00") });
  });
});

describe("sessionText", () => {
  const now = at("2026-10-30T08:18-04:00");
  test("pre-market counts down to the open", () => {
    expect(sessionText(marketSession(now), now)).toEqual({ tag: "Pre-market", detail: "opens in 1h 12m" });
  });
  test("open counts down to the close", () => {
    const t = at("2026-10-30T12:55-04:00");
    expect(sessionText(marketSession(t), t)).toEqual({ tag: "Open", detail: "closes in 3h 05m" });
  });
  test("under an hour shows minutes only", () => {
    const t = at("2026-10-30T15:15-04:00");
    expect(sessionText(marketSession(t), t).detail).toBe("closes in 45m");
  });
  test("after hours and closed show the next open in ET", () => {
    const t = at("2026-10-30T17:00-04:00");
    expect(sessionText(marketSession(t), t)).toEqual({ tag: "After hours", detail: "opens Mon 9:30 ET" });
    const w = at("2026-10-31T12:00-04:00");
    expect(sessionText(marketSession(w), w)).toEqual({ tag: "Closed", detail: "opens Mon 9:30 ET" });
  });
});
