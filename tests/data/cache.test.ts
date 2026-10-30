import { describe, expect, test } from "vitest";
import { Cache } from "../../src/data/cache";
import { memoryStore } from "../helpers";

describe("Cache", () => {
  test("round-trips with the clock's timestamp under a namespaced key", () => {
    const store = memoryStore();
    const cache = new Cache(store, undefined, () => 1000);
    expect(cache.set("news:Top", [1, 2])).toEqual({ value: [1, 2], fetchedAt: 1000 });
    expect(cache.get("news:Top")).toEqual({ value: [1, 2], fetchedAt: 1000 });
    expect([...store.data.keys()]).toEqual(["salamander-home:news:Top"]);
  });
  test("missing or corrupt entries read as null", () => {
    const store = memoryStore();
    const cache = new Cache(store);
    expect(cache.get("nope")).toBeNull();
    store.data.set("salamander-home:a", "garbage");
    store.data.set("salamander-home:b", { value: 1 });
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBeNull();
  });
});
