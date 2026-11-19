// ============================================================================
// Clean Cloud Apps Client API + Hardware Lock + Live WebSocket Presence
// ============================================================================

export const CLOUD_API_URL = "https://apps-backend-production-d2608a9b.up.railway.app";
const SERVER_STORAGE_KEY = "idea_clean_apps_server_url";
const TOKEN_STORAGE_KEY = "idea_clean_apps_jwt_v2";
const WEB_DEVICE_KEY = "idea_clean_web_device_id";

declare global {
  interface Window {
    edunovaDesktop?: {
      isDesktop: boolean;
      getHardwareId: () => string;
      getDeviceInfo: () => { hardwareId: string; shortCode: string; hostname: string; userAgentTag: string };
      onSecurityStatus?: (cb: (st: { locked: boolean; detected: string[] }) => void) => () => void;
    };
    EdunovaMobileNative?: {
      getHardwareDeviceInfo?: () => string;
      isScreenFlagSecure?: () => boolean;
      enterFullscreen?: () => void;
      exitFullscreen?: () => void;
    };
    Capacitor?: any;
    __edunovaHandleBack?: () => boolean;
    __edunovaExitFullscreen?: () => boolean;
  }
}

export function isPackagedMobileApp(): boolean {
  if (typeof window === "undefined") return false;
  if (window.EdunovaMobileNative || window.Capacitor?.isNativePlatform?.()) return true;
  const proto = window.location.protocol;
  if (proto === "capacitor:" || proto === "ionic:" || proto === "file:") return true;
  if (window.location.hostname === "localhost" && !window.location.port) return true;
  return false;
}

export function isPackagedDesktopApp(): boolean {
  return typeof window !== "undefined" && Boolean(window.edunovaDesktop?.isDesktop);
}

export function getRuntimePlatform(): "desktop" | "mobile" | "web" {
  if (isPackagedDesktopApp()) return "desktop";
  if (isPackagedMobileApp()) return "mobile";
  return "web";
}

export function getDeviceIdentity(): { deviceId: string; shortCode: string; userAgent: string; label: string } {
  if (typeof window === "undefined") {
    return { deviceId: "", shortCode: "", userAgent: "", label: "" };
  }

  // 1. Windows Protected EXE
  if (window.edunovaDesktop?.isDesktop) {
    const info = window.edunovaDesktop.getDeviceInfo();
    return {
      deviceId: info.hardwareId,
      shortCode: info.shortCode,
      userAgent: info.userAgentTag,
      label: `تطبيق الكمبيوتر (${info.hostname})`,
    };
  }

  // 2. Android Protected APK
  if (window.EdunovaMobileNative?.getHardwareDeviceInfo) {
    try {
      const info = JSON.parse(window.EdunovaMobileNative.getHardwareDeviceInfo());
      return {
        deviceId: info.hardwareId,
        shortCode: info.shortCode,
        userAgent: info.userAgentTag,
        label: `تطبيق الموبايل (${info.deviceModel || "Android"})`,
      };
    } catch {}
  }

  // 3. Browser fallback
  let id = localStorage.getItem(WEB_DEVICE_KEY);
  if (!id) {
    id = "web_" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    localStorage.setItem(WEB_DEVICE_KEY, id);
  }
  return {
    deviceId: id,
    shortCode: id.slice(4, 10).toUpperCase(),
    userAgent: navigator.userAgent,
    label: "متصفح الويب",
  };
}

export function getApiBase(): string {
  if (typeof window === "undefined") return "";
  const custom = localStorage.getItem(SERVER_STORAGE_KEY)?.trim().replace(/\/+$/, "");
  if (custom) return custom;
  if (isPackagedMobileApp()) return CLOUD_API_URL;
  return "";
}

export function setCustomApiBase(url: string | null): void {
  if (typeof window === "undefined") return;
  const clean = (url || "").trim().replace(/\/+$/, "");
  if (clean) localStorage.setItem(SERVER_STORAGE_KEY, clean);
  else localStorage.removeItem(SERVER_STORAGE_KEY);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const base = getApiBase();
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const res = await fetch(`${base}${path}`, {
    ...options,
    headers,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || `خطأ في الطلب (${res.status})`);
  }
  return json as T;
}

export function resolveMediaUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("/api/")) {
    const base = getApiBase();
    return `${base}${url}`;
  }
  return url;
}

export async function compressAndUploadCourseImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("تعذّر قراءة ملف الصورة"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("ملف الصورة غير صالح"));
      img.onload = () => {
        const maxW = 960;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });

  const res = await apiFetch<{ url: string }>("/api/admin/upload-image", {
    method: "POST",
    body: JSON.stringify({ dataUrl }),
  });
  return res.url;
}

export async function compressAndUploadReceiptImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("تعذّر قراءة صورة الإيصال"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("ملف الصورة غير صالح"));
      img.onload = () => {
        const maxW = 1280;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });

  const res = await apiFetch<{ url: string }>("/api/student/upload-receipt", {
    method: "POST",
    body: JSON.stringify({ dataUrl }),
  });
  return res.url;
}

export interface YouTubeUploadResult {
  videoId: string;
  youtubeUrl: string;
  privacyStatus: string;
  forcedPrivateByUnverifiedApp: boolean;
  thumbnailUrl: string;
}

export async function uploadVideoToYouTubeUnlisted(
  file: File,
  meta: { title: string; description?: string },
  onProgress: (info: { percent: number; uploadedMB: number; totalMB: number }) => void,
  signal?: AbortSignal,
): Promise<YouTubeUploadResult> {
  const init = await apiFetch<{ uploadId: string; chunkSize: number }>("/api/admin/youtube/init-upload", {
    method: "POST",
    body: JSON.stringify({
      title: meta.title,
      description: meta.description || "",
      fileSize: file.size,
      mimeType: file.type || "video/mp4",
    }),
    signal,
  });

  const chunkSize = Math.max(256 * 1024, Number(init.chunkSize) || 4 * 1024 * 1024);
  const totalSize = file.size;
  const totalMB = Number((totalSize / (1024 * 1024)).toFixed(1));
  const base = getApiBase();
  const token = getToken();

  let offset = 0;
  onProgress({ percent: 1, uploadedMB: 0, totalMB });

  while (offset < totalSize) {
    if (signal?.aborted) {
      throw new Error("تم إلغاء رفع الفيديو");
    }
    const end = Math.min(offset + chunkSize, totalSize) - 1;
    const blob = file.slice(offset, end + 1);
    const buf = await blob.arrayBuffer();

    let attempt = 0;
    let lastErr: any = null;
    let chunkResult: any = null;

    while (attempt < 3) {
      attempt += 1;
      try {
        const res = await fetch(`${base}/api/admin/youtube/upload-chunk/${encodeURIComponent(init.uploadId)}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/octet-stream",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "x-chunk-start": String(offset),
            "x-chunk-end": String(end),
            "x-total-size": String(totalSize),
          },
          body: buf,
          signal,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error || `خطأ في رفع الجزء (${res.status})`);
        }
        chunkResult = json;
        lastErr = null;
        break;
      } catch (err: any) {
        if (signal?.aborted) throw new Error("تم إلغاء رفع الفيديو");
        lastErr = err;
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 1200 * attempt));
        }
      }
    }

    if (lastErr) throw lastErr;

    offset = end + 1;
    const uploadedMB = Number((offset / (1024 * 1024)).toFixed(1));
    const percent = Math.min(99, Math.max(1, Math.round((offset / totalSize) * 100)));
    onProgress({ percent, uploadedMB, totalMB });

    if (chunkResult?.done && chunkResult?.videoId) {
      onProgress({ percent: 100, uploadedMB: totalMB, totalMB });
      return {
        videoId: chunkResult.videoId,
        youtubeUrl: chunkResult.youtubeUrl,
        privacyStatus: chunkResult.privacyStatus || "unlisted",
        forcedPrivateByUnverifiedApp: Boolean(chunkResult.forcedPrivateByUnverifiedApp),
        thumbnailUrl: chunkResult.thumbnailUrl || "",
      };
    }
  }

  throw new Error("اكتمل إرسال الملف لكن لم يصل معرّف الفيديو من يوتيوب");
}

export function extractYouTubeIdClient(raw: string): string {
  const input = String(raw || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .trim();
  if (!input) return "";
  if (input.startsWith("list:") || input.startsWith("bunny:")) return input;
  if (/^[A-Za-z0-9_-]{11}$/.test(input) && input.toLowerCase() !== "videoseries") return input;

  const iframeSrc = input.match(/src=["']([^"']+)["']/i)?.[1] || input;
  const bunnyMatch = iframeSrc.match(/mediadelivery\.net\/(?:embed|play)\/(\d+)\/([0-9a-fA-F-]{36})/i);
  if (bunnyMatch?.[1] && bunnyMatch?.[2]) {
    return `bunny:${bunnyMatch[1]}:${bunnyMatch[2]}`;
  }
  const m =
    iframeSrc.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([A-Za-z0-9_-]{11})/i,
    ) || iframeSrc.match(/[?&]v=([A-Za-z0-9_-]{11})/i);
  if (m?.[1] && m[1].toLowerCase() !== "videoseries") {
    return m[1];
  }

  const listMatch = iframeSrc.match(/[?&]list=([A-Za-z0-9_-]{10,})/i);
  if (listMatch?.[1]) {
    return `list:${listMatch[1]}`;
  }

  return "";
}

// ============================================================================
// Live WebSocket Connection (Auto-Reconnect + Presence + Live Sync)
// ============================================================================
export function connectLiveSocket(onEvent: (event: { type: string; payload: any }) => void): () => void {
  let ws: WebSocket | null = null;
  let closed = false;
  let retryTimer: any = null;

  const connect = () => {
    if (closed) return;
    try {
      const base = getApiBase();
      const wsUrl = base
        ? `${base.replace(/^http/, "ws")}/ws`
        : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;

      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        const token = getToken();
        if (token && ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "identify", token, platform: getRuntimePlatform() }));
        }
      };
      ws.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(String(ev.data));
          if (parsed?.type) onEvent(parsed);
        } catch {}
      };
      ws.onclose = () => {
        if (!closed) {
          retryTimer = setTimeout(connect, 3500);
        }
      };
    } catch {
      if (!closed) retryTimer = setTimeout(connect, 4500);
    }
  };

  connect();
  return () => {
    closed = true;
    clearTimeout(retryTimer);
    try {
      ws?.close();
    } catch {}
  };
}
