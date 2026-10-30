import { marketSession, sessionText } from "../core/marketSession";
import type { HomeView } from "./HomeView";

/** Large local clock and the US market session; no network, ticks every second. */
export function mountClock(view: HomeView, el: HTMLElement, opts: { clock: boolean; marketSession: boolean }): void {
  const sec = view.section();
  const box = el.createDiv({ cls: "hw-clock" });
  const time = opts.clock ? box.createDiv({ cls: "hw-clock-time" }) : null;
  const session = opts.marketSession ? box.createDiv({ cls: "hw-session" }) : null;
  const tag = session?.createSpan({ cls: "hw-session-tag" });
  const detail = session?.createSpan({ cls: "hw-faint hw-session-detail" });

  let last = "";
  const draw = () => {
    const now = new Date();
    const clock = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const s = opts.marketSession ? marketSession(now) : null;
    const text = s ? sessionText(s, now) : null;
    const key = `${clock}|${text?.tag}|${text?.detail}`;
    if (key === last) return;
    last = key;
    time?.setText(clock);
    if (s && text && session && tag && detail) {
      session.className = `hw-session hw-session-${s.kind}`;
      tag.setText(text.tag);
      detail.setText(` · ${text.detail}`);
    }
  };
  sec.registerInterval(window.setInterval(draw, 1000));
  draw();
}
