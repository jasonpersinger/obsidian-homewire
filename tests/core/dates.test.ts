import { describe, expect, test } from "vitest";
import { dayOfYear, daysBetween, isoWeek, localYmd, monthGrid, relativeAge } from "../../src/core/dates";

describe("isoWeek and dayOfYear", () => {
  test.each([
    [2026, 9, 30, 44],
    [2027, 0, 1, 53],
    [2026, 0, 1, 1],
    [2024, 11, 30, 1],
  ])("%i-%i-%i is week %i", (y, m, d, w) => expect(isoWeek(new Date(y, m, d))).toBe(w));
  test("day of year", () => expect(dayOfYear(new Date(2026, 9, 30))).toBe(303));
});

describe("monthGrid", () => {
  test("October 2026, Sunday start", () => {
    const g = monthGrid(2026, 9, 0);
    expect(g).toHaveLength(42);
    expect(g[0]).toEqual({ date: "2026-09-27", inMonth: false });
    expect(g[4]).toEqual({ date: "2026-10-01", inMonth: true });
  });
  test("October 2026, Monday start", () => expect(monthGrid(2026, 9, 1)[0]!.date).toBe("2026-09-28"));
  test("February 2026 starts on a Sunday", () => {
    expect(monthGrid(2026, 1, 0)[0]!.date).toBe("2026-02-01");
    expect(monthGrid(2026, 1, 1)[0]!.date).toBe("2026-01-26");
    expect(monthGrid(2026, 1, 1)).toHaveLength(42);
  });
  test("December wraps into the next year", () => expect(monthGrid(2026, 11, 0)[41]!.inMonth).toBe(false));
});

test("relativeAge", () => {
  expect(relativeAge(30_000)).toBe("now");
  expect(relativeAge(5 * 60_000)).toBe("5m");
  expect(relativeAge(2 * 3_600_000)).toBe("2h");
  expect(relativeAge(3 * 86_400_000)).toBe("3d");
});

describe("localYmd", () => {
  test("uses local date parts", () => {
    expect(localYmd(new Date(2026, 9, 30, 23, 59))).toBe("2026-10-30");
  });
});

describe("daysBetween", () => {
  test("across a year boundary", () => expect(daysBetween("2026-12-31", "2027-01-02")).toBe(2));
  test("across the US DST change", () => expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2));
  test("negative when to is earlier", () => expect(daysBetween("2026-10-30", "2026-10-28")).toBe(-2));
});
