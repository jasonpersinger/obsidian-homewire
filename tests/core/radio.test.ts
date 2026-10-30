import { describe, expect, test } from "vitest";
import fixture from "../fixtures/azuracast-nowplaying.json";
import { formatTime, normalizeVolume, nowPlayingUrl, parseNowPlaying, progress, volumeIcon } from "../../src/core/radio";

describe("parseNowPlaying (AzuraCast)", () => {
  const np = parseNowPlaying(fixture)!;
  test("station, stream and track", () => {
    expect(np).toMatchObject({
      station: "Kobold.FM",
      stream: "https://kobold.messy.quest/listen/kobold.fm/radio.mp3",
      artist: "Shogun's Castle",
      title: "The Forgotten Abode of Seclusion and Solace",
      playedAt: 1793397704_000,
      duration: 2132,
      listeners: 6,
      live: null,
      online: true,
    });
    expect(np.art).toMatch(/^https:\/\/kobold\.messy\.quest\/api\/station\/kobold\.fm\/art\//);
    expect(np.next).toEqual({ artist: fixture.playing_next.song.artist, title: "The Divine Call" });
  });
  test("a live DJ is reported by name", () => {
    const live = { ...fixture, live: { is_live: true, streamer_name: "DJ Kobold" } };
    expect(parseNowPlaying(live)!.live).toBe("DJ Kobold");
  });
  test("untrusted urls are dropped", () => {
    const bad = { ...fixture, station: { ...fixture.station, listen_url: "javascript:alert(1)" },
      now_playing: { ...fixture.now_playing, song: { ...fixture.now_playing.song, art: "data:image/png,x" } } };
    const r = parseNowPlaying(bad)!;
    expect(r.stream).toBeNull();
    expect(r.art).toBeNull();
  });
  test("garbage gives null", () => {
    expect(parseNowPlaying(null)).toBeNull();
    expect(parseNowPlaying({})).toBeNull();
  });
});

describe("progress and time", () => {
  test("elapsed comes from when the track started, clamped to its length", () => {
    expect(progress({ playedAt: 1_000_000, duration: 200 }, 1_000_000 + 50_000)).toEqual({ elapsed: 50, fraction: 0.25 });
    expect(progress({ playedAt: 1_000_000, duration: 200 }, 1_000_000 + 999_000)).toEqual({ elapsed: 200, fraction: 1 });
    expect(progress({ playedAt: 1_000_000, duration: 0 }, 1_005_000)).toEqual({ elapsed: 5, fraction: 0 });
  });
  test("formatTime", () => {
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(2132)).toBe("35:32");
    expect(formatTime(3725)).toBe("1:02:05");
  });
  test("now-playing url from server and station", () => {
    expect(nowPlayingUrl("https://kobold.messy.quest/", "kobold.fm")).toBe("https://kobold.messy.quest/api/nowplaying/kobold.fm");
  });
});

describe("normalizeVolume (saved per device)", () => {
  test("keeps a valid level", () => expect(normalizeVolume(0.35)).toBe(0.35));
  test("clamps out-of-range values", () => {
    expect(normalizeVolume(1.7)).toBe(1);
    expect(normalizeVolume(-0.2)).toBe(0);
  });
  test("anything unreadable falls back to 80%", () => {
    for (const v of [null, undefined, "loud", NaN, {}]) expect(normalizeVolume(v)).toBe(0.8);
  });
});

describe("volumeIcon", () => {
  test("muted, low and high", () => {
    expect(volumeIcon(0.5, true)).toBe("volume-x");
    expect(volumeIcon(0, false)).toBe("volume-x");
    expect(volumeIcon(0.3, false)).toBe("volume-1");
    expect(volumeIcon(0.8, false)).toBe("volume-2");
  });
});
