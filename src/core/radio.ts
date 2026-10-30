// Internet radio: AzuraCast's public now-playing API, plus plain stream URLs.
import { isHttpUrl } from "./safeUrl";

export interface NowPlaying {
  station: string;
  stream: string | null;
  artist: string;
  title: string;
  art: string | null;
  playedAt: number; // ms
  duration: number; // seconds; 0 when unknown
  next: { artist: string; title: string } | null;
  listeners: number | null;
  live: string | null; // DJ name when someone is broadcasting live
  online: boolean;
}

export function nowPlayingUrl(server: string, station: string): string {
  return `${server.replace(/\/+$/, "")}/api/nowplaying/${encodeURIComponent(station)}`;
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (typeof v === "object" && v !== null ? (v as Obj) : {});
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const url = (v: unknown) => (typeof v === "string" && isHttpUrl(v) ? v : null);

export function parseNowPlaying(json: unknown): NowPlaying | null {
  const d = obj(json);
  const station = obj(d.station), np = obj(d.now_playing), song = obj(np.song);
  if (!str(station.name) && !str(song.title)) return null;
  const next = obj(obj(d.playing_next).song);
  const live = obj(d.live);
  return {
    station: str(station.name),
    stream: url(station.listen_url),
    artist: str(song.artist),
    title: str(song.title),
    art: url(song.art),
    playedAt: (num(np.played_at) ?? 0) * 1000,
    duration: num(np.duration) ?? 0,
    next: str(next.title) ? { artist: str(next.artist), title: str(next.title) } : null,
    listeners: num(obj(d.listeners).current),
    live: live.is_live === true ? str(live.streamer_name) || "Live" : null,
    online: d.is_online !== false,
  };
}

/** Where the current track is now, worked out from when it started (so it can tick locally). */
export function progress(np: { playedAt: number; duration: number }, now: number): { elapsed: number; fraction: number } {
  const raw = Math.max(0, Math.floor((now - np.playedAt) / 1000));
  if (np.duration <= 0) return { elapsed: raw, fraction: 0 };
  const elapsed = Math.min(raw, np.duration);
  return { elapsed, fraction: elapsed / np.duration };
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** A saved volume (0–1); anything unreadable becomes 80%. */
export function normalizeVolume(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.8;
  return Math.min(1, Math.max(0, value));
}

export function volumeIcon(volume: number, muted: boolean): "volume-x" | "volume-1" | "volume-2" {
  if (muted || volume === 0) return "volume-x";
  return volume < 0.5 ? "volume-1" : "volume-2";
}
