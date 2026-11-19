// Lightweight stale-while-revalidate cache for Supabase reads.
// Returns a cached value instantly (if fresh OR stale) and triggers a
// background refetch when stale. Uses sessionStorage so it survives
// route navigations within the same tab without becoming permanent.

type Entry<T> = { v: T; t: number };

const mem = new Map<string, Entry<any>>();

function read<T>(key: string): Entry<T> | null {
  const m = mem.get(key);
  if (m) return m as Entry<T>;
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("cache:" + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry<T>;
    mem.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function write<T>(key: string, v: T) {
  const entry: Entry<T> = { v, t: Date.now() };
  mem.set(key, entry);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem("cache:" + key, JSON.stringify(entry));
  } catch {
    /* quota — ignore */
  }
}

/**
 * Returns cached value (if any) immediately via onCached, and the fresh
 * value via the returned promise. If cache is fresh (younger than ttlMs),
 * skips the network call entirely.
 */
export async function swr<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  onCached?: (v: T) => void,
): Promise<T> {
  const cached = read<T>(key);
  if (cached) {
    onCached?.(cached.v);
    if (Date.now() - cached.t < ttlMs) return cached.v;
  }
  const fresh = await fetcher();
  write(key, fresh);
  return fresh;
}

export function invalidateCache(prefix?: string) {
  if (!prefix) {
    mem.clear();
    if (typeof window !== "undefined") {
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith("cache:"))
        .forEach((k) => sessionStorage.removeItem(k));
    }
    return;
  }
  for (const k of Array.from(mem.keys())) {
    if (k.startsWith(prefix)) mem.delete(k);
  }
  if (typeof window !== "undefined") {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith("cache:" + prefix))
      .forEach((k) => sessionStorage.removeItem(k));
  }
}