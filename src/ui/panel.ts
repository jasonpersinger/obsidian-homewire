// Shared panel chrome: an uppercase label, a box, and a faint status footer.
import { relativeAge } from "../core/dates";
import type { Component } from "obsidian";
import type { PanelState } from "../data/panelLoader";

/** Timers tick this often; each panel's maxAgeMs decides whether a tick actually fetches. */
export const TICK_MS = 60_000;

/** Returns a function that is false once `sec` has been unloaded (late async work must stop). */
export function aliveFlag(sec: Component): () => boolean {
  let alive = true;
  sec.register(() => (alive = false));
  return () => alive;
}

/** Shows a one-line error in place of a panel that failed, without touching the others. */
export function panelError(el: HTMLElement, title: string, err: unknown): void {
  console.error(`Homewire: ${title} panel failed`, err);
  el.createDiv({ cls: "hw-section" }).createDiv({
    cls: "hw-faint hw-offline",
    text: `${title}: ${err instanceof Error ? err.message : String(err)}`,
  });
}

export interface PanelFrame { section: HTMLElement; label: HTMLElement; body: HTMLElement; status: HTMLElement }

export function panelFrame(parent: HTMLElement, title: string, boxed = true): PanelFrame {
  const section = parent.createDiv({ cls: "hw-section" });
  const label = section.createDiv({ cls: "hw-label" });
  label.createSpan({ text: title });
  const body = section.createDiv({ cls: boxed ? "hw-box" : "hw-plain" });
  const status = section.createDiv({ cls: "hw-faint hw-status" });
  return { section, label, body, status };
}

/** "updated 5m ago", plus "offline" when the last refresh failed. */
export function renderStatus(el: HTMLElement, s: PanelState<unknown>, now = Date.now()): void {
  el.empty();
  if (s.fetchedAt !== null) el.createSpan({ text: `updated ${relativeAge(now - s.fetchedAt)} ago`, attr: { "data-fetched": String(s.fetchedAt) } });
  if (s.error) el.createSpan({ cls: "hw-offline", text: s.data === null ? `unavailable (${s.error})` : "offline" });
  else if (s.loading && s.data === null) el.createSpan({ text: "loading…" });
}

/** Shows the first `n` children of `list`; a toggle reveals the rest. */
export function collapse(list: HTMLElement, n: number): void {
  const items = Array.from(list.children) as HTMLElement[];
  if (items.length <= n) return;
  const extra = items.slice(n);
  extra.forEach((e) => e.toggleClass("hw-hidden", true));
  const btn = list.parentElement!.createEl("button", { cls: "hw-more", text: `Show ${extra.length} more` });
  btn.addEventListener("click", () => {
    const hidden = extra[0]!.hasClass("hw-hidden");
    extra.forEach((e) => e.toggleClass("hw-hidden", !hidden));
    btn.setText(hidden ? "Show less" : `Show ${extra.length} more`);
  });
}
