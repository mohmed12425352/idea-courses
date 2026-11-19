import { supabase } from "@/integrations/supabase/client";

export interface BroadcastAnnouncement {
  id: string;
  active: boolean;
  title: string;
  title_en?: string;
  message: string;
  message_en?: string;
  image_url?: string;
  type?: "maintenance" | "warning" | "info" | "promotion";
  action_label?: string;
  action_label_en?: string;
  action_url?: string;
  updated_at: string;
}

const SETTING_KEY = "broadcast_announcement";

export async function getBroadcastAnnouncement(): Promise<BroadcastAnnouncement | null> {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value, updated_at")
      .eq("key", SETTING_KEY)
      .maybeSingle();

    if (error || !data?.value) return null;
    const val = data.value as unknown as Partial<BroadcastAnnouncement>;
    if (typeof val !== "object" || val === null) return null;

    return {
      id: val.id || "default",
      active: !!val.active,
      title: val.title || "",
      title_en: val.title_en || "",
      message: val.message || "",
      message_en: val.message_en || "",
      image_url: val.image_url || "",
      type: val.type || "info",
      action_label: val.action_label || "",
      action_label_en: val.action_label_en || "",
      action_url: val.action_url || "",
      updated_at: data.updated_at || val.updated_at || new Date().toISOString(),
    };
  } catch (err) {
    console.error("Failed to load broadcast announcement:", err);
    return null;
  }
}

export async function saveBroadcastAnnouncement(announcement: Partial<BroadcastAnnouncement>): Promise<{ ok: boolean; error?: string }> {
  try {
    const payload: BroadcastAnnouncement = {
      id: announcement.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ann_${Date.now()}`),
      active: !!announcement.active,
      title: announcement.title || "",
      title_en: announcement.title_en || "",
      message: announcement.message || "",
      message_en: announcement.message_en || "",
      image_url: announcement.image_url || "",
      type: announcement.type || "info",
      action_label: announcement.action_label || "",
      action_label_en: announcement.action_label_en || "",
      action_url: announcement.action_url || "",
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("app_settings").upsert(
      {
        key: SETTING_KEY,
        value: payload as any,
        updated_at: payload.updated_at,
      },
      { onConflict: "key" },
    );

    if (error) throw error;
    return { ok: true };
  } catch (err: any) {
    console.error("Failed to save broadcast announcement:", err);
    return { ok: false, error: err.message || "Failed to save" };
  }
}

export function isAnnouncementDismissed(announcement: BroadcastAnnouncement): boolean {
  if (typeof window === "undefined" || !announcement) return false;
  const key = `dismissed_announcement_${announcement.id}_${announcement.updated_at}`;
  return window.localStorage.getItem(key) === "1" || window.sessionStorage.getItem(key) === "1";
}

export function markAnnouncementDismissed(announcement: BroadcastAnnouncement, persistent = true) {
  if (typeof window === "undefined" || !announcement) return;
  const key = `dismissed_announcement_${announcement.id}_${announcement.updated_at}`;
  if (persistent) {
    window.localStorage.setItem(key, "1");
  } else {
    window.sessionStorage.setItem(key, "1");
  }
}
