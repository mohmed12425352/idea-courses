import { useEffect, useState } from "react";
import { Shield, Server, CheckCircle2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { onGlobalAppPush } from "@/lib/api-sdk";
import { invalidateCache } from "@/lib/cache";
import {
  autoDiscoverMobileServer,
  getAppsApiBase,
  getMobileNativeHardwareInfo,
  installMobileMediaUrlRewriter,
  isMobileNativeShell,
  setAppsApiBase,
} from "@/lib/apps-runtime";

export function AppCloudSyncAgent() {
  const isMobileApp = isMobileNativeShell();
  const mobileHw = getMobileNativeHardwareInfo();
  const [modalOpen, setModalOpen] = useState(false);
  const [serverInput, setServerInput] = useState(() => getAppsApiBase());
  const [probing, setProbing] = useState(false);

  useEffect(() => {
    installMobileMediaUrlRewriter();
    if (isMobileApp) {
      autoDiscoverMobileServer().then((found) => {
        if (found) setServerInput(found);
      });
    }

    // 1. Instant Global Push Alerts from Apps Admin Panel
    const offPush = onGlobalAppPush((notif) => {
      toast.info(notif.title || "تنبيه جديد من الإدارة 🔔", {
        description: notif.body,
        duration: 9000,
      });
    });

    // 2. Real-time PostgreSQL sync ("يسمّع عند الناس لحظياً")
    const ch = supabase
      .channel("apps-live-sync")
      .on("postgres_changes", { event: "*" }, (payload: any) => {
        invalidateCache("");
        if (payload?.table === "courses" && payload?.eventType === "INSERT") {
          toast.success(`تمت إضافة كورس جديد الآن: ${payload?.new?.title || ""}`);
        } else if (payload?.table === "lessons" && payload?.eventType === "INSERT") {
          toast.success(`تم رفع درس جديد الآن: ${payload?.new?.title || ""}`);
        }
      })
      .subscribe();

    return () => {
      offPush();
      supabase.removeChannel(ch);
    };
  }, [isMobileApp]);

  const handleSaveServer = async () => {
    const clean = serverInput.trim().replace(/\/+$/, "");
    if (!clean) return;
    setProbing(true);
    try {
      const res = await fetch(`${clean}/api/health`);
      if (!res.ok) throw new Error("السيرفر لا يستجيب");
      setAppsApiBase(clean);
      setModalOpen(false);
      toast.success("تم الاتصال بالسيرفر بنجاح ✓");
      window.location.reload();
    } catch {
      toast.error("تعذّر الوصول لهذا الرابط — تأكد من صحة عنوان السيرفر السحابي أو اتصال الشبكة");
    } finally {
      setProbing(false);
    }
  };

  if (!isMobileApp) return null;

  return (
    <>
      <div
        className="fixed top-0 inset-x-0 z-50 h-7 bg-[#120d10] border-b border-white/10 px-3 flex items-center justify-between text-[11px]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center gap-1.5 text-emerald-400 font-bold truncate">
          <Shield className="w-3.5 h-3.5 shrink-0" />
          <span>درع حماية الموبايل نشط • منع التصوير مفعّل</span>
          {mobileHw?.shortCode && <span className="text-amber-300 font-mono">[{mobileHw.shortCode}]</span>}
        </div>
        <button
          type="button"
          onClick={() => {
            setServerInput(getAppsApiBase());
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-1 text-slate-300 hover:text-white bg-white/5 px-2 py-0.5 rounded-md border border-white/10"
        >
          <Server className="w-3 h-3 text-amber-400" />
          <span>السيرفر</span>
        </button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#191316] border border-white/15 p-5 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-extrabold text-sm">إعدادات سيرفر التطبيق السحابي</h3>
                <p className="text-[11px] text-slate-400">اربط التطبيق بالسيرفر السحابي أو الشبكة المحلية</p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold block">رابط سيرفر التطبيقات (Cloud / Wi-Fi URL)</label>
              <input
                type="url"
                dir="ltr"
                value={serverInput}
                onChange={(e) => setServerInput(e.target.value)}
                placeholder="https://your-apps-server.up.railway.app"
                className="w-full rounded-xl bg-black/50 border border-white/15 px-3 py-2.5 text-xs text-white outline-none focus:border-rose-500"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setServerInput("https://apps-backend-production-d2608a9b.up.railway.app")}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-bold"
                >
                  السيرفر السحابي الرسمي ☁️
                </button>
                <button
                  type="button"
                  onClick={() => setServerInput("http://192.168.1.220:4500")}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-amber-300"
                >
                  واي فاي محلي (4500)
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                disabled={probing}
                onClick={async () => {
                  setProbing(true);
                  const found = await autoDiscoverMobileServer();
                  setProbing(false);
                  if (found) {
                    setServerInput(found);
                    toast.success(`تم العثور على السيرفر: ${found}`);
                  } else {
                    toast.error("لم يتم العثور على سيرفر تلقائي — أدخل الرابط السحابي يدوياً");
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${probing ? "animate-spin" : ""}`} />
                <span>اكتشاف تلقائي</span>
              </button>
              <button
                type="button"
                disabled={probing}
                onClick={handleSaveServer}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-bold text-white"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>حفظ والاتصال</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
