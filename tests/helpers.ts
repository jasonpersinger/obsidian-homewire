import type { KeyValueStore } from "../src/data/cache";

export function memoryStore(): KeyValueStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return { data, load: (k) => data.get(k) ?? null, save: (k, v) => void data.set(k, v) };
}
