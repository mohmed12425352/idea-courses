// ============================================================================
// Dynamic Cloud / LAN API Endpoint Resolver & Native Mobile Bridge
// ============================================================================

export interface MobileNativeBridge {
  getHardwareDeviceInfo?: () => string; // JSON string from Android @JavascriptInterface
  isScreenFlagSecure?: () => boolean;
}

declare global {
  interface Window {
    EdunovaMobileNative?: MobileNativeBridge;
    Capacitor?: any;
  }
}

const SERVER_URL_KEY = "edunova_apps_server_url_v1";

// Candidate endpoints auto-probed when running inside packaged Android APK / iOS App
const DEFAULT_MOBILE_SERVER_CANDIDATES = [
  (import.meta as any).env?.VITE_API_URL || "",
  "https://apps-backend-production-d2608a9b.up.railway.app", // Live 24/7 Railway Cloud Server!
  "http://192.168.1.220:4500", // Host Wi-Fi IP fallback
  "http://10.0.2.2:4500",      // Android Emulator fallback
  "http://localhost:4500",     // USB adb reverse fallback
].filter(Boolean);

export function isMobileNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  if (window.EdunovaMobileNative || window.Capacitor?.isNativePlatform?.()) return true;
  const proto = window.location.protocol;
  if (proto === "capacitor:" || proto === "ionic:" || proto === "file:") return true;
  // Capacitor Android WebView serves local assets from https://localhost (no port)
  if (window.location.hostname === "localhost" && !window.location.port) return true;
  return false;
}

export function getAppsApiBase(): string {
  if (typeof window === "undefined") return "";
  const saved = window.localStorage.getItem(SERVER_URL_KEY)?.trim().replace(/\/+$/, "");
  if (saved) return saved;

  const envUrl = ((import.meta as any).env?.VITE_API_URL || "").trim().replace(/\/+$/, "");
  if (envUrl) return envUrl;

  if (isMobileNativeShell()) {
    return DEFAULT_MOBILE_SERVER_CANDIDATES[0] || "http://192.168.1.220:4500";
  }

  return "";
}

export function setAppsApiBase(nextUrl: string | null): void {
  if (typeof window === "undefined") return;
  const clean = (nextUrl || "").trim().replace(/\/+$/, "");
  if (clean) {
    window.localStorage.setItem(SERVER_URL_KEY, clean);
  } else {
    window.localStorage.removeItem(SERVER_URL_KEY);
  }
  window.dispatchEvent(new CustomEvent("edunova:server-url-changed", { detail: clean }));
}

export async function autoDiscoverMobileServer(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(SERVER_URL_KEY)?.trim().replace(/\/+$/, "");
  const candidates = Array.from(new Set([saved, ...DEFAULT_MOBILE_SERVER_CANDIDATES].filter(Boolean))) as string[];

  for (const base of candidates) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 1800);
      const res = await fetch(`${base}/api/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) {
        setAppsApiBase(base);
        return base;
      }
    } catch {
      // Try next candidate
    }
  }
  return null;
}

export function getMobileNativeHardwareInfo(): {
  hardwareId: string;
  shortCode: string;
  userAgentTag: string;
  flagSecure: boolean;
} | null {
  if (typeof window === "undefined" || !window.EdunovaMobileNative?.getHardwareDeviceInfo) {
    return null;
  }
  try {
    const raw = window.EdunovaMobileNative.getHardwareDeviceInfo();
    const parsed = JSON.parse(raw);
    if (parsed?.hardwareId) return parsed;
  } catch {}
  return null;
}

/**
 * Rewrites relative `/uploads/...` media URLs when running inside packaged Capacitor APK
 */
export function installMobileMediaUrlRewriter(): void {
  if (typeof window === "undefined" || !isMobileNativeShell()) return;

  const rewriteNode = (el: Element) => {
    if (el instanceof HTMLImageElement || el instanceof HTMLVideoElement || el instanceof HTMLSourceElement) {
      const rawAttr = el.getAttribute("src");
      if (rawAttr && rawAttr.startsWith("/uploads/")) {
        const base = getAppsApiBase();
        if (base) el.src = `${base}${rawAttr}`;
      }
    }
  };

  const scanAll = () => {
    document.querySelectorAll("img[src^='/uploads/'], video[src^='/uploads/'], source[src^='/uploads/']").forEach(rewriteNode);
  };

  scanAll();
  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "attributes" && m.target instanceof Element) {
        rewriteNode(m.target);
      } else {
        m.addedNodes.forEach((n) => {
          if (n instanceof Element) {
            rewriteNode(n);
            n.querySelectorAll?.("img, video, source").forEach(rewriteNode);
          }
        });
      }
    }
  });

  obs.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src"],
  });

  window.addEventListener("edunova:server-url-changed", scanAll);
}
