// ============================================================================
// EduNova Standalone Frontend SDK -> Node.js Express + PostgreSQL + WebSocket
// ============================================================================

export interface User {
  id: string;
  email?: string;
  role?: string;
  app_metadata: Record<string, any>;
  user_metadata: Record<string, any>;
  created_at: string;
  last_sign_in_at?: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at?: number;
  user: User;
}

export type AuthChangeEvent =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "PASSWORD_RECOVERY";

import { getAppsApiBase } from "./apps-runtime";

const STORAGE_KEY = "edunova_apps_auth_session_v1";

function apiUrl(path: string): string {
  const base = getAppsApiBase();
  return `${base}${path}`;
}

function readStoredSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.access_token || !parsed?.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredSession(session: Session | null): void {
  if (typeof window === "undefined") return;
  try {
    if (session) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

export function getAccessToken(): string | null {
  return readStoredSession()?.access_token ?? null;
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getAccessToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

// Auth listeners
type AuthListener = (event: AuthChangeEvent, session: Session | null) => void;
const authListeners = new Set<AuthListener>();

function emitAuth(event: AuthChangeEvent, session: Session | null) {
  for (const fn of authListeners) {
    try {
      fn(event, session);
    } catch (e) {
      console.error("[auth listener]", e);
    }
  }
}

// Handle OAuth hash callback `#access_token=...` on boot
if (typeof window !== "undefined" && window.location.hash.includes("access_token=")) {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const token = hashParams.get("access_token");
  if (token) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    fetch(apiUrl("/api/auth/session"), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((res) => {
        if (res?.session) {
          writeStoredSession(res.session);
          emitAuth("SIGNED_IN", res.session);
        }
      })
      .catch(() => {});
  }
}

// ============================================================================
// 1. Auth Module
// ============================================================================
const auth = {
  async getSession(): Promise<{ data: { session: Session | null }; error: any }> {
    const stored = readStoredSession();
    if (!stored) return { data: { session: null }, error: null };
    return { data: { session: stored }, error: null };
  },

  async getUser(): Promise<{ data: { user: User | null }; error: any }> {
    const stored = readStoredSession();
    if (!stored) return { data: { user: null }, error: null };
    try {
      const res = await fetch(apiUrl("/api/auth/session"), { headers: authHeaders() });
      if (!res.ok) return { data: { user: stored.user }, error: null };
      const json = await res.json();
      if (!json?.session) {
        writeStoredSession(null);
        emitAuth("SIGNED_OUT", null);
        return { data: { user: null }, error: null };
      }
      writeStoredSession(json.session);
      return { data: { user: json.user }, error: null };
    } catch {
      return { data: { user: stored.user }, error: null };
    }
  },

  onAuthStateChange(callback: AuthListener) {
    authListeners.add(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            authListeners.delete(callback);
          },
        },
      },
    };
  },

  async signInWithPassword(creds: { email: string; password: string }) {
    try {
      const res = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creds),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        return {
          data: { user: null, session: null },
          error: { message: json.error || "Invalid login credentials", status: res.status, name: "AuthApiError" },
        };
      }
      writeStoredSession(json.session);
      emitAuth("SIGNED_IN", json.session);
      return { data: { user: json.user, session: json.session }, error: null };
    } catch (err: any) {
      return {
        data: { user: null, session: null },
        error: { message: err?.message || "Network error", status: 503, name: "AuthRetryableFetchError" },
      };
    }
  },

  async signUp(opts: { email: string; password: string; options?: { emailRedirectTo?: string; data?: any } }) {
    try {
      const res = await fetch(apiUrl("/api/auth/signup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: opts.email,
          password: opts.password,
          data: opts.options?.data || {},
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        return {
          data: { user: null, session: null },
          error: { message: json.error || "فشل إنشاء الحساب" },
        };
      }
      writeStoredSession(json.session);
      emitAuth("SIGNED_IN", json.session);
      return { data: { user: json.user, session: json.session }, error: null };
    } catch (err: any) {
      return {
        data: { user: null, session: null },
        error: { message: err?.message || "Network error" },
      };
    }
  },

  async signOut() {
    try {
      await fetch(apiUrl("/api/auth/logout"), { method: "POST", headers: authHeaders() });
    } catch {}
    writeStoredSession(null);
    emitAuth("SIGNED_OUT", null);
    return { error: null };
  },

  async resetPasswordForEmail(email: string, opts?: { redirectTo?: string }) {
    try {
      const res = await fetch(apiUrl("/api/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirectTo: opts?.redirectTo }),
      });
      const json = await res.json();
      if (!res.ok || json.error) return { data: null, error: { message: json.error || "Reset failed" } };
      return { data: {}, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err?.message || "Network error" } };
    }
  },

  async verifyOtp(params: { token_hash: string; type: string }) {
    try {
      const res = await fetch(apiUrl("/api/auth/verify-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const json = await res.json();
      if (!res.ok || json.error) return { data: { user: null, session: null }, error: { message: json.error } };
      if (json.session) {
        writeStoredSession(json.session);
        emitAuth(params.type === "recovery" ? "PASSWORD_RECOVERY" : "SIGNED_IN", json.session);
      }
      return { data: { user: json.user, session: json.session }, error: null };
    } catch (err: any) {
      return { data: { user: null, session: null }, error: { message: err?.message || "Verify failed" } };
    }
  },

  async updateUser(attrs: { password?: string; email?: string; data?: any }) {
    try {
      const res = await fetch(apiUrl("/api/auth/update-user"), {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(attrs),
      });
      const json = await res.json();
      if (!res.ok || json.error) return { data: { user: null }, error: { message: json.error || "Update failed" } };
      if (json.session) {
        writeStoredSession(json.session);
        emitAuth("USER_UPDATED", json.session);
      }
      return { data: { user: json.user }, error: null };
    } catch (err: any) {
      return { data: { user: null }, error: { message: err?.message || "Network error" } };
    }
  },

  async setSession(tokens: { access_token: string; refresh_token?: string }) {
    const res = await fetch(apiUrl("/api/auth/session"), {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const json = await res.json();
    if (json?.session) {
      writeStoredSession(json.session);
      emitAuth("SIGNED_IN", json.session);
      return { data: { session: json.session, user: json.user }, error: null };
    }
    return { data: { session: null, user: null }, error: { message: "Invalid session" } };
  },
};

// ============================================================================
// 2. Fluent Query Builder -> POST /api/db/:table
// ============================================================================
class QueryBuilder<T = any> implements PromiseLike<{ data: T; error: any; count?: number }> {
  private table: string;
  private payload: Record<string, any> = {
    action: "select",
    select: "*",
    filters: [],
    orders: [],
  };

  constructor(table: string) {
    this.table = table;
  }

  select(columns = "*", opts?: { count?: "exact"; head?: boolean }) {
    this.payload.select = columns;
    if (opts?.count) this.payload.count = opts.count;
    if (opts?.head) this.payload.head = opts.head;
    return this;
  }

  insert(values: any, _opts?: any) {
    this.payload.action = "insert";
    this.payload.values = values;
    return this;
  }

  upsert(values: any, opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.payload.action = "upsert";
    this.payload.values = values;
    if (opts?.onConflict) this.payload.onConflict = opts.onConflict;
    if (opts?.ignoreDuplicates) this.payload.ignoreDuplicates = opts.ignoreDuplicates;
    return this;
  }

  update(values: any) {
    this.payload.action = "update";
    this.payload.values = values;
    return this;
  }

  delete() {
    this.payload.action = "delete";
    return this;
  }

  eq(column: string, value: any) {
    this.payload.filters.push({ op: "eq", column, value });
    return this;
  }

  neq(column: string, value: any) {
    this.payload.filters.push({ op: "neq", column, value });
    return this;
  }

  gt(column: string, value: any) {
    this.payload.filters.push({ op: "gt", column, value });
    return this;
  }

  gte(column: string, value: any) {
    this.payload.filters.push({ op: "gte", column, value });
    return this;
  }

  lt(column: string, value: any) {
    this.payload.filters.push({ op: "lt", column, value });
    return this;
  }

  lte(column: string, value: any) {
    this.payload.filters.push({ op: "lte", column, value });
    return this;
  }

  ilike(column: string, value: string) {
    this.payload.filters.push({ op: "ilike", column, value });
    return this;
  }

  like(column: string, value: string) {
    this.payload.filters.push({ op: "like", column, value });
    return this;
  }

  is(column: string, value: any) {
    this.payload.filters.push({ op: "is", column, value });
    return this;
  }

  in(column: string, values: any[]) {
    this.payload.filters.push({ op: "in", column, value: values });
    return this;
  }

  contains(column: string, value: any) {
    this.payload.filters.push({ op: "contains", column, value });
    return this;
  }

  not(column: string, negateOp: string, value: any) {
    this.payload.filters.push({ op: "not", column, negateOp, value });
    return this;
  }

  or(expr: string) {
    this.payload.filters.push({ op: "or", value: expr });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.payload.orders.push({ column, ascending: opts?.ascending !== false });
    return this;
  }

  limit(n: number) {
    this.payload.limit = n;
    return this;
  }

  range(from: number, to: number) {
    this.payload.range = [from, to];
    return this;
  }

  single() {
    this.payload.single = true;
    return this;
  }

  maybeSingle() {
    this.payload.maybeSingle = true;
    return this;
  }

  private async execute(): Promise<{ data: T; error: any; count?: number }> {
    try {
      const res = await fetch(apiUrl(`/api/db/${encodeURIComponent(this.table)}`), {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(this.payload),
      });
      const json = await res.json();
      return {
        data: (json.data ?? null) as T,
        error: json.error ?? null,
        count: json.count,
      };
    } catch (err: any) {
      return {
        data: null as any,
        error: { message: err?.message || "Network error" },
      };
    }
  }

  then<TResult1 = { data: T; error: any; count?: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: T; error: any; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

// ============================================================================
// 3. Storage Module -> /api/storage/:bucket/*
// ============================================================================
const storage = {
  from(bucket: string) {
    return {
      async upload(
        filePath: string,
        file: File | Blob,
        opts?: { contentType?: string; upsert?: boolean; cacheControl?: string },
      ) {
        try {
          const form = new FormData();
          form.append("path", filePath);
          if (opts?.upsert !== undefined) form.append("upsert", String(opts.upsert));
          form.append("file", file);
          const res = await fetch(apiUrl(`/api/storage/${encodeURIComponent(bucket)}/upload`), {
            method: "POST",
            headers: authHeaders(),
            body: form,
          });
          const json = await res.json();
          return { data: json.data ?? null, error: json.error ?? null };
        } catch (err: any) {
          return { data: null, error: { message: err?.message || "Upload failed" } };
        }
      },

      getPublicUrl(filePath: string) {
        const clean = filePath.replace(/^\/+/, "");
        const publicUrl = apiUrl(`/uploads/${bucket}/${clean}`);
        return { data: { publicUrl } };
      },

      async createSignedUrl(filePath: string, expiresIn = 3600) {
        try {
          const res = await fetch(apiUrl(`/api/storage/${encodeURIComponent(bucket)}/sign`), {
            method: "POST",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ path: filePath, expiresIn }),
          });
          const json = await res.json();
          return { data: json.data ?? null, error: json.error ?? null };
        } catch (err: any) {
          return { data: null, error: { message: err?.message || "Signed URL error" } };
        }
      },

      async remove(paths: string[]) {
        try {
          const res = await fetch(apiUrl(`/api/storage/${encodeURIComponent(bucket)}/remove`), {
            method: "POST",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ paths }),
          });
          const json = await res.json();
          return { data: json.data ?? null, error: json.error ?? null };
        } catch (err: any) {
          return { data: null, error: { message: err?.message || "Remove failed" } };
        }
      },
    };
  },
};

// ============================================================================
// 4. Realtime WebSocket Channel -> /ws
// ============================================================================
let sharedWs: WebSocket | null = null;
const activeChannels = new Set<RealtimeChannel>();
const pushListeners = new Set<(notif: { title: string; body: string; url?: string; sentAt?: string }) => void>();

export function onGlobalAppPush(
  cb: (notif: { title: string; body: string; url?: string; sentAt?: string }) => void,
): () => void {
  pushListeners.add(cb);
  getWebSocket();
  return () => pushListeners.delete(cb);
}

if (typeof window !== "undefined") {
  window.addEventListener("edunova:server-url-changed", () => {
    try {
      sharedWs?.close();
    } catch {}
    sharedWs = null;
    getWebSocket();
  });
}

function getWebSocket(): WebSocket | null {
  if (typeof window === "undefined") return null;
  if (sharedWs && (sharedWs.readyState === WebSocket.OPEN || sharedWs.readyState === WebSocket.CONNECTING)) {
    return sharedWs;
  }
  try {
    const dynBase = getAppsApiBase();
    const wsBase = dynBase
      ? dynBase.replace(/^http/, "ws")
      : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
    sharedWs = new WebSocket(`${wsBase}/ws`);

    sharedWs.onopen = () => {
      for (const ch of activeChannels) ch._onSocketOpen();
    };

    sharedWs.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data));
        if (msg?.type === "app_push_alert" && msg.payload) {
          for (const fn of pushListeners) {
            try {
              fn(msg.payload);
            } catch {}
          }
          return;
        }
        for (const ch of activeChannels) ch._handleMessage(msg);
      } catch {}
    };

    sharedWs.onclose = () => {
      sharedWs = null;
    };
    return sharedWs;
  } catch {
    return null;
  }
}

class RealtimeChannel {
  name: string;
  opts: any;
  private pgHandlers: Array<{ filter: any; cb: (payload: any) => void }> = [];
  private broadcastHandlers: Array<{ event: string; cb: (msg: any) => void }> = [];
  private presenceHandlers: Array<{ event: string; cb: () => void }> = [];
  private currentPresenceState: Record<string, any[]> = {};
  private statusCb?: (status: string) => void;

  constructor(name: string, opts?: any) {
    this.name = name;
    this.opts = opts || {};
  }

  on(type: string, filter: any, callback?: (payload?: any) => void) {
    if (type === "postgres_changes" && callback) {
      this.pgHandlers.push({ filter, cb: callback });
    } else if (type === "broadcast" && callback) {
      this.broadcastHandlers.push({ event: filter?.event || "*", cb: callback });
    } else if (type === "presence" && callback) {
      this.presenceHandlers.push({ event: filter?.event || "sync", cb: callback });
    }
    return this;
  }

  subscribe(cb?: (status: string) => void) {
    this.statusCb = cb;
    activeChannels.add(this);
    const ws = getWebSocket();
    if (ws && ws.readyState === WebSocket.OPEN) {
      this._onSocketOpen();
    }
    return this;
  }

  _onSocketOpen() {
    if (sharedWs?.readyState === WebSocket.OPEN) {
      sharedWs.send(JSON.stringify({ type: "subscribe", channel: this.name }));
      this.statusCb?.("SUBSCRIBED");
    }
  }

  _handleMessage(msg: any) {
    if (msg.type === "postgres_changes") {
      for (const h of this.pgHandlers) {
        if (h.filter.table && h.filter.table !== msg.table) continue;
        if (h.filter.event && h.filter.event !== "*" && h.filter.event !== msg.eventType) continue;
        if (h.filter.filter && typeof h.filter.filter === "string") {
          const [col, rhs] = h.filter.filter.split("=eq.");
          const rowObj = msg.new || msg.old || {};
          if (col && rhs !== undefined && String(rowObj[col] ?? "") !== rhs) continue;
        }
        h.cb(msg);
      }
    } else if (msg.type === "broadcast" && msg.channel === this.name) {
      for (const h of this.broadcastHandlers) {
        if (h.event === "*" || h.event === msg.event) {
          h.cb({ payload: msg.payload, event: msg.event });
        }
      }
    } else if (msg.type === "presence_sync") {
      if (msg.channel === this.name || (this.name.startsWith("online-users") && String(msg.channel).startsWith("online-users"))) {
        this.currentPresenceState = msg.state || {};
        for (const h of this.presenceHandlers) h.cb();
      }
    }
  }

  async send(msg: { type: string; event: string; payload: any }) {
    const ws = getWebSocket();
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "broadcast",
          channel: this.name,
          event: msg.event,
          payload: msg.payload,
          self: this.opts?.config?.broadcast?.self !== false,
        }),
      );
    }
    return "ok";
  }

  async track(payload: Record<string, any>) {
    const ws = getWebSocket();
    const key = this.opts?.config?.presence?.key || "anon";
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "presence_track", channel: this.name, key, payload }));
    }
    return "ok";
  }

  presenceState() {
    return this.currentPresenceState;
  }

  async unsubscribe() {
    activeChannels.delete(this);
    if (sharedWs?.readyState === WebSocket.OPEN) {
      sharedWs.send(JSON.stringify({ type: "unsubscribe", channel: this.name }));
    }
    return "ok";
  }
}

// ============================================================================
// 5. Main Exported API Client
// ============================================================================
export const apiClient = {
  auth,
  storage,

  from<T = any>(table: string) {
    return new QueryBuilder<T>(table);
  },

  async rpc<T = any>(fn: string, args: Record<string, any> = {}): Promise<{ data: T; error: any }> {
    try {
      const res = await fetch(apiUrl(`/api/rpc/${encodeURIComponent(fn)}`), {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(args),
      });
      const json = await res.json();
      return { data: (json.data ?? null) as T, error: json.error ?? null };
    } catch (err: any) {
      return { data: null as any, error: { message: err?.message || "RPC network error" } };
    }
  },

  channel(name: string, opts?: any) {
    return new RealtimeChannel(name, opts);
  },

  removeChannel(ch: RealtimeChannel) {
    return ch.unsubscribe();
  },
};

export function createClient() {
  return apiClient;
}
