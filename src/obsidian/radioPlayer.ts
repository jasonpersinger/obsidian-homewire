// One audio player for the whole plugin, so music keeps going when the homepage
// re-renders or you switch notes. Panels only control it and listen for "change".
import { Events } from "obsidian";
import { normalizeVolume } from "../core/radio";
import { isHttpUrl } from "../core/safeUrl";

export type RadioState = "stopped" | "loading" | "playing" | "error";

export interface VolumeStore { load(): unknown; save(volume: number): void }

export class RadioPlayer extends Events {
  state: RadioState = "stopped";
  url: string | null = null;
  volume: number;
  muted = false;
  private audio: HTMLAudioElement | null = null;

  /** Volume is remembered per device (not synced), through the given store. */
  constructor(private readonly store: VolumeStore) {
    super();
    this.volume = normalizeVolume(store.load());
  }

  setVolume(volume: number): void {
    this.volume = normalizeVolume(volume);
    this.muted = this.volume === 0;
    if (this.audio) {
      this.audio.volume = this.volume;
      this.audio.muted = this.muted;
    }
    this.store.save(this.volume);
    this.trigger("volume");
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.audio) this.audio.muted = this.muted;
    this.trigger("volume");
  }

  private set(state: RadioState): void {
    this.state = state;
    this.trigger("change", state);
  }

  play(url: string): void {
    if (!isHttpUrl(url)) return;
    this.stop();
    const audio = new Audio();
    audio.preload = "none";
    audio.volume = this.volume;
    audio.muted = this.muted;
    audio.addEventListener("playing", () => this.set("playing"));
    audio.addEventListener("waiting", () => this.set("loading"));
    audio.addEventListener("error", () => this.set("error"));
    this.audio = audio;
    this.url = url;
    this.set("loading");
    // A cache-busting stamp makes sure a restart joins the live stream, not an old buffer.
    audio.src = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
    audio.play().catch(() => this.set("error"));
  }

  /** Stops and disconnects: a paused live stream would keep downloading. */
  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
      this.audio = null;
    }
    if (this.state !== "stopped") this.set("stopped");
  }

  toggle(url: string): void {
    if (this.state === "playing" || this.state === "loading") this.stop();
    else this.play(url);
  }
}
