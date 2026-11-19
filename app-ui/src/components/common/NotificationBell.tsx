import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Bell, ExternalLink } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Notif = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  target_user_id: string | null;
  created_at: string;
  read?: boolean;
};

export function NotificationBell() {
  const { user } = useAuth();
  const { isEn } = useI18n();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  const load = async (uid: string) => {
    const [{ data: notifs }, { data: reads }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id,title,body,link,target_user_id,created_at")
        .or(`target_user_id.is.null,target_user_id.eq.${uid}`)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("notification_reads").select("notification_id").eq("user_id", uid),
    ]);
    const readSet = new Set((reads ?? []).map((r: any) => r.notification_id));
    setItems((notifs ?? []).map((n: any) => ({ ...n, read: readSet.has(n.id) })));
  };

  useEffect(() => {
    if (!user) { setItems([]); return; }
    let cancelled = false;
    load(user.id);

    const channel = supabase.channel(`notifications-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications" },
      (payload) => {
        if (cancelled) return;
        const n: any = payload.new;
        if (n.target_user_id && n.target_user_id !== user.id) return;
        setItems((prev) => {
          if (prev.some((p) => p.id === n.id)) return prev;
          // Only toast on truly new items (not ones already loaded)
          toast(n.title, { description: n.body, duration: 6000 });
          return [{ ...n, read: false }, ...prev];
        });
      }
    );
    channel.subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (!user) return null;

  const unread = items.filter((n) => !n.read).length;

  const markAllRead = async () => {
    const toMark = items.filter((n) => !n.read);
    if (toMark.length === 0) return;
    await supabase.from("notification_reads").upsert(
      toMark.map((n) => ({ user_id: user.id, notification_id: n.id })),
      { onConflict: "user_id,notification_id" }
    );
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) markAllRead(); }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-foreground/75 hover:text-foreground hover:bg-secondary transition-colors"
          aria-label={isEn ? "Notifications" : "الإشعارات"}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground grid place-items-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b font-bold text-sm text-foreground">
          {isEn ? "Notifications" : "الإشعارات"}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              {isEn ? "No notifications" : "لا توجد إشعارات"}
            </div>
          ) : (
            items.map((n) => (
              <div key={n.id} className={`p-3 border-b last:border-0 ${n.read ? "" : "bg-secondary/40"}`}>
                <div className="font-semibold text-sm text-foreground">{n.title}</div>
                <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{n.body}</div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString(isEn ? "en-US" : "ar-EG")}
                  </span>
                  {n.link && (
                    <a href={n.link} target="_blank" rel="noreferrer" className="text-[11px] text-primary inline-flex items-center gap-1 hover:underline">
                      {isEn ? "Open" : "فتح"} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}