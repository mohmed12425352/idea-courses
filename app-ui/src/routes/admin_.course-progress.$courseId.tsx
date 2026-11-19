import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/layout/SiteShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Eye, Clock, RotateCcw, Search, PlusCircle, RefreshCw, Lock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin_/course-progress/$courseId")({
  ssr: false,
  beforeLoad: async ({ params }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login", search: { redirect: `/admin/course-progress/${params.courseId}` } });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" });
    if (!isAdmin) throw redirect({ to: "/" });
  },
  component: AdminCourseProgress,
});

type Row = {
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  lesson_id: string;
  lesson_title: string | null;
  module_title: string | null;
  last_position_seconds: number;
  duration_seconds: number | null;
  watched_seconds: number;
  completion_count: number;
  last_watched_at: string;
};

function fmt(sec: number) {
  if (!sec || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function AdminCourseProgress() {
  const { courseId } = Route.useParams();
  const [course, setCourse] = useState<any>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [c, r] = await Promise.all([
      supabase.from("courses").select("id, title, slug, certificate_config").eq("id", courseId).maybeSingle(),
      supabase.rpc("admin_course_lesson_progress", { _course_id: courseId }),
    ]);
    setCourse(c.data);
    setRows((r.data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [courseId]);

  const maxViews = useMemo(() => {
    if (!course?.certificate_config) return 4;
    const cfg = course.certificate_config as Record<string, any>;
    if (cfg.max_video_views !== undefined && cfg.max_video_views !== null) {
      const parsed = Number(cfg.max_video_views);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 4;
    }
    return 4;
  }, [course]);

  const resetLessonViews = async (userId: string, lessonId: string, lessonTitle?: string | null) => {
    setActionLoading(`${userId}:${lessonId}`);
    const { error } = await supabase
      .from("lesson_progress")
      .update({ completion_count: 0 })
      .eq("user_id", userId)
      .eq("lesson_id", lessonId);
    setActionLoading(null);
    if (error) toast.error("فشل إعادة التعيين: " + error.message);
    else {
      toast.success(`تمت إعادة تعيين مشاهدات درس "${lessonTitle || "الدرس"}" بنجاح`);
      load();
    }
  };

  const grantExtraView = async (userId: string, lessonId: string, currentCount: number) => {
    setActionLoading(`${userId}:${lessonId}`);
    const newCount = Math.max(0, currentCount - 1);
    const { error } = await supabase
      .from("lesson_progress")
      .update({ completion_count: newCount })
      .eq("user_id", userId)
      .eq("lesson_id", lessonId);
    setActionLoading(null);
    if (error) toast.error("فشل منح المشاهدة: " + error.message);
    else {
      toast.success("تم منح مشاهدة إضافية للطالب");
      load();
    }
  };

  const resetAllUserLessons = async (userId: string, userName: string) => {
    if (!confirm(`هل أنت متأكد من تصفير مشاهدات كل دروس الكورس للطالب "${userName}"؟`)) return;
    setActionLoading(userId);
    const userLessons = rows.filter((r) => r.user_id === userId).map((r) => r.lesson_id);
    if (userLessons.length === 0) {
      setActionLoading(null);
      return;
    }
    const { error } = await supabase
      .from("lesson_progress")
      .update({ completion_count: 0 })
      .eq("user_id", userId)
      .in("lesson_id", userLessons);
    setActionLoading(null);
    if (error) toast.error("فشل التصفير: " + error.message);
    else {
      toast.success(`تم تصفير جميع المشاهدات للطالب ${userName}`);
      load();
    }
  };

  // Group rows by user
  const byUser = useMemo(() => {
    const m = new Map<string, { user_id: string; name: string; email: string; lessons: Row[]; totalWatched: number; totalCompletions: number; lastSeen: string }>();
    for (const r of rows) {
      const k = r.user_id;
      const cur = m.get(k);
      if (cur) {
        cur.lessons.push(r);
        cur.totalWatched += Number(r.watched_seconds || 0);
        cur.totalCompletions += r.completion_count || 0;
        if (r.last_watched_at > cur.lastSeen) cur.lastSeen = r.last_watched_at;
      } else {
        m.set(k, {
          user_id: r.user_id,
          name: r.user_name ?? "—",
          email: r.user_email ?? "—",
          lessons: [r],
          totalWatched: Number(r.watched_seconds || 0),
          totalCompletions: r.completion_count || 0,
          lastSeen: r.last_watched_at,
        });
      }
    }
    let arr = Array.from(m.values()).sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      arr = arr.filter((u) => u.name.toLowerCase().includes(t) || u.email.toLowerCase().includes(t));
    }
    return arr;
  }, [rows, q]);

  return (
    <SiteShell>
      <div className="container-page py-8">
        <Link to="/admin/courses/$courseId" params={{ courseId }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowRight className="h-4 w-4" /> العودة لإدارة الكورس
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-primary">تقدم مشاهدة الطلاب والتحكم بالمشاهدات</h1>
            <p className="text-muted-foreground mt-1">{course?.title ?? "..."}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs px-3 py-1.5 gap-1.5 bg-secondary/50">
              <Eye className="h-3.5 w-3.5 text-gold" />
              الحد الأقصى للمشاهدة: {maxViews > 0 ? `${maxViews} مشاهدات` : "غير محدود"}
            </Badge>
            <Button size="sm" variant="outline" onClick={load} className="gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> تحديث
            </Button>
          </div>
        </div>

        <Card className="p-3 mb-4 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث باسم الطالب أو الإيميل..." className="h-9" />
          <Badge variant="outline">{byUser.length} طالب</Badge>
        </Card>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جاري التحميل…</div>
        ) : byUser.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">لا يوجد سجل مشاهدة بعد لهذا الكورس.</Card>
        ) : (
          <div className="space-y-4">
            {byUser.map((u) => (
              <Card key={u.user_id} className="overflow-hidden border shadow-sm">
                <div className="px-4 py-3 bg-secondary/40 border-b flex flex-wrap items-center justify-between gap-3">
                  <div className="flex-1 min-w-[180px]">
                    <div className="font-bold text-base text-foreground">{u.name}</div>
                    <div className="text-xs text-muted-foreground" dir="ltr">{u.email}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> إجمالي المشاهدة: {fmt(u.totalWatched)}</Badge>
                    <Badge variant="outline" className="gap-1"><RotateCcw className="h-3 w-3" /> إكمالات: {u.totalCompletions}</Badge>
                    <Badge variant="outline" className="gap-1"><Eye className="h-3 w-3" /> دروس مفتوحة: {u.lessons.length}</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionLoading === u.user_id}
                      onClick={() => resetAllUserLessons(u.user_id, u.name)}
                      className="h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      <RotateCcw className="h-3 w-3 ml-1" /> تصفير كل الدروس للطالب
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/20 text-xs">
                      <tr>
                        <th className="text-right px-3 py-2.5">الفصل</th>
                        <th className="text-right px-3 py-2.5">الدرس</th>
                        <th className="text-right px-3 py-2.5">آخر موضع</th>
                        <th className="text-right px-3 py-2.5">مدة الفيديو</th>
                        <th className="text-right px-3 py-2.5">إجمالي المشاهدة</th>
                        <th className="text-right px-3 py-2.5">المشاهدات / الحد المسموح</th>
                        <th className="text-right px-3 py-2.5">حالة الدرس</th>
                        <th className="text-right px-3 py-2.5">آخر مرة</th>
                        <th className="text-center px-3 py-2.5">إجراءات المشاهدة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {u.lessons
                        .sort((a, b) => (a.last_watched_at < b.last_watched_at ? 1 : -1))
                        .map((l) => {
                          const pct = l.duration_seconds && l.duration_seconds > 0 ? Math.min(100, Math.round((l.last_position_seconds / l.duration_seconds) * 100)) : 0;
                          const count = l.completion_count || 0;
                          const isExhausted = maxViews > 0 && count >= maxViews;
                          const remaining = maxViews > 0 ? Math.max(0, maxViews - count) : null;
                          const isOperating = actionLoading === `${u.user_id}:${l.lesson_id}`;

                          return (
                            <tr key={l.lesson_id} className={`hover:bg-muted/30 transition-colors ${isExhausted ? "bg-red-500/5" : ""}`}>
                              <td className="px-3 py-2.5 text-muted-foreground text-xs">{l.module_title ?? "—"}</td>
                              <td className="px-3 py-2.5 font-medium">{l.lesson_title ?? "—"}</td>
                              <td className="px-3 py-2.5">
                                {fmt(Number(l.last_position_seconds))}
                                {l.duration_seconds ? <span className="text-xs text-muted-foreground"> ({pct}%)</span> : null}
                              </td>
                              <td className="px-3 py-2.5">{l.duration_seconds ? fmt(Number(l.duration_seconds)) : "—"}</td>
                              <td className="px-3 py-2.5 font-mono text-xs">{fmt(Number(l.watched_seconds))}</td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-1.5 font-bold">
                                  <span className={isExhausted ? "text-destructive font-black" : "text-primary"}>
                                    {count}
                                  </span>
                                  <span className="text-muted-foreground text-xs">/ {maxViews > 0 ? maxViews : "∞"}</span>
                                  {remaining !== null && (
                                    <span className="text-[10px] text-muted-foreground font-normal">
                                      ({remaining} متبقية)
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                {isExhausted ? (
                                  <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-xs gap-1">
                                    <Lock className="h-3 w-3" /> استنفد المشاهدات
                                  </Badge>
                                ) : count > 0 ? (
                                  <Badge className="bg-success/20 text-success border-success/30 text-xs gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> مكتمل
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">جاري المتابعة</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-muted-foreground">{new Date(l.last_watched_at).toLocaleString("ar-EG")}</td>
                              <td className="px-3 py-2.5 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isOperating || count === 0}
                                    onClick={() => resetLessonViews(u.user_id, l.lesson_id, l.lesson_title)}
                                    className="h-7 text-xs px-2 gap-1 text-gold hover:bg-gold/10 border-gold/30"
                                    title="تصفير المشاهدات للصفر"
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                    تصفير
                                  </Button>
                                  {isExhausted && (
                                    <Button
                                      size="sm"
                                      variant="default"
                                      disabled={isOperating}
                                      onClick={() => grantExtraView(u.user_id, l.lesson_id, count)}
                                      className="h-7 text-xs px-2 gap-1 bg-green-600 hover:bg-green-500 text-white"
                                      title="إعطاء مشاهدة إضافية"
                                    >
                                      <PlusCircle className="h-3 w-3" />
                                      +1 مشاهدة
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  );
}