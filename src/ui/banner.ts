import { dayOfYear, isoWeek } from "../core/dates";

/** Renders the date banner; returns the empty slot for the weather summary line. */
export function renderBanner(el: HTMLElement, now: Date, links: { label: string; onClick: () => void }[]): HTMLElement {
  const date = el.createDiv({ cls: "hw-date" });
  date.createSpan({ text: `// ${now.toLocaleDateString(undefined, { weekday: "long" })}, ` });
  date.createSpan({
    cls: "hw-accent",
    text: now.toLocaleDateString(undefined, { month: "long", day: "numeric" }),
  });

  const sub = el.createDiv({ cls: "hw-sub" });
  sub.createSpan({ text: `Week ${isoWeek(now)} · day ${dayOfYear(now)}` });
  for (const l of links) {
    sub.createSpan({ text: " · " });
    sub.createEl("a", { text: l.label, cls: "hw-link", href: "#" }).addEventListener("click", (e) => {
      e.preventDefault();
      l.onClick();
    });
  }
  return sub.createSpan({ cls: "hw-banner-weather" });
}
