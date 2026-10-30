// Per-device cache of remote results. The store is injected: in Obsidian it is
// app.loadLocalStorage/saveLocalStorage, never the synced data.json.

export interface KeyValueStore { load(key: string): unknown; save(key: string, value: unknown): void }
export interface CacheEntry<T> { value: T; fetchedAt: number }

export class Cache {
  constructor(
    private readonly store: KeyValueStore,
    readonly namespace = "salamander-home",
    readonly now: () => number = Date.now,
  ) {}

  get<T>(key: string): CacheEntry<T> | null {
    const raw = this.store.load(`${this.namespace}:${key}`);
    if (typeof raw !== "object" || raw === null) return null;
    const e = raw as Partial<CacheEntry<T>>;
    return typeof e.fetchedAt === "number" && "value" in e ? (e as CacheEntry<T>) : null;
  }

  set<T>(key: string, value: T): CacheEntry<T> {
    const entry = { value, fetchedAt: this.now() };
    this.store.save(`${this.namespace}:${key}`, entry);
    return entry;
  }
}
