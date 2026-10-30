// Radio card: art, artist/title, progress, up next, listeners, LIVE badge, play/stop.
import { Platform, setIcon } from "obsidian";
import type { RadioConfig } from "../core/config";
import { formatTime, nowPlayingUrl, parseNowPlaying, progress, volumeIcon, type NowPlaying } from "../core/radio";
import { loadPanel, type PanelState } from "../data/panelLoader";
import { fetchJson } from "../obsidian/http";
import type { HomeView } from "./HomeView";
import { aliveFlag, panelFrame, renderStatus } from "./panel";

const POLL_MS = 15_000;

export function mountRadio(view: HomeView, el: HTMLElement, cfg: RadioConfig): void {
  const { plugin } = view;
  const player = plugin.radio;
  const sec = view.section();
  const alive = aliveFlag(sec);
  const f = panelFrame(el, cfg.name ?? "Radio");
  const meta = f.label.createSpan({ cls: "hw-radio-meta" });
  f.body.addClass("hw-radio");

  // Static skeleton; draw() only fills it in, so the play button keeps focus and state.
  const art = f.body.createDiv({ cls: "hw-radio-art" });
  const info = f.body.createDiv({ cls: "hw-radio-info" });
  const artist = info.createDiv({ cls: "hw-radio-artist hw-muted hw-ellipsis" });
  const title = info.createDiv({ cls: "hw-radio-title" });
  const bar = info.createDiv({ cls: "hw-radio-bar" }).createDiv({ cls: "hw-radio-fill" });
  const times = info.createDiv({ cls: "hw-radio-times hw-faint" });
  const next = f.body.createDiv({ cls: "hw-radio-next hw-faint hw-ellipsis" });
  const controls = f.body.createDiv({ cls: "hw-radio-controls" });
  const button = controls.createEl("button", { cls: "hw-radio-play", attr: { "aria-label": "Play" } });
  const icon = button.createSpan({ cls: "hw-radio-icon" });
  const eq = button.createSpan({ cls: "hw-eq" });
  for (let i = 0; i < 4; i++) eq.createSpan();
  const buttonText = button.createSpan({ cls: "hw-radio-btn-text" });

  // Volume: iOS doesn't let apps set audio volume (hardware buttons only), so no slider there.
  if (!Platform.isIosApp) {
    const vol = controls.createDiv({ cls: "hw-radio-volume" });
    const speaker = vol.createEl("button", { cls: "hw-radio-mute clickable-icon", attr: { "aria-label": "Mute" } });
    const slider = vol.createEl("input", {
      cls: "hw-radio-slider",
      type: "range",
      attr: { min: "0", max: "1", step: "0.01", "aria-label": "Volume" },
    });
    const drawVolume = () => {
      setIcon(speaker, volumeIcon(player.volume, player.muted));
      speaker.setAttr("aria-label", player.muted ? "Unmute" : "Mute");
      slider.value = String(player.muted ? 0 : player.volume);
      slider.style.setProperty("--level", `${(player.muted ? 0 : player.volume) * 100}%`);
    };
    slider.addEventListener("input", () => player.setVolume(Number(slider.value)));
    speaker.addEventListener("click", () => player.toggleMute());
    sec.registerEvent(player.on("volume", drawVolume));
    drawVolume();
  }

  let np: NowPlaying | null = null;
  const streamUrl = () => cfg.stream ?? np?.stream ?? null;

  const drawButton = () => {
    const on = player.state === "playing" || player.state === "loading";
    const mine = player.url !== null && player.url === streamUrl();
    const active = on && mine;
    button.toggleClass("is-playing", active && player.state === "playing");
    button.toggleClass("is-loading", active && player.state === "loading");
    button.disabled = !streamUrl();
    setIcon(icon, active ? "square" : "play");
    buttonText.setText(active ? (player.state === "loading" ? "Tuning in…" : "Stop") : player.state === "error" && mine ? "Retry" : "Listen");
    button.setAttr("aria-label", active ? "Stop" : "Play");
  };

  const drawProgress = () => {
    if (!np) return;
    const p = progress(np, Date.now());
    bar.style.setProperty("--progress", `${(p.fraction * 100).toFixed(2)}%`);
    times.setText(np.duration > 0 ? `${formatTime(p.elapsed)} / ${formatTime(np.duration)}` : formatTime(p.elapsed));
  };

  const draw = (s: PanelState<NowPlaying>) => {
    if (!alive()) return;
    renderStatus(f.status, s);
    if (!s.data) return;
    np = s.data;
    if (!cfg.name && np.station) f.label.firstElementChild!.setText(np.station);
    meta.empty();
    if (np.live) meta.createSpan({ cls: "hw-radio-live", text: `● LIVE · ${np.live}` });
    if (np.listeners !== null) meta.createSpan({ cls: "hw-faint", text: `${np.listeners} listening` });
    art.empty();
    if (np.art) art.createEl("img", { attr: { src: np.art, alt: "", loading: "lazy", referrerpolicy: "no-referrer" } });
    artist.setText(np.artist);
    title.setText(np.title || "—");
    next.setText(np.next ? `next: ${[np.next.artist, np.next.title].filter(Boolean).join(" — ")}` : "");
    drawProgress();
    drawButton();
  };

  button.addEventListener("click", () => {
    const url = streamUrl();
    if (url) player.toggle(url);
  });
  sec.registerEvent(player.on("change", drawButton));

  if (cfg.server && cfg.station) {
    const api = nowPlayingUrl(cfg.server, cfg.station);
    const load = (force: boolean) =>
      loadPanel({
        cache: plugin.cache,
        key: `radio:${api}`,
        maxAgeMs: POLL_MS - 1000,
        force,
        isValid: (v) => typeof (v as NowPlaying | null)?.title === "string",
        fetch: async () => {
          const r = parseNowPlaying(await fetchJson(api));
          if (!r) throw new Error("unexpected response");
          return r;
        },
        onUpdate: draw,
      });
    sec.registerInterval(window.setInterval(() => void load(false), POLL_MS));
    // Tick the progress bar every second, and fetch as soon as the track should have ended.
    let lastEarly = 0;
    sec.registerInterval(window.setInterval(() => {
      drawProgress();
      const ended = np && np.duration > 0 && Date.now() - np.playedAt > (np.duration + 3) * 1000;
      if (ended && Date.now() - lastEarly > 10_000) {
        lastEarly = Date.now(); // at most one early check per 10 s while the server catches up
        void load(true);
      }
    }, 1000));
    void load(view.forceNext);
  } else {
    // Plain stream: no track info, just the player.
    f.body.addClass("hw-radio-plain");
    title.setText(cfg.name ?? "Live stream");
  }
  drawButton();
}
