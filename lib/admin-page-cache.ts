// Module-level SWR cache for admin list pages.
//
// Page components unmount/remount on every tab switch (Next App Router),
// so component useState is lost and each return re-fetches behind a full
// loader. This tiny in-memory cache survives remounts within the same
// browser session: returning shows the last good data instantly, then a
// silent background fetch revalidates. Full reload clears it (new heap).
// No new state library — plain Map, keyed by section (+ query where needed).

type Entry = { value: unknown; at: number };
const store = new Map<string, Entry>();

export function getAdminCache<T>(key: string): T | null {
  const e = store.get(key);
  return (e ? (e.value as T) : null) ?? null;
}

export function setAdminCache<T>(key: string, value: T): void {
  store.set(key, { value, at: Date.now() });
}

export function hasAdminCache(key: string): boolean {
  return store.has(key);
}

export function clearAdminCache(): void {
  store.clear();
}
