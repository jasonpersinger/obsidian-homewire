import { describe, expect, test } from "vitest";
import { billStatus, formatBillLine, parseAmount, parseBills } from "../../src/core/bills";

describe("parseAmount (add-bill form)", () => {
  test.each([
    ["142.18", 142.18],
    ["$142.18", 142.18],
    ["1,204.50", 1204.5],
    [" 40 ", 40],
  ])("%s → %s", (raw, n) => expect(parseAmount(raw)).toBe(n));
  test("empty means no amount", () => expect(parseAmount("  ")).toBeNull());
  test.each(["abc", "1.234", "-5", "12.3.4"])("%s is invalid", (raw) => expect(parseAmount(raw)).toBe("invalid"));
});

const fixture = [
  "- [ ] Electric · $142.18 · due 2026-11-03",
  "- [x] Rent · due 2026-11-01",
  "- [ ] Truck note · $1,204.50 · due 2026-12-01",
  "- [X]   Gas   ·   $40   ·   due 2026-11-09  ",
  "- [ ] Water · due 11/3",
  "Some prose about bills.",
].join("\n");

describe("parseBills", () => {
  const bills = parseBills(fixture);
  test("parses an amount and keeps the raw text", () => {
    expect(bills[0]).toEqual({
      line: 0,
      raw: "Electric · $142.18 · due 2026-11-03",
      name: "Electric",
      amount: 142.18,
      due: "2026-11-03",
      paid: false,
    });
  });
  test("no amount, paid", () => {
    expect(bills[1]).toMatchObject({ line: 1, name: "Rent", amount: null, due: "2026-11-01", paid: true });
  });
  test("thousands separator", () => {
    expect(bills[2]).toMatchObject({ name: "Truck note", amount: 1204.5 });
  });
  test("extra spaces and uppercase X", () => {
    expect(bills[3]).toMatchObject({ line: 3, name: "Gas", amount: 40, due: "2026-11-09", paid: true });
  });
  test("unparseable lines are skipped", () => {
    expect(bills).toHaveLength(4);
    expect(bills.map((b) => b.name)).not.toContain("Water");
  });
});

describe("formatBillLine", () => {
  test("full line with two decimals", () => {
    expect(formatBillLine({ name: "Electric", amount: 142.18, due: "2026-11-03" })).toBe("- [ ] Electric · $142.18 · due 2026-11-03");
    expect(formatBillLine({ name: "Gas", amount: 40, due: "2026-11-09" })).toBe("- [ ] Gas · $40.00 · due 2026-11-09");
  });
  test("no amount drops the middle part", () => {
    expect(formatBillLine({ name: "Rent", amount: null, due: "2026-11-01" })).toBe("- [ ] Rent · due 2026-11-01");
  });
  test("a separator inside the name is replaced", () => {
    expect(formatBillLine({ name: "Phone · Mom", amount: null, due: "2026-11-01" })).toBe("- [ ] Phone - Mom · due 2026-11-01");
  });
  test("round-trips through parseBills", () => {
    const line = formatBillLine({ name: "Truck note", amount: 1204.5, due: "2026-12-01" });
    expect(parseBills(line)[0]).toMatchObject({ name: "Truck note", amount: 1204.5, due: "2026-12-01" });
  });
});

describe("billStatus", () => {
  test("late", () => expect(billStatus("2026-10-28", "2026-10-30")).toEqual({ kind: "late", days: 2 }));
  test("due today is soon, not late", () => expect(billStatus("2026-10-30", "2026-10-30")).toEqual({ kind: "soon", days: 0 }));
  test("three days out is soon", () => expect(billStatus("2026-11-02", "2026-10-30")).toEqual({ kind: "soon", days: 3 }));
  test("four days out is upcoming", () => expect(billStatus("2026-11-03", "2026-10-30")).toEqual({ kind: "upcoming", days: 4 }));
  test("year boundary", () => expect(billStatus("2027-01-02", "2026-12-31")).toEqual({ kind: "soon", days: 2 }));
});
