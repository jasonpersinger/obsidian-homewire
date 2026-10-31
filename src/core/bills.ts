// Bill lines: `- [ ] Electric · $142.18 · due 2026-11-03` (amount optional).
import { daysBetween } from "./dates";
import { codeLines } from "./tasks";

export interface Bill { line: number; raw: string; name: string; amount: number | null; due: string; paid: boolean }
export type BillStatus = { kind: "late" | "soon" | "upcoming"; days: number };

const BILL = /^\s*[-*] \[( |x|X)\]\s+((.+?)\s*·\s*(?:\$?\s*([\d,]+(?:\.\d{1,2})?)\s*·\s*)?due\s+(\d{4}-\d{2}-\d{2}))\s*$/;

/** Rejects dates like 2026-13-45 or 2026-02-30 that the pattern alone would accept. */
function isRealDate(ymd: string): boolean {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m! - 1 && t.getUTCDate() === d;
}

export function parseBills(markdown: string): Bill[] {
  const out: Bill[] = [];
  const lines = markdown.split(/\r?\n/);
  const code = codeLines(lines);
  lines.forEach((l, line) => {
    if (code[line]) return;
    const m = BILL.exec(l);
    if (!m || !isRealDate(m[5]!)) return;
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

/** Parses "142.18", "$142.18" or "1,204.50"; blank means no amount. */
export function parseAmount(raw: string): number | null | "invalid" {
  const s = raw.replace(/[$,\s]/g, "");
  if (!s) return null;
  return /^\d+(\.\d{1,2})?$/.test(s) ? Number(s) : "invalid";
}

export function billStatus(due: string, today: string): BillStatus {
  const d = daysBetween(today, due);
  if (d < 0) return { kind: "late", days: -d };
  return { kind: d <= 3 ? "soon" : "upcoming", days: d };
}
