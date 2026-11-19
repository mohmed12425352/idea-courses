import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Wrench, Info, Sparkles, ExternalLink, X, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  getBroadcastAnnouncement,
  isAnnouncementDismissed,
  markAnnouncementDismissed,
  type BroadcastAnnouncement,
} from "@/lib/announcements";

export function BroadcastAnnouncementModal() {
  const { user } = useAuth();
  const { isEn, dir } = useI18n();
  const [announcement, setAnnouncement] = useState<BroadcastAnnouncement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Only show to logged-in users / registered students
    if (!user) {
      setOpen(false);
      return;
    }

    let cancelled = false;
    getBroadcastAnnouncement().then((ann) => {
      if (cancelled || !ann || !ann.active) return;
      if (!isAnnouncementDismissed(ann)) {
        setAnnouncement(ann);
        setOpen(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!announcement || !announcement.active) return null;

  const handleDismiss = () => {
    markAnnouncementDismissed(announcement, true);
    setOpen(false);
  };

  const typeConfig = {
    maintenance: {
      label: isEn ? "Scheduled Maintenance" : "صيانة مجدولة في المنصة",
      icon: Wrench,
      badgeCls: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      iconCls: "text-amber-400 bg-amber-500/20",
      borderCls: "border-amber-500/30",
    },
    warning: {
      label: isEn ? "Important Notice" : "تنبيه هام وملاحظة",
      icon: AlertTriangle,
      badgeCls: "bg-red-500/10 text-red-400 border-red-500/30",
      iconCls: "text-red-400 bg-red-500/20",
      borderCls: "border-red-500/30",
    },
    promotion: {
      label: isEn ? "Special Offer" : "عرض وإعلان خاص",
      icon: Sparkles,
      badgeCls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
      iconCls: "text-yellow-400 bg-yellow-500/20",
      borderCls: "border-yellow-500/30",
    },
    info: {
      label: isEn ? "Platform Announcement" : "إشعار وتحديث للمنصة",
      icon: Info,
      badgeCls: "bg-sky-500/10 text-sky-400 border-sky-500/30",
      iconCls: "text-sky-400 bg-sky-500/20",
      borderCls: "border-sky-500/30",
    },
  };

  const currentType = typeConfig[announcement.type || "info"] || typeConfig.info;
  const Icon = currentType.icon;
  const title = isEn && announcement.title_en ? announcement.title_en : announcement.title;
  const message = isEn && announcement.message_en ? announcement.message_en : announcement.message;
  const actionLabel = isEn && announcement.action_label_en ? announcement.action_label_en : announcement.action_label;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent
        className={`sm:max-w-lg p-0 overflow-hidden bg-[#0d1424] border ${currentType.borderCls} text-slate-100 shadow-2xl`}
        dir={dir}
      >
        {/* Banner image if present */}
        {announcement.image_url && (
          <div className="relative w-full max-h-56 overflow-hidden bg-black flex items-center justify-center border-b border-slate-800">
            <img
              src={announcement.image_url}
              alt={title || "إشعار المنصة"}
              className="w-full h-full object-cover max-h-56"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0d1424] via-transparent to-black/30 pointer-events-none" />
          </div>
        )}

        <div className="p-6 space-y-4">
          <DialogHeader className="space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${currentType.badgeCls}`}>
                <Icon className="w-3.5 h-3.5" />
                {currentType.label}
              </span>
            </div>

            <DialogTitle className="text-lg md:text-xl font-black text-white leading-snug">
              {title || (isEn ? "Platform Notice" : "إشعار المنصة")}
            </DialogTitle>
          </DialogHeader>

          {message && (
            <DialogDescription className="text-slate-300 text-sm md:text-base leading-relaxed whitespace-pre-line">
              {message}
            </DialogDescription>
          )}

          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-800/80">
            {announcement.action_url && actionLabel && (
              <a
                href={announcement.action_url}
                target={announcement.action_url.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
                onClick={handleDismiss}
                className="inline-flex items-center justify-center gap-1.5 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-sm transition-all shadow-md active:scale-95"
              >
                <span>{actionLabel}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={handleDismiss}
              className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 text-sm font-semibold rounded-xl px-5"
            >
              <CheckCircle2 className="w-4 h-4 ml-1.5 text-emerald-400" />
              {isEn ? "Got it" : "حسناً، فهمت"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
