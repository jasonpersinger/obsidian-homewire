// One audio player for the whole plugin, so music keeps going when the homepage
// re-renders or you switch notes. Panels only control it and listen for "change".
import { Events } from "obsidian";
import { isHttpUrl } from "../core/safeUrl";

export type RadioState = "stopped" | "loading" | "playing" | "error";

export class RadioPlayer extends Events {
  state: RadioState = "stopped";
  url: string | null = null;
  private audio: HTMLAudioElement | null = null;

  private set(state: RadioState): void {
    this.state = state;
    this.trigger("change", state);
  }

  play(url: string): void {
    if (!isHttpUrl(url)) return;
    this.stop();
    const audio = new Audio();
    audio.preload = "none";
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
