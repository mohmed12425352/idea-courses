import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { registerCurrentDevice } from "@/lib/device";

type Profile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
};

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  isModerator: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfileAndRole = async (uid: string) => {
    const [{ data: prof, error: profileError }, { data: roles, error: rolesError }] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);
    if (profileError || rolesError) {
      console.error("[auth] failed to load profile or role", { profileError, rolesError, uid });
    }
    setProfile(prof as Profile | null);
    setIsAdmin(!!roles?.some((r) => r.role === "admin"));
    setIsModerator(!!roles?.some((r) => r.role === "moderator"));
    // Register device & enforce limit (skip staff: admins + moderators)
    const isStaff =
      !!roles?.some((r) => r.role === "admin" || r.role === "moderator");
    if (!isStaff) {
      try {
        const { banned, warning } = await registerCurrentDevice();
        if (banned) {
          if (typeof window !== "undefined") {
            const { toast } = await import("sonner");
            toast.error("تم حظر حسابك تلقائياً بسبب تجاوز عدد الأجهزة المسموح بها");
          }
          await supabase.auth.signOut();
        } else if (warning) {
          if (typeof window !== "undefined") {
            const { toast } = await import("sonner");
            toast.warning(
              "تحذير: المنصة تعمل على جهاز واحد فقط — نفس الجهاز الذي سجّلت منه أول مرة. لو حاولت الدخول من جهاز آخر مرة تانية هيتم حظر حسابك تلقائياً.",
              { duration: 10000 },
            );
          }
          await supabase.auth.signOut();
        }
      } catch (e) {
        console.error("[auth] device check failed", e);
      }
    }
  };

  useEffect(() => {
    let lastUserId: string | null = null;
    const { data: sub } = supabase.auth.onAuthStateChange((evt, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);

      // Ignore token refreshes triggered by tab focus / background refresh —
      // they don't change the user, so we shouldn't re-show the loading state
      // (which feels like a full page refresh to the student).
      if (evt === "TOKEN_REFRESHED" || evt === "USER_UPDATED") {
        return;
      }

      // Only reload profile/role when the actual signed-in user changes
      // (sign in, sign out, or account switch).
      const newUserId = sess?.user?.id ?? null;
      if (newUserId === lastUserId) {
        return;
      }
      lastUserId = newUserId;

      setLoading(true);
      if (sess?.user) {
        setTimeout(() => {
          loadProfileAndRole(sess.user.id).finally(() => setLoading(false));
        }, 0);
      } else {
        setProfile(null);
        setIsAdmin(false);
        setIsModerator(false);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      lastUserId = s?.user?.id ?? null;
      if (s?.user) await loadProfileAndRole(s.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Heartbeat: stamp profiles.last_active_at while the user is signed in
  // and the tab is visible. Runs on mount, on focus, and every 60s.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const ping = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const path =
        typeof window !== "undefined"
          ? (window.location.pathname + window.location.search).slice(0, 300)
          : null;
      supabase.rpc("touch_last_active", { _path: path } as any).then(({ error }) => {
        if (error && !cancelled) console.warn("[auth] touch_last_active failed", error.message);
      });
    };
    ping();
    const id = window.setInterval(ping, 60_000);
    const onVis = () => { if (document.visibilityState === "visible") ping(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", ping);
    // Also ping on client-side route changes (back/forward)
    const onNav = () => ping();
    window.addEventListener("popstate", onNav);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", ping);
      window.removeEventListener("popstate", onNav);
    };
  }, [user]);

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    // Retry transient backend errors (e.g. "Database error querying schema",
    // "unexpected_failure") that happen while the auth service is recovering.
    const isTransient = (msg?: string, status?: number) => {
      if (status && status >= 500) return true;
      if (!msg) return false;
      const m = msg.toLowerCase();
      return (
        m.includes("database error") ||
        m.includes("querying schema") ||
        m.includes("unexpected_failure") ||
        m.includes("unexpected failure") ||
        m.includes("unexpected eof") ||
        m.includes("fetch failed") ||
        m.includes("network")
      );
    };

    const maxAttempts = 3;
    let lastErrMsg: string | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) return { error: null };
      lastErrMsg = error.message;
      const transient = isTransient(error.message, (error as any).status);

      console.error(`[auth.signIn] attempt ${attempt}/${maxAttempts} failed`, {
        message: error.message,
        status: (error as any).status,
        name: error.name,
        transient,
      });
      if (!transient || attempt === maxAttempts) {
        return { error: error.message };
      }
      // Exponential backoff: 600ms, 1500ms
      await new Promise((r) => setTimeout(r, attempt === 1 ? 600 : 1500));
    }
    return { error: lastErrMsg };
  };

  const signUp: AuthCtx["signUp"] = async ({ name, email, phone, password }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: { name, phone },
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user) await loadProfileAndRole(user.id);
  };

  return (
    <Ctx.Provider
      value={{ user, session, profile, isAdmin, isModerator, loading, signIn, signUp, signOut, refreshProfile }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
