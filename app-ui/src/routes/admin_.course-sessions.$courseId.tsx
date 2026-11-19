import { sendPlatformEmail } from "@/lib/transactional-email.functions";
import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/layout/SiteShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Plus, Trash2, Calendar, Video, Loader2, ExternalLink, Clock, Save, Upload, FileVideo, RotateCcw, Users } from "lucide-react";

import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { useServerFn } from "@tanstack/react-start";
import { createMeetLink } from "@/lib/google-meet.functions";
import { createZoomMeeting } from "@/lib/zoom.functions";
import { getZoomConfigStatus, saveZoomConfig, clearZoomConfig, saveZoomWebhookSecret, checkZoomTokenScopes } from "@/lib/zoom-config.functions";
import { getMeetConfigStatus, saveMeetWebhookSecret } from "@/lib/meet-config.functions";
import { syncSessionRecording, getRecordingProgress } from "@/lib/recording-sync.functions";
import { deleteBunnyVideo } from "@/lib/bunny.functions";
import { Settings } from "lucide-react";
import { RefreshCw } from "lucide-react";

export const Route = createFileRoute("/admin_/course-sessions/$courseId")({
  ssr: false,
  beforeLoad: async ({ params }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login", search: { redirect: `/admin/course-sessions/${params.courseId}` } });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" });
    if (!isAdmin) throw redirect({ to: "/" });
  },
  component: AdminSessionsPage,
});

type LiveSession = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number | null;
  meeting_url: string | null;
  recording_url: string | null;
  status: string;
  allowed_user_ids: string[] | null;
  provider?: string | null;
  zoom_meeting_id?: string | null;
  google_event_id?: string | null;
  recording_synced_at?: string | null;
  module_id?: string | null;
};

type ModuleOption = { id: string; title: string };

function AdminSessionsPage() {
  const { courseId } = Route.useParams();
  const [course, setCourse] = useState<any>(null);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<{ id: string; name: string; email: string }[]>([]);
  const [allowedIds, setAllowedIds] = useState<string[]>([]); // empty = all enrolled
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [moduleId, setModuleId] = useState<string>("");

  // form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [generatingMeet, setGeneratingMeet] = useState(false);
  const [generatingZoom, setGeneratingZoom] = useState(false);
  const createMeetFn = useServerFn(createMeetLink);
  const createZoomFn = useServerFn(createZoomMeeting);

  // Auto-generate next session title following the "سيشن N" pattern.
  // If existing sessions already follow that pattern, continue after the max N.
  // Otherwise start from (count + 1) so numbering picks up wherever we are.
  const nextAutoTitle = () => {
    const re = /^\s*سيشن\s+(\d+)\s*$/;
    let maxN = 0;
    let matched = 0;
    for (const s of sessions) {
      const m = re.exec(s.title || "");
      if (m) { matched++; const n = parseInt(m[1], 10); if (n > maxN) maxN = n; }
    }
    const base = matched > 0 ? maxN : sessions.length;
    return `سيشن ${base + 1}`;
  };

  const saveSession = async (overrideUrl?: string, meta?: { provider?: "zoom" | "meet"; zoomMeetingId?: string; googleEventId?: string }): Promise<boolean> => {
    const urlToUse = (overrideUrl ?? meetingUrl).trim();
    const effectiveTitle = title.trim() || nextAutoTitle();
    if (!date || !time) { toast.error("ادخل التاريخ والوقت"); return false; }
    if (urlToUse && !/^https?:\/\//i.test(urlToUse)) { toast.error("رابط الميتنج لازم يبدأ بـ http(s)://"); return false; }
    let scheduledAt: string;
    try {
      const dt = new Date(`${date}T${time}`);
      if (isNaN(dt.getTime())) throw new Error("تاريخ غير صحيح");
      scheduledAt = dt.toISOString();
    } catch (e: any) {
      toast.error(e.message ?? "تاريخ غير صحيح"); return false;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("يجب تسجيل الدخول"); return false; }
    setSaving(true);
    const { data: inserted, error } = await supabase.from("live_sessions").insert({
      course_id: courseId,
      title: effectiveTitle,
      description: description.trim() || null,
      scheduled_at: scheduledAt,
      duration_minutes: parseInt(duration) || 60,
      meeting_url: urlToUse || null,
      created_by: user.id,
      allowed_user_ids: allowedIds,
      provider: meta?.provider ?? null,
      zoom_meeting_id: meta?.zoomMeetingId ?? null,
      google_event_id: meta?.googleEventId ?? null,
      module_id: moduleId || null,
    }).select().single();
    if (error) {
      console.error("[sessions] insert error", error);
      setSaving(false);
      toast.error(error.message || "فشل إنشاء الجلسة");
      return false;
    }

    const savedTitle = effectiveTitle;
    const savedDuration = parseInt(duration) || 60;
    const savedDesc = description.trim();
    setTitle(""); setDescription(""); setDate(""); setTime(""); setDuration("60"); setMeetingUrl(""); setAllowedIds([]); setModuleId("");
    toast.success("تم إنشاء الجلسة");
    setSaving(false);
    refresh();

    if (inserted) {
      try {
        const { data: enrolledAll } = await supabase.from("enrollments").select("user_id").eq("course_id", courseId).eq("status", "active");
        const enrolled = allowedIds.length > 0
          ? (enrolledAll ?? []).filter((e: any) => allowedIds.includes(e.user_id))
          : (enrolledAll ?? []);
        if (enrolled.length > 0) {
          const niceDate = new Date(scheduledAt).toLocaleString("ar-EG", { dateStyle: "full", timeStyle: "short" });
          const sessionLink = urlToUse || (course?.slug ? `/learn/${course.slug}` : "/dashboard");
          const notifications = enrolled.map((e) => ({
            title: `📅 جلسة مباشرة جديدة: ${savedTitle}`,
            body: `موعد الجلسة: ${niceDate}${urlToUse ? "\nاضغط فتح للدخول للميتنج" : ""}`,
            link: sessionLink,
            target_user_id: e.user_id,
            created_by: user.id,
          }));
          const { error: notifErr } = await supabase.from("notifications").insert(notifications);
          if (notifErr) console.warn("notifications insert failed", notifErr);
          else toast.success(`تم إشعار ${enrolled.length} طالب`);

          try {
            const userIds = enrolled.map((e) => e.user_id);
            const { data: profs } = await supabase.from("profiles").select("id,email,name").in("id", userIds);
            const { data: { session } } = await supabase.auth.getSession();
            const origin = typeof window !== "undefined" ? window.location.origin : "";
            const courseLink = course?.slug ? `${origin}/learn/${course.slug}` : undefined;
            if (profs && session) {
              let sent = 0;
              await Promise.all(profs.filter((p) => p.email).map(async (p) => {
                try {
                  const r: any = await sendPlatformEmail({
                    data: {
                      templateName: "live-session",
                      recipientEmail: p.email,
                      templateData: {
                        studentName: p.name || "الطالب",
                        courseTitle: course?.title ?? "",
                        sessionTitle: savedTitle,
                        scheduledAt: niceDate,
                        durationMinutes: savedDuration,
                        meetingUrl: urlToUse || undefined,
                        description: savedDesc || undefined,
                        courseLink,
                      },
                    },
                  });
                  if (r?.ok) sent++;

                } catch {}
              }));
              if (sent > 0) toast.success(`تم إرسال ${sent} بريد إلكتروني للطلاب`);
            }
          } catch (e) {
            console.warn("Email notifications failed", e);
          }
        }
      } catch (e) {
        console.warn("Notification step failed", e);
      }
    }
    return true;
  };

  const generateMeet = async () => {
    if (!date || !time) { toast.error("ادخل التاريخ والوقت الأول"); return; }
    let scheduledAt: string;
    try {
      const dt = new Date(`${date}T${time}`);
      if (isNaN(dt.getTime())) throw new Error();
      scheduledAt = dt.toISOString();
    } catch { toast.error("تاريخ غير صحيح"); return; }
    setGeneratingMeet(true);
    try {
      const r = await createMeetFn({ data: {
        title: title.trim() || nextAutoTitle(),
        description: description.trim() || undefined,
        scheduledAt,
        durationMinutes: parseInt(duration) || 60,
      }});
      setMeetingUrl(r.meetUrl);
      toast.success("تم إنشاء لينك Google Meet ✅ — جاري حفظ الجلسة...");
      await saveSession(r.meetUrl, { provider: "meet", googleEventId: (r as any).eventId });
    } catch (e: any) {
      toast.error(e.message ?? "فشل إنشاء اللينك");
    } finally {
      setGeneratingMeet(false);
    }
  };

  const generateZoom = async () => {
    if (!date || !time) { toast.error("ادخل التاريخ والوقت الأول"); return; }
    let scheduledAt: string;
    try {
      const dt = new Date(`${date}T${time}`);
      if (isNaN(dt.getTime())) throw new Error();
      scheduledAt = dt.toISOString();
    } catch { toast.error("تاريخ غير صحيح"); return; }
    setGeneratingZoom(true);
    try {
      const r = await createZoomFn({ data: {
        title: title.trim() || nextAutoTitle(),
        description: description.trim() || undefined,
        scheduledAt,
        durationMinutes: parseInt(duration) || 60,
      }});
      setMeetingUrl(r.meetUrl);
      toast.success("تم إنشاء لينك Zoom ✅ — جاري حفظ الجلسة...");
      await saveSession(r.meetUrl, { provider: "zoom", zoomMeetingId: (r as any).meetingId });
    } catch (e: any) {
      toast.error(e.message ?? "فشل إنشاء اللينك");
    } finally {
      setGeneratingZoom(false);
    }
  };

  const refresh = async () => {
    const [c, s, m] = await Promise.all([
      supabase.from("courses").select("id,title,slug").eq("id", courseId).maybeSingle(),
      supabase.from("live_sessions").select("*").eq("course_id", courseId).order("scheduled_at", { ascending: false }),
      supabase.from("modules").select("id,title").eq("course_id", courseId).order("order_index", { ascending: true }),
    ]);
    setCourse(c.data);
    setSessions((s.data ?? []) as LiveSession[]);
    setModules((m.data ?? []) as ModuleOption[]);
    // Load enrolled students for this course
    const { data: enr } = await supabase.from("enrollments").select("user_id").eq("course_id", courseId).eq("status", "active");
    const ids = (enr ?? []).map((e: any) => e.user_id);
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,name,email").in("id", ids);
      setStudents((profs ?? []) as any);
    } else {
      setStudents([]);
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [courseId]);

  const create = async () => { await saveSession(); };

  const remove = async (id: string) => {
    const s = sessions.find((x) => x.id === id);
    const hasRec = !!s?.recording_url;
    const msg = hasRec
      ? "⚠️ تحذير مهم:\nهذه الجلسة تحتوي على تسجيل مرفوع بالفعل!\nحذف الجلسة هنا سيقوم بحذف الجلسة بالكامل وحذف ملف الفيديو المسجل نهائياً من السيرفر.\n\nإذا كنت فقط تريد إزالة رابط الميتنج الحي بعد انتهائه، اضغط (إلغاء) ثم اضغط على زر 'إزالة رابط الميتنج فقط' داخل بطاقة الجلسة.\n\nهل ما زلت تريد حذف الجلسة والتسجيل نهائياً؟"
      : "هل أنت متأكد من حذف هذه الجلسة نهائياً؟";
    if (!confirm(msg)) return;
    if (s?.recording_url) {
      if (s.recording_url.startsWith("http")) {
        try { await deleteBunnyVideo({ data: { url: s.recording_url } }); } catch (e) { console.warn("bunny delete", e); }
      } else {
        await supabase.storage.from("course-videos").remove([s.recording_url]);
      }
    }
    const { error } = await supabase.from("live_sessions").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("تم الحذف"); refresh(); }
  };

  if (loading) return <SiteShell><div className="container-page py-20 text-center text-muted-foreground">جاري التحميل…</div></SiteShell>;
  if (!course) return <SiteShell><div className="container-page py-20 text-center">الكورس غير موجود</div></SiteShell>;

  return (
    <SiteShell>
      <div className="container-page py-8 max-w-4xl">
        <Link to="/admin/courses/$courseId" params={{ courseId }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowRight className="h-4 w-4" /> العودة لإدارة الكورس
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-primary flex items-center gap-2">
              <Calendar className="h-6 w-6 text-gold" /> الجلسات المباشرة
            </h1>
            <p className="text-muted-foreground mt-1">{course.title}</p>
          </div>
          <Link
            to="/admin/attendance/$courseId"
            params={{ courseId }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md transition-all active:scale-95"
          >
            <Users className="h-4 w-4" /> كشف وتقارير الحضور
          </Link>
        </div>


        <Card className="p-5 mb-6">
          <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
            <Plus className="h-4 w-4" /> جلسة جديدة
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>عنوان الجلسة *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`اتركه فارغًا للترقيم التلقائي (${nextAutoTitle()})`} />
            </div>
            <div>
              <Label>التاريخ *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>الوقت *</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div>
              <Label>المدة (بالدقائق)</Label>
              <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="60" />
            </div>
            <div>
              <Label>رابط الميتنج (Google Meet / Zoom)</Label>
              <Input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://meet.google.com/... أو https://zoom.us/..." dir="ltr" className="mb-2" />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={generateMeet} disabled={generatingMeet || generatingZoom} title="إنشاء لينك Google Meet تلقائي">
                  {generatingMeet ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Video className="h-4 w-4 ml-1" /> Google Meet</>}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={generateZoom} disabled={generatingMeet || generatingZoom} title="إنشاء لينك Zoom تلقائي">
                  {generatingZoom ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Video className="h-4 w-4 ml-1" /> Zoom</>}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">اختر Google Meet أو Zoom لإنشاء لينك تلقائي من حساب المنصة.</p>
            </div>
            <div className="sm:col-span-2">
              <Label>وصف / ملاحظات (اختياري)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="موضوعات الجلسة، تعليمات للطلاب..." />
            </div>
            <div className="sm:col-span-2">
              <Label>الموديول المرتبط (لرفع التسجيل بداخله تلقائيًا)</Label>
              <select
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">تسجيلات الجلسات المباشرة (افتراضي)</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">لما التسجيل يترفع تلقائيًا، هيتضاف كدرس داخل الموديول ده مباشرة.</p>
            </div>
            <div className="sm:col-span-2">
              <StudentPicker
                students={students}
                value={allowedIds}
                onChange={setAllowedIds}
              />
            </div>
          </div>
          <Button onClick={create} disabled={saving} className="mt-4 bg-gold text-gold-foreground hover:bg-gold/90">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin ml-1" /> جاري الإنشاء...</> : <><Plus className="h-4 w-4 ml-1" /> إنشاء الجلسة وإشعار الطلاب</>}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">💡 الطلاب المشتركون سيحصلون على إشعار فوري بالموعد ورابط الجلسة.</p>
        </Card>

        <ZoomCredentialsCard />

        <ZoomWebhookLogCard />

        <MeetIntegrationCard />

        <div className="space-y-3">
          <h2 className="font-bold text-lg">الجلسات ({sessions.length})</h2>
          {sessions.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">لا توجد جلسات بعد</Card>
          )}
          {sessions.map((s) => (
            <SessionRow key={s.id} session={s} students={students} modules={modules} onChange={refresh} onDelete={() => remove(s.id)} />
          ))}
        </div>
      </div>
    </SiteShell>
  );
}

function ZoomCredentialsCard() {
  const getStatus = useServerFn(getZoomConfigStatus);
  const saveFn = useServerFn(saveZoomConfig);
  const clearFn = useServerFn(clearZoomConfig);
  const saveWebhookFn = useServerFn(saveZoomWebhookSecret);
  const checkScopesFn = useServerFn(checkZoomTokenScopes);
  const [status, setStatus] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [scopeCheck, setScopeCheck] = useState<{ ok: boolean; scopes: string[]; missing: string[] } | null>(null);
  const [checking, setChecking] = useState(false);

  const runScopeCheck = async () => {
    setChecking(true);
    try {
      const r = await checkScopesFn();
      setScopeCheck(r);
      if (r.ok) toast.success("الـ Token صالح وكل الصلاحيات موجودة ✅");
      else toast.error(`صلاحيات ناقصة: ${r.missing.join(", ")}`);
    } catch (e: any) {
      setScopeCheck(null);
      toast.error(e.message ?? "فشل اختبار الـ Token");
    } finally { setChecking(false); }
  };

  const load = async () => {
    try { setStatus(await getStatus()); } catch (e: any) { console.warn(e); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!accountId.trim() || !clientId.trim() || !clientSecret.trim()) {
      toast.error("املأ كل الحقول"); return;
    }
    setBusy(true);
    try {
      await saveFn({ data: { accountId, clientId, clientSecret, webhookSecret: webhookSecret.trim() || undefined } });
      toast.success("تم حفظ بيانات Zoom وتم التحقق منها ✅");
      setAccountId(""); setClientId(""); setClientSecret(""); setWebhookSecret("");
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "فشل الحفظ");
    } finally { setBusy(false); }
  };

  const saveWebhookOnly = async () => {
    if (!webhookSecret.trim()) { toast.error("ادخل Webhook Secret Token"); return; }
    setBusy(true);
    try {
      await saveWebhookFn({ data: { webhookSecret: webhookSecret.trim() } });
      toast.success("تم حفظ Webhook Secret ✅");
      setWebhookSecret("");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "فشل الحفظ");
    } finally { setBusy(false); }
  };

  const clearDb = async () => {
    if (!confirm("مسح بيانات Zoom المخزنة والرجوع للإعدادات الافتراضية؟")) return;
    setBusy(true);
    try { await clearFn(); toast.success("تم المسح"); load(); }
    catch (e: any) { toast.error(e.message ?? "فشل المسح"); }
    finally { setBusy(false); }
  };

  return (
    <Card className="p-5 mb-6 border-gold/40">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Settings className="h-4 w-4 text-gold" /> بيانات حساب Zoom
        </h2>
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? "إغلاق" : "تعديل"}
        </Button>
      </div>
      <div className="text-sm text-muted-foreground mt-2">
        {status ? (
          <>
            المصدر الحالي: <Badge variant="secondary">{status.source === "database" ? "قاعدة البيانات" : status.source === "environment" ? "متغيرات النظام" : "غير مضبوط"}</Badge>
            {status.accountIdPreview && <span className="ml-2">Account: <code dir="ltr">{status.accountIdPreview}</code></span>}
            {status.clientIdPreview && <span className="ml-2">Client: <code dir="ltr">{status.clientIdPreview}</code></span>}
            {status.webhookSecretPreview && <span className="ml-2">Webhook: <code dir="ltr">{status.webhookSecretPreview}</code> <Badge variant="outline" className="ml-1">{status.hasDbWebhookSecret ? "قاعدة البيانات" : "متغيرات النظام"}</Badge></span>}
          </>
        ) : "جاري التحميل..."}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={runScopeCheck} disabled={checking}>
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "اختبار Token والصلاحيات"}
        </Button>
        {scopeCheck && (
          scopeCheck.ok
            ? <Badge className="bg-green-600">Token صالح ✅</Badge>
            : <Badge variant="destructive">صلاحيات ناقصة</Badge>
        )}
      </div>
      {scopeCheck && !scopeCheck.ok && (
        <div className="mt-2 text-xs text-destructive space-y-1">
          <div>الصلاحيات الناقصة:</div>
          <ul className="list-disc pr-5">
            {scopeCheck.missing.map((s) => <li key={s}><code dir="ltr">{s}</code></li>)}
          </ul>
          <div className="text-muted-foreground">
            افتح Zoom Marketplace → App بتاعك → Scopes → أضف صلاحيات Cloud Recording ثم Activate.
          </div>
        </div>
      )}
      {scopeCheck?.ok && scopeCheck.scopes.length > 0 && (
        <details className="mt-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer">عرض الصلاحيات ({scopeCheck.scopes.length})</summary>
          <div className="mt-1 flex flex-wrap gap-1">
            {scopeCheck.scopes.map((s) => <code key={s} dir="ltr" className="px-1 rounded bg-muted">{s}</code>)}
          </div>
        </details>
      )}
      {open && (
        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>Account ID</Label>
            <Input dir="ltr" value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="xxxxxxxxxxxxxxxxxxxxxx" />
          </div>
          <div>
            <Label>Client ID</Label>
            <Input dir="ltr" value={clientId} onChange={(e) => setClientId(e.target.value)} />
          </div>
          <div>
            <Label>Client Secret</Label>
            <Input dir="ltr" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Webhook Secret Token (اختياري — من Zoom App → Feature → Secret Token)</Label>
            <Input dir="ltr" type="password" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} placeholder="اتركه فارغ لو مش عاوز تغيره" />
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <Button onClick={save} disabled={busy} className="bg-gold text-gold-foreground hover:bg-gold/90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 ml-1" /> حفظ والتحقق</>}
            </Button>
            <Button variant="secondary" onClick={saveWebhookOnly} disabled={busy || !webhookSecret.trim()}>
              حفظ Webhook Secret فقط
            </Button>
            {status?.hasDbConfig && (
              <Button variant="outline" onClick={clearDb} disabled={busy}>مسح المخزّن</Button>
            )}
          </div>
          <p className="sm:col-span-2 text-xs text-muted-foreground">
            هيتم التحقق من البيانات مع Zoom قبل الحفظ. البيانات المحفوظة هنا بتتعدى على متغيرات النظام تلقائياً.
          </p>
        </div>
      )}
    </Card>
  );
}

function ZoomWebhookLogCard() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("zoom_webhook_events")
      .select("id, event, meeting_id, signature_valid, sync_ok, sync_reason, recording_url, error, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) toast.error(error.message);
    const list = data ?? [];
    if (primedRef.current) {
      for (const ev of list) {
        if (seenIdsRef.current.has(ev.id)) continue;
        if (ev.event === "recording.completed" && ev.sync_ok === true) {
          const url = ev.recording_url as string | null;
          toast.success("🎬 تم رفع تسجيل الميتنج بنجاح", {
            duration: 15000,
            description: ev.meeting_id ? `Meeting #${ev.meeting_id}` : undefined,
            action: url
              ? { label: "فتح التسجيل", onClick: () => window.open(url, "_blank", "noopener") }
              : undefined,
          });
        } else if (ev.event === "recording.completed" && ev.sync_ok === false) {
          toast.error("فشل حفظ التسجيل", { description: ev.sync_reason || ev.error || undefined });
        }
      }
    } else {
      primedRef.current = true;
    }
    for (const ev of list) seenIdsRef.current.add(ev.id);
    setEvents(list);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, []);

  return (
    <Card className="p-5 mb-6 border-primary/30">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Video className="h-4 w-4 text-primary" /> سجل Zoom Webhook
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            {open ? "إخفاء" : "عرض"}
          </Button>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      {open && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {events.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">
              لسه مفيش أي events وصلت من Zoom
            </div>
          )}
          {events.map((e) => (
            <div key={e.id} className="text-xs border rounded-md p-2 bg-background">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{e.event}</Badge>
                  {e.meeting_id && <code dir="ltr" className="text-muted-foreground">#{e.meeting_id}</code>}
                  {e.signature_valid === true && <Badge className="bg-green-600">Signature OK</Badge>}
                  {e.signature_valid === false && <Badge variant="destructive">Bad Signature</Badge>}
                  {e.sync_ok === true && <Badge className="bg-green-600">Synced ✅</Badge>}
                  {e.sync_ok === false && <Badge variant="destructive">Sync Failed</Badge>}
                </div>
                <span className="text-muted-foreground" dir="ltr">
                  {new Date(e.created_at).toLocaleString("ar-EG")}
                </span>
              </div>
              {e.sync_reason && <div className="text-muted-foreground mt-1">Reason: {e.sync_reason}</div>}
              {e.error && <div className="text-destructive mt-1">Error: {e.error}</div>}
              {e.recording_url && (
                <a href={e.recording_url} target="_blank" rel="noreferrer" className="text-primary underline mt-1 inline-block" dir="ltr">
                  {e.recording_url.slice(0, 80)}…
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function StudentPicker({ students, value, onChange }: {
  // moved below
  students: { id: string; name: string; email: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = students.filter((s) =>
    !q || s.name?.toLowerCase().includes(q.toLowerCase()) || s.email?.toLowerCase().includes(q.toLowerCase())
  );
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };
  return _StudentPickerBody({ students, value, onChange, q, setQ, filtered, toggle });
}

function MeetIntegrationCard() {
  const getStatus = useServerFn(getMeetConfigStatus);
  const saveFn = useServerFn(saveMeetWebhookSecret);
  const [status, setStatus] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/public/webhooks/google-meet`
    : "";

  const load = async () => {
    try { setStatus(await getStatus()); } catch (e: any) { console.warn(e); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!secret.trim()) { toast.error("ادخل Webhook Secret"); return; }
    setBusy(true);
    try {
      await saveFn({ data: { webhookSecret: secret.trim() } });
      toast.success("تم حفظ Meet Webhook Secret ✅");
      setSecret("");
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "فشل الحفظ");
    } finally { setBusy(false); }
  };

  return (
    <Card className="p-5 mb-6 border-gold/40">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Video className="h-4 w-4 text-gold" /> ربط Google Meet (رفع التسجيلات تلقائياً)
        </h2>
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? "إغلاق" : "تعديل"}
        </Button>
      </div>
      <div className="text-sm text-muted-foreground mt-2 space-y-1">
        {status ? (
          <>
            <div>
              الموصل (Google Calendar): {status.hasConnector
                ? <Badge className="bg-green-600">متصل</Badge>
                : <Badge variant="destructive">غير متصل</Badge>}
            </div>
            <div>
              Webhook Secret: {status.webhookSecretPreview
                ? <><code dir="ltr">{status.webhookSecretPreview}</code> <Badge variant="secondary" className="ml-1">{status.source === "database" ? "قاعدة البيانات" : status.source === "environment" ? "متغيرات النظام" : "غير مضبوط"}</Badge></>
                : <Badge variant="destructive">غير مضبوط</Badge>}
            </div>
          </>
        ) : "جاري التحميل..."}
      </div>
      {open && (
        <div className="mt-4 space-y-3">
          <div>
            <Label>Webhook URL (انسخه واستخدمه في Google Apps Script trigger)</Label>
            <Input dir="ltr" readOnly value={webhookUrl} onClick={(e) => (e.target as HTMLInputElement).select()} />
          </div>
          <div>
            <Label>Webhook Secret (اختر أي قيمة قوية — استخدم نفسها في الـ script)</Label>
            <Input dir="ltr" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="مثال: 32+ حرف عشوائي" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={busy} className="bg-gold text-gold-foreground hover:bg-gold/90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 ml-1" /> حفظ</>}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-md leading-relaxed">
            <div className="font-semibold mb-1">إزاي يشتغل؟</div>
            <ol className="list-decimal list-inside space-y-1">
              <li>Google Meet مبيبعتش Webhook مباشر لما التسجيل يخلص.</li>
              <li>افتح <code dir="ltr">script.google.com</code> → New Project، وحط سكربت بيعمل POST على الـ URL فوق مع الهيدر <code dir="ltr">x-webhook-secret</code> بقيمة الـ Secret اللي حطيتها، وفي الـ body <code dir="ltr">{`{ "eventId": "<calendar_event_id>" }`}</code>.</li>
              <li>خليه يشتغل كل 10-15 دقيقة (Time-driven trigger) على أحداث اليوم عشان يلحق الـ recording لما يظهر كـ attachment في الحدث.</li>
              <li>بمجرد ما التسجيل يتلاقى، هيتعمل درس تلقائي جوه الكورس ويتربط بالفيديو.</li>
            </ol>
          </div>
        </div>
      )}
    </Card>
  );
}

function _StudentPickerBody({ students, value, onChange, q, setQ, filtered, toggle }: {
  students: { id: string; name: string; email: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  q: string;
  setQ: (v: string) => void;
  filtered: { id: string; name: string; email: string }[];
  toggle: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label>الطلاب المسموح لهم (اتركها فارغة عشان كل المشتركين)</Label>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => onChange(students.map((s) => s.id))}>تحديد الكل</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onChange([])}>مسح</Button>
        </div>
      </div>
      <Input placeholder="ابحث بالاسم أو البريد..." value={q} onChange={(e) => setQ(e.target.value)} className="mb-2" />
      <div className="max-h-48 overflow-y-auto border rounded-md divide-y bg-background">
        {students.length === 0 && (
          <div className="p-3 text-sm text-muted-foreground text-center">لا يوجد طلاب مشتركين في الكورس</div>
        )}
        {filtered.map((s) => (
          <label key={s.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-secondary/40">
            <Checkbox checked={value.includes(s.id)} onCheckedChange={() => toggle(s.id)} />
            <span className="text-sm flex-1">{s.name}</span>
            <span className="text-xs text-muted-foreground" dir="ltr">{s.email}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {value.length === 0 ? "هتظهر لكل الطلاب المشتركين" : `هتظهر لـ ${value.length} طالب فقط`}
      </p>
    </div>
  );
}

function SessionRow({ session: s, students, modules, onChange, onDelete }: { session: LiveSession; students: { id: string; name: string; email: string }[]; modules: ModuleOption[]; onChange: () => void; onDelete: () => void }) {
  const [editingMeeting, setEditingMeeting] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState(s.meeting_url ?? "");
  const [recordingUrl, setRecordingUrl] = useState(s.recording_url ?? "");
  const [moduleId, setModuleId] = useState<string>(s.module_id ?? "");
  const [savingModule, setSavingModule] = useState(false);
  const [savingRec, setSavingRec] = useState(false);
  const [savingMeet, setSavingMeet] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [editingAccess, setEditingAccess] = useState(false);
  const [allowed, setAllowed] = useState<string[]>(s.allowed_user_ids ?? []);
  const [savingAccess, setSavingAccess] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [lastSyncFailed, setLastSyncFailed] = useState(false);
  const syncFn = useServerFn(syncSessionRecording);
  const progressFn = useServerFn(getRecordingProgress);
  const [live, setLive] = useState<{ phase: "idle" | "receiving" | "encoding" | "ready" | "error"; progress: number; reason?: string | null }>(
    { phase: s.recording_url ? "ready" : "idle", progress: s.recording_url ? 100 : 0 },
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const when = new Date(s.scheduled_at);
  const isPast = when.getTime() < Date.now();
  const canAutoSync = !!s.provider && (s.provider === "zoom" || s.provider === "meet") && (s.zoom_meeting_id || s.google_event_id);

  const checkLastSyncFailed = async () => {
    if (!s.zoom_meeting_id && !s.google_event_id) { setLastSyncFailed(false); return; }
    const { data } = await supabase
      .from("zoom_webhook_events")
      .select("sync_ok")
      .or(`meeting_id.eq.${s.zoom_meeting_id},session_id.eq.${s.id}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLastSyncFailed(data?.sync_ok === false);
  };

  useEffect(() => { checkLastSyncFailed(); }, [s.id, s.zoom_meeting_id]);

  // Poll live upload/encode status. Fast while uploading/encoding, slow while
  // waiting for the webhook, and stops once ready.
  useEffect(() => {
    // Poll if session has ended OR has a recording URL still being encoded.
    if (!isPast && !s.recording_url) return;
    let stopped = false;
    let timer: any = null;
    const tick = async () => {
      try {
        const r: any = await progressFn({ data: { sessionId: s.id } });
        if (stopped) return;
        setLive(r);
        if (r.phase === "ready") return; // done — stop polling
        const delay = r.phase === "encoding" || r.phase === "receiving" ? 4000 : 15000;
        timer = setTimeout(tick, delay);
      } catch {
        if (!stopped) timer = setTimeout(tick, 20000);
      }
    };
    tick();
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }, [s.id, s.recording_url, isPast]);

  // Fallback auto-sync from the admin page too, so a past session does not need
  // the manual "جلب التسجيل" click while the scheduled backend job is also running.
  useEffect(() => {
    if (!canAutoSync || !isPast || s.recording_url) return;
    let stopped = false;
    let timer: any = null;
    const run = async () => {
      if (stopped) return;
      setAutoSyncing(true);
      try {
        const r: any = await syncFn({ data: { sessionId: s.id } });
        if (stopped) return;
        if (r?.ok) {
          setLastSyncFailed(false);
          onChange();
          return;
        }
        setLastSyncFailed(r?.reason !== "recording_not_ready");
      } catch {
        if (!stopped) setLastSyncFailed(true);
      } finally {
        if (!stopped) setAutoSyncing(false);
      }
      if (!stopped) timer = setTimeout(run, 60_000);
    };
    const firstDelay = Math.max(0, new Date(s.scheduled_at).getTime() + ((s.duration_minutes ?? 60) + 5) * 60_000 - Date.now());
    timer = setTimeout(run, firstDelay);
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }, [canAutoSync, isPast, s.id, s.recording_url, s.scheduled_at, s.duration_minutes]);

  // When live state flips to ready, refresh parent so the row picks up the URL.
  useEffect(() => {
    if (live.phase === "ready" && !s.recording_url) onChange();
  }, [live.phase]);

  const syncRecording = async () => {
    setSyncing(true);
    try {
      const r: any = await syncFn({ data: { sessionId: s.id } });
      if (r?.ok) {
        toast.success("تم جلب رابط التسجيل ✅");
        setRecordingUrl(r.url);
        setLastSyncFailed(false);
        onChange();
      } else if (r?.reason === "recording_not_ready") {
        toast.message("التسجيل مش جاهز لسه — جرّب بعد شوية");
        setLastSyncFailed(true);
      } else {
        toast.error(r?.reason || "فشلت المزامنة");
        setLastSyncFailed(true);
      }
    } catch (e: any) {
      toast.error(e.message ?? "فشلت المزامنة");
      setLastSyncFailed(true);
    } finally { setSyncing(false); }
  };
  const niceDate = when.toLocaleString("ar-EG", { dateStyle: "full", timeStyle: "short" });

  const saveMeeting = async () => {
    if (meetingUrl && !/^https?:\/\//i.test(meetingUrl.trim())) { toast.error("رابط غير صحيح"); return; }
    setSavingMeet(true);
    const { error } = await supabase.from("live_sessions").update({ meeting_url: meetingUrl.trim() || null }).eq("id", s.id);
    setSavingMeet(false);
    if (error) toast.error(error.message); else { toast.success("تم الحفظ"); setEditingMeeting(false); onChange(); }
  };

  const clearMeetingLink = async () => {
    if (!confirm("هل أنت متأكد من إزالة رابط الميتنج الحي فقط؟\nسيتم الاحتفاظ بالتسجيل والجلسة في الكورس للطلاب دون أي حذف.")) return;
    setSavingMeet(true);
    const { error } = await supabase.from("live_sessions").update({ meeting_url: null }).eq("id", s.id);
    setSavingMeet(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("تمت إزالة رابط الميتنج بنجاح مع الاحتفاظ بالتسجيل");
      setMeetingUrl("");
      setEditingMeeting(false);
      onChange();
    }
  };

  const saveRecording = async () => {
    if (recordingUrl && !/^https?:\/\//i.test(recordingUrl.trim())) { toast.error("رابط غير صحيح"); return; }
    setSavingRec(true);
    const { error } = await supabase.from("live_sessions").update({ recording_url: recordingUrl.trim() || null, status: "completed" }).eq("id", s.id);
    setSavingRec(false);
    if (error) toast.error(error.message); else { toast.success("تم حفظ التسجيل"); onChange(); }
  };

  const uploadRecording = async (file: File) => {
    if (file.size > 1024 * 1024 * 1024) { toast.error("حجم الملف يتجاوز 1 جيجا"); return; }
    setUploading(true); setProgress(0);
    try {
      const ext = file.name.split(".").pop();
      const path = `recordings/${s.course_id}/${s.id}-${Date.now()}.${ext}`;
      const t = setInterval(() => setProgress((p) => Math.min(p + 5, 90)), 500);
      const { error: upErr } = await supabase.storage.from("course-videos").upload(path, file, { contentType: file.type, upsert: true });
      clearInterval(t);
      if (upErr) throw upErr;
      setProgress(100);
      const { error: dbErr } = await supabase.from("live_sessions").update({ recording_url: path, status: "completed" }).eq("id", s.id);
      if (dbErr) throw dbErr;
      toast.success("تم رفع التسجيل");
      setRecordingUrl(path);
      onChange();
    } catch (e: any) {
      toast.error(e.message ?? "فشل الرفع");
    } finally {
      setUploading(false); setProgress(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const saveAccess = async () => {
    setSavingAccess(true);
    const { error } = await supabase.from("live_sessions").update({ allowed_user_ids: allowed }).eq("id", s.id);
    setSavingAccess(false);
    if (error) toast.error(error.message);
    else { toast.success("تم تحديث الصلاحيات"); setEditingAccess(false); onChange(); }
  };

  const saveModule = async (newId: string) => {
    setModuleId(newId);
    setSavingModule(true);
    const { error } = await supabase.from("live_sessions").update({ module_id: newId || null }).eq("id", s.id);
    setSavingModule(false);
    if (error) toast.error(error.message); else { toast.success("تم ربط الموديول"); onChange(); }
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-bold">{s.title}</h3>
            {/* Status badge — priority: encoding/receiving/error > ready > basic */}
            {live.phase === "receiving" ? (
              <Badge className="bg-amber-500 text-white animate-pulse">📥 وصل التسجيل — جاري التحميل…</Badge>
            ) : live.phase === "encoding" ? (
              <Badge className="bg-amber-500 text-white animate-pulse">⏫ جاري الرفع {live.progress}%</Badge>
            ) : live.phase === "error" ? (
              <Badge variant="destructive">🔴 فشل الرفع</Badge>
            ) : s.recording_url ? (
              <Badge className="bg-emerald-600 text-white">🟢 جاهز للمشاهدة</Badge>
            ) : isPast ? (
              <Badge variant="secondary">منتهية — في انتظار التسجيل</Badge>
            ) : (
              <Badge className="bg-gold text-gold-foreground">قادمة</Badge>
            )}
            <Link
              to="/admin/session/$sessionId"
              params={{ sessionId: s.id }}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              📋 سجل الخطوات
            </Link>
            <Link
              to="/admin/attendance/$courseId"
              params={{ courseId: s.course_id }}
              className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold"
            >
              <Users className="h-3 w-3" /> كشف الحضور
            </Link>
          </div>

          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {niceDate} • {s.duration_minutes ?? 60} دقيقة
          </div>
          {s.description && <p className="text-sm mt-2 whitespace-pre-line">{s.description}</p>}
        </div>
        <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </div>

      <div className="mt-3 pt-3 border-t space-y-3">
        {/* Meeting link */}
        <div className="flex items-center gap-2 flex-wrap">
          <Video className="h-4 w-4 text-gold shrink-0" />
          <span className="text-sm font-semibold shrink-0">رابط الميتنج:</span>
          {editingMeeting ? (
            <>
              <Input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} className="h-8 flex-1 min-w-[200px]" dir="ltr" placeholder="https://meet.google.com/..." />
              <Button size="sm" onClick={saveMeeting} disabled={savingMeet}>{savingMeet ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}</Button>
              {s.meeting_url && (
                <Button size="sm" variant="destructive" onClick={clearMeetingLink} disabled={savingMeet}>مسح الرابط</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setEditingMeeting(false)}>إلغاء</Button>
            </>
          ) : s.meeting_url ? (
            <>
              <a href={s.meeting_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate flex-1" dir="ltr">{s.meeting_url}</a>
              <Button size="sm" variant="outline" onClick={() => setEditingMeeting(true)}>تعديل</Button>
              <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10 border-destructive/30" onClick={clearMeetingLink} disabled={savingMeet} title="إزالة رابط الميتنج فقط مع الاحتفاظ بالتسجيل">
                إزالة رابط الميتنج فقط
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditingMeeting(true)}>إضافة رابط</Button>
          )}
        </div>

        {/* Access control */}
        <div className="bg-secondary/30 rounded p-3 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm font-semibold">
              الوصول:{" "}
              {(s.allowed_user_ids ?? []).length === 0
                ? <Badge variant="secondary">كل المشتركين</Badge>
                : <Badge className="bg-gold text-gold-foreground">{(s.allowed_user_ids ?? []).length} طالب محدد</Badge>}
            </div>
            <Button size="sm" variant="outline" onClick={() => { setAllowed(s.allowed_user_ids ?? []); setEditingAccess((v) => !v); }}>
              {editingAccess ? "إلغاء" : "تعديل الوصول"}
            </Button>
          </div>
          {editingAccess && (
            <div className="space-y-2">
              <StudentPicker students={students} value={allowed} onChange={setAllowed} />
              <Button size="sm" onClick={saveAccess} disabled={savingAccess} className="bg-gold text-gold-foreground hover:bg-gold/90">
                {savingAccess ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5 ml-1" /> حفظ</>}
              </Button>
            </div>
          )}
        </div>

        {/* Recording */}
        <div className="bg-secondary/30 rounded p-3 space-y-2">
          {(live.phase === "receiving" || live.phase === "encoding") && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-700">
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {live.phase === "receiving"
                    ? "استلمنا إشعار الجلسة، جاري رفع التسجيل على السيرفر…"
                    : `جاري رفع/معالجة الفيديو على Bunny — ${live.progress}%`}
                </span>
                <span>{live.progress}%</span>
              </div>
              <div className="h-1.5 bg-amber-200/60 rounded overflow-hidden">
                <div className="h-full bg-amber-500 transition-all" style={{ width: `${Math.max(live.progress, live.phase === "receiving" ? 8 : 0)}%` }} />
              </div>
            </div>
          )}
          {live.phase === "error" && live.reason && (
            <div className="text-xs rounded-md border border-destructive/40 bg-destructive/10 p-2 text-destructive">
              فشل الرفع: {live.reason}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-border/50">
            <span className="text-sm font-semibold shrink-0">الموديول:</span>
            <select
              value={moduleId}
              onChange={(e) => saveModule(e.target.value)}
              disabled={savingModule}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm flex-1 min-w-[200px]"
            >
              <option value="">تسجيلات الجلسات المباشرة (افتراضي)</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>{m.title}</option>
              ))}
            </select>
            {savingModule && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm font-semibold flex items-center gap-1"><FileVideo className="h-4 w-4 text-gold" /> تسجيل الجلسة (بعد الانتهاء)</div>
            {canAutoSync && isPast && !s.recording_url && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={syncRecording} disabled={syncing || autoSyncing}>
                  {syncing || autoSyncing ? <><Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> جاري الفحص التلقائي...</> : <>🔄 فحص الآن من {s.provider === "zoom" ? "Zoom" : "Google Meet"}</>}
                </Button>
                {lastSyncFailed && (
                  <Button size="sm" variant="outline" onClick={syncRecording} disabled={syncing} className="border-destructive text-destructive hover:bg-destructive/10">
                    <RotateCcw className="h-3.5 w-3.5 ml-1" /> إعادة المحاولة
                  </Button>
                )}
              </div>
            )}
            {s.recording_synced_at && (
              <span className="text-xs text-muted-foreground">آخر مزامنة: {new Date(s.recording_synced_at).toLocaleString("ar-EG")}</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Input value={recordingUrl} onChange={(e) => setRecordingUrl(e.target.value)} className="h-8 flex-1 min-w-[200px]" dir="ltr" placeholder="رابط YouTube / Drive للتسجيل" />
            <Button size="sm" onClick={saveRecording} disabled={savingRec}>{savingRec ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5 ml-1" /> حفظ</>}</Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input ref={fileRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadRecording(f); }} />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <><Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> جاري الرفع... {progress}%</> : <><Upload className="h-3.5 w-3.5 ml-1" /> أو رفع ملف فيديو</>}
            </Button>
            {s.recording_url && !uploading && (
              <a href={s.recording_url.startsWith("http") ? s.recording_url : supabase.storage.from("course-videos").getPublicUrl(s.recording_url).data.publicUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                <ExternalLink className="h-3 w-3" /> فتح التسجيل
              </a>
            )}
            {uploading && (
              <div className="flex-1 h-1.5 bg-secondary rounded overflow-hidden">
                <div className="h-full bg-gold transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}