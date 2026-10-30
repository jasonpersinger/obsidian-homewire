import { describe, expect, test } from "vitest";
import { Cache } from "../../src/data/cache";
import { loadPanel, type PanelState } from "../../src/data/panelLoader";
import { memoryStore } from "../helpers";

const MIN = 60_000;

function setup(now = 10 * MIN) {
  const cache = new Cache(memoryStore(), "t", () => now);
  const states: PanelState<string>[] = [];
  return { cache, states, onUpdate: (s: PanelState<string>) => void states.push(s) };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("loadPanel", () => {
  test("fresh cache: one update, no fetch", async () => {
    const { cache, states, onUpdate } = setup();
    cache.set("k", "cached");
    let calls = 0;
    await loadPanel({ cache, key: "k", maxAgeMs: 5 * MIN, fetch: async () => (calls++, "new"), onUpdate });
    expect(calls).toBe(0);
    expect(states).toEqual([{ data: "cached", fetchedAt: 10 * MIN, error: null, loading: false }]);
  });

  test("stale cache: cached while loading, then fresh data saved", async () => {
    let now = 0;
    const cache = new Cache(memoryStore(), "t", () => now);
    cache.set("k", "old");
    now = 10 * MIN;
    const states: PanelState<string>[] = [];
    await loadPanel({ cache, key: "k", maxAgeMs: 5 * MIN, fetch: async () => "new", onUpdate: (s) => states.push(s) });
    expect(states).toEqual([
      { data: "old", fetchedAt: 0, error: null, loading: true },
      { data: "new", fetchedAt: 10 * MIN, error: null, loading: false },
    ]);
    expect(cache.get("k")!.value).toBe("new");
  });

  test("force refetches a fresh cache", async () => {
    const { cache, states, onUpdate } = setup();
    cache.set("k", "cached");
    await loadPanel({ cache, key: "k", maxAgeMs: 5 * MIN, fetch: async () => "new", onUpdate, force: true });
    expect(states.at(-1)!.data).toBe("new");
  });

  test("failure keeps old data and reports the error", async () => {
    let now = 0;
    const cache = new Cache(memoryStore(), "t", () => now);
    cache.set("k", "old");
    now = 10 * MIN;
    const states: PanelState<string>[] = [];
    await loadPanel({ cache, key: "k", maxAgeMs: MIN, fetch: async () => { throw new Error("HTTP 403"); }, onUpdate: (s) => states.push(s) });
    expect(states.at(-1)).toEqual({ data: "old", fetchedAt: 0, error: "HTTP 403", loading: false });
  });

  test("failure with no cache", async () => {
    const { cache, states, onUpdate } = setup();
    await loadPanel({ cache, key: "k", maxAgeMs: MIN, fetch: async () => { throw new Error("offline"); }, onUpdate });
    expect(states.at(-1)).toEqual({ data: null, fetchedAt: null, error: "offline", loading: false });
  });

  test("two panes at once share one fetch", async () => {
    const { cache } = setup();
    const d = deferred<string>();
    let calls = 0;
    const fetch = () => (calls++, d.promise);
    const a: PanelState<string>[] = [], b: PanelState<string>[] = [];
    const p1 = loadPanel({ cache, key: "k", maxAgeMs: MIN, fetch, onUpdate: (s) => a.push(s) });
    const p2 = loadPanel({ cache, key: "k", maxAgeMs: MIN, fetch, onUpdate: (s) => b.push(s) });
    d.resolve("shared");
    await Promise.all([p1, p2]);
    expect(calls).toBe(1);
    expect(a.at(-1)!.data).toBe("shared");
    expect(b.at(-1)!.data).toBe("shared");
  });
});

test("cached data failing isValid is treated as missing (old shape after an upgrade)", async () => {
  const { cache, states, onUpdate } = setup();
  cache.set("k", { old: "shape" } as unknown as string);
  await loadPanel({ cache, key: "k", maxAgeMs: 5 * MIN, isValid: (v) => typeof v === "string", fetch: async () => "new", onUpdate });
  expect(states[0]).toEqual({ data: null, fetchedAt: null, error: null, loading: true });
  expect(states.at(-1)!.data).toBe("new");
});

test("a failed cache save still shows the fresh data", async () => {
  const cache = new Cache({ load: () => null, save: () => { throw new Error("quota"); } }, "t", () => 0);
  const states: PanelState<string>[] = [];
  await loadPanel({ cache, key: "k", maxAgeMs: MIN, fetch: async () => "new", onUpdate: (s) => states.push(s) });
  expect(states.at(-1)).toMatchObject({ data: "new", error: null, loading: false });
});
