import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

/**
 * Returns true if localStorage contains a Supabase auth token whose
 * access_token has not yet expired. Used as a fast, synchronous hint to
 * avoid bouncing a logged-in user to /login during a hard refresh while
 * the supabase client is still hydrating from storage.
 */
function hasPersistedSupabaseToken(): boolean {
  if (typeof window === "undefined") return false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("sb-") || !k.endsWith("-auth-token")) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const exp = parsed?.expires_at;
        if (typeof exp === "number" && exp * 1000 > Date.now()) return true;
        // Even if expired, a refresh_token may successfully refresh — allow it.
        if (parsed?.refresh_token) return true;
      } catch {
        // ignore malformed entry
      }
    }
  } catch {
    // localStorage inaccessible — fall through
  }
  return false;
}

/**
 * Resolves to the current session, retrying briefly if the first call
 * returns null while a persisted token still exists in localStorage.
 * This avoids the "logged-in user refreshes and lands on /login" flash
 * caused by a race between route guards and supabase client init.
 */
export async function resolveSessionForGuard(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  if (!hasPersistedSupabaseToken()) return null;

  // Retry a few times (up to ~1.2s) while the client finishes hydrating /
  // refreshing the token from storage.
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const { data: again } = await supabase.auth.getSession();
    if (again.session) return again.session;
  }
  return null;
}