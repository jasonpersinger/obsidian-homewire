// Draw from cache at once, refresh in the background when stale, and share one
// fetch between every homepage pane that asks for the same key at the same time.
import type { Cache } from "./cache";

export interface PanelState<T> { data: T | null; fetchedAt: number | null; error: string | null; loading: boolean }

const inFlight = new Map<string, Promise<unknown>>();

export async function loadPanel<T>(opts: {
  cache: Cache;
  key: string;
  maxAgeMs: number;
  fetch: () => Promise<T>;
  onUpdate: (s: PanelState<T>) => void;
  force?: boolean;
  /** Rejects cached values of an outdated shape (e.g. written by an older plugin version). */
  isValid?: (value: unknown) => boolean;
}): Promise<void> {
  const { cache, key, onUpdate } = opts;
  const stored = cache.get<T>(key);
  const cached = stored && (!opts.isValid || opts.isValid(stored.value)) ? stored : null;
  const fresh = cached !== null && cache.now() - cached.fetchedAt < opts.maxAgeMs;
  const base = { data: cached?.value ?? null, fetchedAt: cached?.fetchedAt ?? null };

  if (fresh && !opts.force) {
    onUpdate({ ...base, error: null, loading: false });
    return;
  }
  onUpdate({ ...base, error: null, loading: true });

  const id = `${cache.namespace}:${key}`;
  let pending = inFlight.get(id) as Promise<T> | undefined;
  if (!pending) {
    pending = opts.fetch().then((value) => {
      try {
        cache.set(key, value);
      } catch {
        // Storage full or unavailable: still show the fresh data.
      }
      return value;
    });
    inFlight.set(id, pending);
    void pending.catch(() => undefined).finally(() => inFlight.delete(id));
  }

  try {
    const value = await pending;
    onUpdate({ data: value, fetchedAt: cache.get<T>(key)?.fetchedAt ?? cache.now(), error: null, loading: false });
  } catch (e) {
    onUpdate({ ...base, error: e instanceof Error ? e.message : String(e), loading: false });
  }
}
