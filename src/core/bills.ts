// Bill lines: `- [ ] Electric · $142.18 · due 2026-11-03` (amount optional).
import { daysBetween } from "./dates";

export interface Bill { line: number; raw: string; name: string; amount: number | null; due: string; paid: boolean }
export type BillStatus = { kind: "late" | "soon" | "upcoming"; days: number };

const BILL = /^\s*[-*] \[( |x|X)\]\s+((.+?)\s*·\s*(?:\$([\d,]+(?:\.\d{1,2})?)\s*·\s*)?due\s+(\d{4}-\d{2}-\d{2}))\s*$/;

export function parseBills(markdown: string): Bill[] {
  const out: Bill[] = [];
  markdown.split(/\r?\n/).forEach((l, line) => {
    const m = BILL.exec(l);
    if (!m) return;
    out.push({
      line,
      raw: m[2]!.trim(),
      name: m[3]!.trim(),
      amount: m[4] ? Number(m[4].replace(/,/g, "")) : null,
      due: m[5]!,
      paid: m[1] !== " ",
    });
  });
  return out;
}

export function formatBillLine(input: { name: string; amount: number | null; due: string }): string {
  const name = input.name.replace(/·/g, "-").trim();
  const amount = input.amount === null ? "" : ` · $${input.amount.toFixed(2)}`;
  return `- [ ] ${name}${amount} · due ${input.due}`;
}

export function billStatus(due: string, today: string): BillStatus {
  const d = daysBetween(today, due);
  if (d < 0) return { kind: "late", days: -d };
  return { kind: d <= 3 ? "soon" : "upcoming", days: d };
}
