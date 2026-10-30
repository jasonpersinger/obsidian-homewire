// The banner "wire": newest headlines across all news groups, plus a one-line day summary.
import { billStatus } from "./bills";
import { mergeGroup, type FeedItem } from "./rss";
import { isHttpUrl } from "./safeUrl";

const titleKey = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function wireItems(groups: FeedItem[][], limit: number): FeedItem[] {
  const seen = new Set<string>();
  const usable = groups.map((g) => g.filter((i) => i.title.trim() && isHttpUrl(i.link)));
  return mergeGroup(usable, Infinity)
    .filter((i) => {
      const key = titleKey(i.title);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export function daySummary(input: {
  openTasks: number | null;
  nextBill: { name: string; due: string } | null;
  sunset: { at: number; label: string } | null;
  today: string;
  now: number;
}): string {
  const parts: string[] = [];
  if (input.openTasks !== null) parts.push(input.openTasks === 0 ? "nothing open" : `${input.openTasks} open`);
  if (input.nextBill) {
    const { name, due } = input.nextBill;
    const s = billStatus(due, input.today);
    parts.push(s.kind === "late" ? `${name} ${s.days}d late` : s.days === 0 ? `${name} due today` : `next bill: ${name} in ${s.days}d`);
  }
  if (input.sunset && input.now < input.sunset.at) parts.push(`sunset ${input.sunset.label}`);
  return parts.join(" · ");
}
