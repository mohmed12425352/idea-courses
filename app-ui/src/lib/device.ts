import { supabase } from "@/integrations/supabase/client";
import { getDesktopBridge } from "@/lib/desktop";
import { getMobileNativeHardwareInfo } from "@/lib/apps-runtime";

const KEY = "edn_apps_device_id";

function genId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "d_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";

  // 1. Windows Protected Desktop App -> Hardware ID
  const desktopBridge = getDesktopBridge();
  if (desktopBridge) {
    const hwId = desktopBridge.getHardwareId();
    if (hwId) return hwId;
  }

  // 2. Android / iOS Protected Mobile App -> Hardware ANDROID_ID SHA-256
  const mobileHw = getMobileNativeHardwareInfo();
  if (mobileHw?.hardwareId) {
    return mobileHw.hardwareId;
  }

  let id = localStorage.getItem(KEY);
  if (!id) {
    id = genId();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export async function registerCurrentDevice(): Promise<{ banned: boolean; warning?: boolean }> {
  const device_id = getDeviceId();
  if (!device_id) return { banned: false };

  const desktopBridge = getDesktopBridge();
  const mobileHw = getMobileNativeHardwareInfo();
  const ua =
    desktopBridge?.getDeviceInfo()?.userAgentTag ||
    mobileHw?.userAgentTag ||
    (typeof navigator !== "undefined" ? navigator.userAgent : "");

  const { data, error } = await supabase.rpc("register_device", {
    _device_id: device_id,
    _user_agent: ua,
  });
  if (error) {
    console.error("[device] register failed", error);
    return { banned: false };
  }
  const res = (data ?? {}) as { ok?: boolean; banned?: boolean; warning?: boolean };
  return { banned: !!res.banned, warning: !!res.warning };
}
