import { describe, expect, test } from "vitest";
import { daysBetween, localYmd } from "../../src/core/dates";

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
