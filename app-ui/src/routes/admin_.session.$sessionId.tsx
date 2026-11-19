import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/layout/SiteShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Loader2, ExternalLink, RefreshCw, CheckCircle2, Circle, AlertCircle, Clock } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getSessionTimeline, syncSessionRecording } from "@/lib/recording-sync.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin_/session/$sessionId")({
  ssr: false,
  beforeLoad: async ({ params }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login", search: { redirect: `/admin/session/${params.sessionId}` } });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" });
    if (!isAdmin) throw redirect({ to: "/" });
  },
  component: SessionDetailsPage,
});

type Timeline = Awaited<ReturnType<typeof getSessionTimeline>>;

function SessionDetailsPage() {
  const { sessionId } = Route.useParams();
  const timelineFn = useServerFn(getSessionTimeline);
  const syncFn = useServerFn(syncSessionRecording);
  const [data, setData] = useState<Timeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    try {
      const r = await timelineFn({ data: { sessionId } });
      setData(r as Timeline);
    } catch (e: any) {
      toast.error(e.message ?? "فشل تحميل التفاصيل");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [sessionId]);

  // Auto-refresh while something is still active
  useEffect(() => {
    if (!data) return;
    const active = data.steps.some((s) => s.status === "active");
    const delay = active ? 4000 : 15000;
    const t = setTimeout(load, delay);
    return () => clearTimeout(t);
  }, [data]);

  const forceSync = async () => {
    setSyncing(true);
    try {
      const r: any = await syncFn({ data: { sessionId } });
      if (r?.ok) toast.success("تمت المزامنة ✅");
      else toast.error(r?.reason || "فشلت المزامنة");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "فشلت المزامنة");
    } finally { setSyncing(false); }
  };

  if (loading) return <SiteShell><div className="container-page py-20 text-center text-muted-foreground">جاري التحميل…</div></SiteShell>;
  if (!data) return <SiteShell><div className="container-page py-20 text-center">غير موجود</div></SiteShell>;

  const s = data.session;
  const bunny = data.bunny;

  return (
    <SiteShell>
      <div className="container-page py-8 max-w-3xl">
        <Link to="/admin/course-sessions/$courseId" params={{ courseId: s.course_id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowRight className="h-4 w-4" /> العودة للجلسات
        </Link>

        <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-primary">{s.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date(s.scheduled_at).toLocaleString("ar-EG", { dateStyle: "full", timeStyle: "short" })} • {s.duration_minutes ?? 60} دقيقة
              {s.provider && <> • <Badge variant="secondary">{s.provider === "zoom" ? "Zoom" : "Google Meet"}</Badge></>}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 ml-1" /> تحديث</Button>
            {(s.zoom_meeting_id || s.google_event_id) && !s.recording_url && (
              <Button size="sm" onClick={forceSync} disabled={syncing} className="bg-gold text-gold-foreground hover:bg-gold/90">
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : "🔄 مزامنة يدوية"}
              </Button>
            )}
          </div>
        </div>

        {/* Resources */}
        <Card className="p-4 mb-6">
          <h2 className="font-bold mb-3">الموارد</h2>
          <div className="space-y-2 text-sm">
            {s.meeting_url && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">رابط الميتنج:</span>
                <a href={s.meeting_url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1" dir="ltr">
                  {s.meeting_url} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            {s.recording_url && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">التسجيل:</span>
                <a href={s.recording_url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1" dir="ltr">
                  فتح التسجيل <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            {s.zoom_meeting_id && (
              <div><span className="font-semibold">Zoom Meeting ID:</span> <code dir="ltr">{s.zoom_meeting_id}</code></div>
            )}
            {s.google_event_id && (
              <div><span className="font-semibold">Google Event ID:</span> <code dir="ltr" className="text-xs">{s.google_event_id}</code></div>
            )}
            {bunny && (
              <div>
                <span className="font-semibold">Bunny:</span> حالة <code>{bunny.status}</code> • ترميز {bunny.encodeProgress}%
              </div>
            )}
          </div>
        </Card>

        {/* Timeline */}
        <Card className="p-5">
          <h2 className="font-bold mb-4">📋 سجل الخطوات</h2>
          <ol className="relative border-r-2 border-border pr-6 space-y-5">
            {data.steps.map((step, i) => (
              <li key={step.key} className="relative">
                <div className="absolute -right-[34px] top-0.5 bg-background">
                  {step.status === "done" && <CheckCircle2 className="h-6 w-6 text-emerald-600" />}
                  {step.status === "active" && <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />}
                  {step.status === "error" && <AlertCircle className="h-6 w-6 text-destructive" />}
                  {step.status === "pending" && <Circle className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="font-semibold text-sm">{step.title}</div>
                  {step.at && (
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(step.at).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "medium" })}
                    </span>
                  )}
                </div>
                {step.detail && <div className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{step.detail}</div>}
                {step.link && (
                  <a href={step.link.href} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1">
                    {step.link.label} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {step.status === "active" && bunny && step.key === "bunny_encode" && (
                  <div className="mt-2 h-1.5 bg-amber-200/60 rounded overflow-hidden">
                    <div className="h-full bg-amber-500 transition-all" style={{ width: `${Math.max(bunny.encodeProgress, 5)}%` }} />
                  </div>
                )}
              </li>
            ))}
          </ol>
          {data.steps.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-6">لا توجد خطوات بعد</div>
          )}
        </Card>
      </div>
    </SiteShell>
  );
}