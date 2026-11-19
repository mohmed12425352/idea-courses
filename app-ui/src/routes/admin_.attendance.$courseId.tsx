import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/layout/SiteShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Loader2, RefreshCw, Mail, Save, ShieldOff, ShieldCheck, Upload } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getAttendanceSettings,
  saveAttendanceSettings,
  getSessionAttendance,
  getCourseAttendanceSummary,
  syncSessionAttendance,
  importMeetAttendanceCsv,
  setAttendanceStatus,
  sendAttendanceNotices,
  setCertificateBlock,
} from "@/lib/attendance.functions";

export const Route = createFileRoute("/admin_/attendance/$courseId")({
  ssr: false,
  beforeLoad: async ({ params }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login", search: { redirect: `/admin/attendance/${params.courseId}` } });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" });
    if (!isAdmin) throw redirect({ to: "/" });
  },
  component: AttendancePage,
});

type SessionRow = { id: string; title: string; scheduled_at: string; provider: string | null; zoom_meeting_id: string | null };
type StudentRow = {
  userId: string; name: string | null; email: string | null;
  status: string; joinedAt: string | null; minutes: number; source: string | null; notifiedAt: string | null;
};
type SummaryRow = {
  userId: string; name: string | null; email: string | null;
  total: number; attended: number; rate: number; blocked: boolean; blockReason: string | null; eligible: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  present: "حاضر", late: "متأخر", absent: "غائب", excused: "بعذر",
};
const STATUS_CLASS: Record<string, string> = {
  present: "bg-emerald-500/15 text-emerald-600 border-emerald-500/40",
  late: "bg-amber-500/15 text-amber-600 border-amber-500/40",
  absent: "bg-destructive/10 text-destructive border-destructive/40",
  excused: "bg-primary/10 text-primary border-primary/40",
};

const SOURCE_INFO: Record<string, { label: string; cls: string }> = {
  direct_join: { label: "دخول مباشر من المنصة 🚀", cls: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  zoom: { label: "زووم API 📹", cls: "bg-indigo-500/10 text-indigo-500 border-indigo-500/30" },
  meet: { label: "تقرير جوجل ميت 📄", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  recording: { label: "مشاهدة التسجيل 🎥", cls: "bg-purple-500/10 text-purple-600 border-purple-500/30" },
  manual: { label: "تعديل يدوي ✏️", cls: "bg-slate-500/10 text-slate-500 border-slate-500/30" },
};


function AttendancePage() {
  const { courseId } = Route.useParams();
  const loadSettings = useServerFn(getAttendanceSettings);
  const persistSettings = useServerFn(saveAttendanceSettings);
  const loadSession = useServerFn(getSessionAttendance);
  const loadSummary = useServerFn(getCourseAttendanceSummary);
  const syncFn = useServerFn(syncSessionAttendance);
  const importCsvFn = useServerFn(importMeetAttendanceCsv);
  const setStatusFn = useServerFn(setAttendanceStatus);
  const notifyFn = useServerFn(sendAttendanceNotices);
  const blockFn = useServerFn(setCertificateBlock);

  const [courseTitle, setCourseTitle] = useState("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [summarySearchQuery, setSummarySearchQuery] = useState("");
  const [lateAfter, setLateAfter] = useState(10);
  const [requiredPercent, setRequiredPercent] = useState(0);
  const [minMinutes, setMinMinutes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: course } = await supabase.from("courses").select("title").eq("id", courseId).maybeSingle();
      setCourseTitle(course?.title ?? "");
      const { data: list } = await supabase
        .from("live_sessions")
        .select("id, title, scheduled_at, provider, zoom_meeting_id")
        .eq("course_id", courseId)
        .order("scheduled_at", { ascending: false });
      const rows = (list ?? []) as SessionRow[];
      setSessions(rows);
      if (rows.length > 0) setSessionId(rows[0].id);
      try {
        const s: any = await loadSettings();
        setLateAfter(s.late_after_minutes); setRequiredPercent(s.required_percent); setMinMinutes(s.min_minutes);
      } catch {}
      setLoading(false);
    })();
  }, [courseId]);

  const refreshSession = async (id = sessionId) => {
    if (!id) return;
    try {
      const r: any = await loadSession({ data: { sessionId: id } });
      setStudents(r.students);
      setSelected(new Set());
    } catch (e: any) { toast.error(e.message ?? "فشل التحميل"); }
  };

  const refreshSummary = async () => {
    try {
      const r: any = await loadSummary({ data: { courseId } });
      setSummary(r.students);
    } catch (e: any) { toast.error(e.message ?? "فشل تحميل الملخص"); }
  };

  useEffect(() => { if (sessionId) refreshSession(sessionId); }, [sessionId]);
  useEffect(() => { refreshSummary(); }, [courseId]);

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0, excused: 0 } as Record<string, number>;
    students.forEach((s) => { c[s.status] = (c[s.status] ?? 0) + 1; });
    return c;
  }, [students]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.status && s.status.toLowerCase().includes(q))
    );
  }, [students, searchQuery]);

  const filteredSummary = useMemo(() => {
    const q = summarySearchQuery.trim().toLowerCase();
    if (!q) return summary;
    return summary.filter((s) =>
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q))
    );
  }, [summary, summarySearchQuery]);

  const doSync = async () => {
    setBusy("sync");
    try {
      const r: any = await syncFn({ data: { sessionId } });
      toast.success(`تمت المزامنة من ${r.source === "zoom" ? "Zoom" : "Google Meet"} — ${r.matched} طالب`);
      if (r.unmatched?.length) toast.message(`حضور غير مطابق: ${r.unmatched.join("، ")}`);
      await refreshSession();
      await refreshSummary();
    } catch (e: any) {
      toast.error(e.message ?? "فشلت المزامنة", {
        description: "ملاحظة: إذا كنت تستخدم Google Meet عادي بدون حساب Workspace مؤسسي، يمكنك ببساطة رفع ملف الـ CSV المرسل لإيميلك عبر زر «رفع تقرير حضور Meet».",
        duration: 8000,
      });
    }
    finally { setBusy(null); }
  };


  const onCsvPicked = async (file: File | null) => {
    if (!file || !sessionId) return;
    setBusy("csv");
    try {
      const csv = await file.text();
      const r: any = await importCsvFn({ data: { sessionId, csv } });
      toast.success(`تم استيراد الحضور — ${r.matched} طالب`);
      if (r.unmatched?.length) toast.message(`أسماء غير مطابقة: ${r.unmatched.join("، ")}`);
      await refreshSession();
      await refreshSummary();
    } catch (e: any) { toast.error(e.message ?? "فشل استيراد الملف"); }
    finally { setBusy(null); }
  };

  const changeStatus = async (userId: string, status: string) => {
    setStudents((prev) => prev.map((s) => (s.userId === userId ? { ...s, status, source: "manual" } : s)));
    try {
      await setStatusFn({ data: { sessionId, userId, status } });
      refreshSummary();
    } catch (e: any) { toast.error(e.message ?? "فشل الحفظ"); refreshSession(); }
  };

  const sendNotices = async () => {
    setBusy("notify");
    try {
      const ids = selected.size > 0 ? [...selected] : undefined;
      const r: any = await notifyFn({ data: { sessionId, userIds: ids, note: note || undefined } });
      toast.success(`تم إرسال ${r.sent} إيميل و ${r.total} إشعار`);
      await refreshSession();
    } catch (e: any) { toast.error(e.message ?? "فشل الإرسال"); }
    finally { setBusy(null); }
  };

  const toggleBlock = async (row: SummaryRow) => {
    try {
      await blockFn({ data: { userId: row.userId, courseId, blocked: !row.blocked, reason: row.blocked ? undefined : "قرار الأدمن" } });
      toast.success(row.blocked ? "تم السماح باستلام الشهادة" : "تم منع استلام الشهادة");
      refreshSummary();
    } catch (e: any) { toast.error(e.message ?? "فشل التحديث"); }
  };

  const saveSettings = async () => {
    setBusy("settings");
    try {
      await persistSettings({ data: { late_after_minutes: lateAfter, required_percent: requiredPercent, min_minutes: minMinutes } });
      toast.success("تم حفظ الإعدادات");
      refreshSummary();
    } catch (e: any) { toast.error(e.message ?? "فشل الحفظ"); }
    finally { setBusy(null); }
  };

  if (loading) {
    return <SiteShell><div className="container-page py-20 text-center text-muted-foreground">جاري التحميل…</div></SiteShell>;
  }

  return (
    <SiteShell>
      <div className="container-page py-8 max-w-5xl">
        <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowRight className="h-4 w-4" /> العودة للوحة التحكم
        </Link>

        <h1 className="text-2xl md:text-3xl font-extrabold text-primary mb-1">حضور الطلاب</h1>
        <p className="text-sm text-muted-foreground mb-6">{courseTitle}</p>

        {/* Settings */}
        <Card className="p-4 mb-6">
          <h2 className="font-bold mb-3">إعدادات الحضور</h2>
          <div className="grid gap-3 md:grid-cols-4 items-end">
            <div>
              <Label className="text-xs">يعتبر متأخر بعد (دقيقة)</Label>
              <Input type="number" min={0} value={lateAfter} onChange={(e) => setLateAfter(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">أقل مدة تواجد محتسبة (دقيقة)</Label>
              <Input type="number" min={0} value={minMinutes} onChange={(e) => setMinMinutes(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">نسبة الحضور المطلوبة للشهادة (%)</Label>
              <Input type="number" min={0} max={100} value={requiredPercent} onChange={(e) => setRequiredPercent(Number(e.target.value))} />
            </div>
            <Button onClick={saveSettings} disabled={busy === "settings"} className="gap-2">
              {busy === "settings" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            الطالب اللي غاب السيشن لايف بس شاهد التسجيل كامل على المنصة بيتحسب حاضر في النسبة.
          </p>
        </Card>

        {/* Session attendance */}
        <Card className="p-4 mb-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h2 className="font-bold">حضور السيشن</h2>
            <div className="flex gap-2 flex-wrap">
              <Select value={sessionId} onValueChange={setSessionId}>
                <SelectTrigger className="w-[260px]"><SelectValue placeholder="اختر سيشن" /></SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title} — {new Date(s.scheduled_at).toLocaleDateString("ar-EG")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => refreshSession()}><RefreshCw className="h-4 w-4" /></Button>
              <Button size="sm" onClick={doSync} disabled={!sessionId || busy === "sync"} className="gap-2">
                {busy === "sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} سحب الحضور تلقائياً
              </Button>
              <label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  disabled={!sessionId || busy === "csv"}
                  onChange={(e) => { onCsvPicked(e.target.files?.[0] ?? null); e.currentTarget.value = ""; }}
                />
                <span className="inline-flex items-center gap-2 h-9 px-3 rounded-md border text-sm font-medium cursor-pointer hover:bg-accent">
                  {busy === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  رفع تقرير حضور Meet (CSV)
                </span>
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              جوجل ميت بيبعت للمضيف ملف «تقرير الحضور» بالإيميل بعد انتهاء السيشن — ارفعه هنا وهيتسجل الحضور والتأخير تلقائياً.
            </p>
          </div>

          <div className="flex gap-2 flex-wrap mb-3 text-xs">
            <Badge variant="outline" className={STATUS_CLASS.present}>حاضر {counts.present ?? 0}</Badge>
            <Badge variant="outline" className={STATUS_CLASS.late}>متأخر {counts.late ?? 0}</Badge>
            <Badge variant="outline" className={STATUS_CLASS.absent}>غائب {counts.absent ?? 0}</Badge>
            <Badge variant="outline" className={STATUS_CLASS.excused}>بعذر {counts.excused ?? 0}</Badge>
          </div>

          <div className="mb-3">
            <Input
              placeholder="بحث بالاسم أو البريد..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="border rounded-xl divide-y">
            {filteredStudents.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">لا يوجد طلاب مطابقين</div>}
            {filteredStudents.map((s) => (
              <div key={s.userId} className="p-3 flex items-center gap-3 flex-wrap hover:bg-muted/30 transition-colors">
                <Checkbox
                  checked={selected.has(s.userId)}
                  onCheckedChange={(v) => {
                    setSelected((prev) => {
                      const n = new Set(prev);
                      if (v) n.add(s.userId); else n.delete(s.userId);
                      return n;
                    });
                  }}
                />
                <div className="flex-1 min-w-[180px]">
                  <div className="font-semibold text-sm">{s.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground" dir="ltr">{s.email}</div>
                </div>

                {s.source && SOURCE_INFO[s.source] && (
                  <Badge variant="outline" className={`text-[10px] ${SOURCE_INFO[s.source].cls}`}>
                    {SOURCE_INFO[s.source].label}
                  </Badge>
                )}

                <div className="text-xs text-muted-foreground">
                  {s.joinedAt ? new Date(s.joinedAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : "—"}
                  {s.minutes > 0 && ` • ${s.minutes} د`}
                </div>
                {s.notifiedAt && <Badge variant="secondary" className="text-[10px]">تم الإشعار</Badge>}
                <Select value={s.status} onValueChange={(v) => changeStatus(s.userId, v)}>
                  <SelectTrigger className={`w-[130px] h-9 text-xs border ${STATUS_CLASS[s.status] ?? ""}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            <Label className="text-xs">ملاحظة تُرسل مع الإشعار (اختياري)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="مثال: برجاء الالتزام بمواعيد السيشنز." />
            <Button onClick={sendNotices} disabled={!sessionId || busy === "notify"} className="gap-2 bg-gold text-gold-foreground hover:bg-gold/90">
              {busy === "notify" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {selected.size > 0 ? `إرسال للمحددين (${selected.size})` : "إرسال للجميع"}
            </Button>
          </div>
        </Card>

        {/* Course summary + certificate control */}
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h2 className="font-bold">ملخص الحضور والشهادات</h2>
            <div className="flex items-center gap-2">
              <Input
                placeholder="بحث في الطلاب..."
                value={summarySearchQuery}
                onChange={(e) => setSummarySearchQuery(e.target.value)}
                className="h-8 text-xs w-[180px]"
              />
              <Button variant="outline" size="sm" onClick={refreshSummary}><RefreshCw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="border rounded-xl divide-y">
            {filteredSummary.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">لا يوجد طلاب</div>}
            {filteredSummary.map((r) => (
              <div key={r.userId} className="p-3 flex items-center gap-3 flex-wrap hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-[180px]">
                  <div className="font-semibold text-sm">{r.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground" dir="ltr">{r.email}</div>
                </div>
                <Badge variant="outline" className={r.rate >= requiredPercent ? STATUS_CLASS.present : STATUS_CLASS.absent}>
                  {r.rate}% ({r.attended}/{r.total})
                </Badge>
                <Badge variant={r.blocked ? "destructive" : r.eligible ? "secondary" : "outline"} className="text-[11px]">
                  {r.blocked ? "الشهادة ممنوعة" : r.eligible ? "مؤهل للشهادة" : "غير مؤهل"}
                </Badge>
                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => toggleBlock(r)}>
                  {r.blocked ? <><ShieldCheck className="h-4 w-4" /> السماح</> : <><ShieldOff className="h-4 w-4" /> منع الشهادة</>}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </SiteShell>
  );
}

