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
import { Switch } from "@/components/ui/switch";
import { ArrowRight, ChevronDown, ChevronUp, Film, Plus, Trash2, Upload, Video, Loader2, ExternalLink, Link as LinkIcon, Save, FileText, BookOpen, FileUp, Calendar, Eye, GripVertical, Shield, Lock, Download, Users, Copy, ArrowUpDown, ListOrdered } from "lucide-react";

import { parseResourceMetadata, serializeResourceMetadata } from "@/lib/resources";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { StudentWorksManager } from "@/components/admin/StudentWorksManager";
import { CourseTasksManager } from "@/components/admin/CourseTasksManager";
import { invalidateCache } from "@/lib/cache";
import { useServerFn } from "@tanstack/react-start";
import { createBunnyTusUpload, syncLessonDuration, syncAllLessonDurations, deleteBunnyVideo } from "@/lib/bunny.functions";
import { translateFields } from "@/lib/translate.functions";
import * as tus from "tus-js-client";

export const Route = createFileRoute("/admin_/courses/$courseId")({
  beforeLoad: async ({ params }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({
        to: "/login",
        search: { redirect: `/admin/courses/${params.courseId}` },
      });
    }
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" });
    if (!isAdmin) throw redirect({ to: "/" });
  },
  component: AdminCourseContent,
});

type Lesson = { id: string; module_id: string; title: string; title_en: string | null; video_url: string | null; duration: string | null; order_index: number; is_preview: boolean; content: string | null };
type Module = { id: string; course_id: string; title: string; title_en: string | null; order_index: number; lessons: Lesson[] };
type ModuleResource = { id: string; module_id: string; title: string; url: string | null; notes: string | null; order_index: number; file_path: string | null; file_name: string | null };

const normalizeVideoEmbedUrl = (input: string) => {
  const decoded = input
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
  const iframeMatch = decoded.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  return (iframeMatch ? iframeMatch[1] : decoded)
    .trim()
    .replace(/^https?:\/\/player\.mediadelivery\.net\//i, "https://iframe.mediadelivery.net/");
};

function AdminCourseContent() {
  const { courseId } = Route.useParams();
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const syncAll = useServerFn(syncAllLessonDurations);
  const [syncing, setSyncing] = useState(false);
  const [syncForce, setSyncForce] = useState(false);
  const [syncResults, setSyncResults] = useState<
    Array<{ lessonId: string; title: string; status: "updated" | "skipped" | "error"; duration?: string; message?: string }>
  >([]);
  const [syncSummary, setSyncSummary] = useState<{ updated: number; skipped: number; errors: number; total: number } | null>(null);

  const runBatchSync = async () => {
    setSyncing(true);
    setSyncResults([]);
    setSyncSummary(null);
    try {
      const res = await syncAll({ data: { courseId, force: syncForce } });
      setSyncResults(res.results ?? []);
      setSyncSummary({ updated: res.updated, skipped: res.skipped, errors: res.errors, total: res.total });
      if (res.total === 0) toast.info("مفيش دروس تحتاج مزامنة");
      else toast.success(`تم: ${res.updated} محدث / ${res.skipped} تخطي / ${res.errors} خطأ`);
      if (res.updated > 0) refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "فشلت المزامنة");
    } finally {
      setSyncing(false);
    }
  };

  const refresh = async () => {
    const [c, ms] = await Promise.all([
      supabase.from("courses").select("*").eq("id", courseId).maybeSingle(),
      supabase.from("modules").select("*, lessons(*)").eq("course_id", courseId).order("order_index", { ascending: true }),
    ]);
    setCourse(c.data);
    const sorted = (ms.data ?? [])
      .sort((a: any, b: any) => (Number(a.order_index ?? 0) - Number(b.order_index ?? 0)))
      .map((m: any) => ({
        ...m,
        lessons: (m.lessons ?? []).sort((a: any, b: any) => {
          const ordA = Number(a.order_index ?? 0);
          const ordB = Number(b.order_index ?? 0);
          if (ordA !== ordB) return ordA - ordB;
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        }),
      }));
    setModules(sorted);
    setLoading(false);
    invalidateCache(`course:modules:${courseId}`);
    invalidateCache(`course:outline:${courseId}`);
    if (c.data?.slug) invalidateCache(`course:slug:${c.data.slug}`);
  };

  useEffect(() => { refresh(); }, [courseId]);

  const addModule = async () => {
    if (!newModuleTitle.trim()) return;
    const order = modules.length;
    const { error } = await supabase.from("modules").insert({ course_id: courseId, title: newModuleTitle.trim(), order_index: order });
    if (error) toast.error(error.message); else { toast.success("تمت إضافة الفصل"); setNewModuleTitle(""); refresh(); }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEndModules = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = modules.findIndex((m) => m.id === active.id);
    const newIdx = modules.findIndex((m) => m.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(modules, oldIdx, newIdx);
    setModules(reordered); // optimistic
    const updates = reordered.map((m, i) =>
      supabase.from("modules").update({ order_index: i }).eq("id", m.id),
    );
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) { toast.error("فشل حفظ الترتيب"); refresh(); }
    else toast.success("تم تحديث الترتيب");
  };

  if (loading) return <SiteShell><div className="container-page py-20 text-center text-muted-foreground">جاري التحميل…</div></SiteShell>;
  if (!course) return <SiteShell><div className="container-page py-20 text-center">الكورس غير موجود</div></SiteShell>;

  return (
    <SiteShell>
      <div className="container-page py-8 max-w-5xl">
        <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowRight className="h-4 w-4" /> العودة للوحة الإدارة
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-primary">إدارة محتوى الكورس</h1>
            <p className="text-muted-foreground mt-1">{course.title}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Link to="/admin/course-sessions/$courseId" params={{ courseId: course.id }} className="inline-flex items-center gap-1 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded hover:opacity-90">
              <Calendar className="h-3.5 w-3.5" /> الجلسات المباشرة
            </Link>
            <Link to="/admin/attendance/$courseId" params={{ courseId: course.id }} className="inline-flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-500 shadow-sm font-semibold">
              <Users className="h-3.5 w-3.5" /> تقرير الحضور
            </Link>
            <Link to="/admin/course-progress/$courseId" params={{ courseId: course.id }} className="inline-flex items-center gap-1 text-sm bg-gold text-gold-foreground px-3 py-1.5 rounded hover:opacity-90">
              <Eye className="h-3.5 w-3.5" /> تقدم المشاهدة
            </Link>
            <button
              type="button"
              onClick={() => {
                const url = `${window.location.origin}/learn/${encodeURIComponent(course.slug || course.id)}`;
                navigator.clipboard.writeText(url);
                toast.success("تم نسخ رابط دراسة الكورس المباشر للطلاب");
              }}
              className="inline-flex items-center gap-1 text-sm bg-emerald-600 text-white px-3 py-1.5 rounded hover:bg-emerald-500 shadow-sm font-semibold transition"
              title="انسخ هذا الرابط وابعته للطلاب المشتركين للمشاهدة مباشرة"
            >
              <Copy className="h-3.5 w-3.5" /> نسخ رابط المشاهدة للطلاب
            </button>
            <Link to="/courses/$slug" params={{ slug: course.slug || course.id }} target="_blank" className="inline-flex items-center gap-1 text-sm text-gold hover:underline">
              معاينة الكورس <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>

        </div>

        <Card className="p-4 mb-6 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px]">
            <Label>عنوان فصل جديد</Label>
            <Input value={newModuleTitle} onChange={(e) => setNewModuleTitle(e.target.value)} placeholder="مثال: المقدمة" />
          </div>
          <Button onClick={addModule} className="bg-gold text-gold-foreground hover:bg-gold/90">
            <Plus className="h-4 w-4 ml-1" /> إضافة فصل
          </Button>
        </Card>

        <Card className="p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-primary flex items-center gap-2"><Video className="h-4 w-4" /> مزامنة مدة الدروس من Bunny</h3>
              <p className="text-xs text-muted-foreground mt-1">
                بيجيب مدة كل درس فيه فيديو Bunny ويحدّثها تلقائياً. افتراضياً بيتخطى الدروس اللي مدتها متسجّلة.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <Switch checked={syncForce} onCheckedChange={setSyncForce} />
                إعادة مزامنة الكل
              </label>
              <Button onClick={runBatchSync} disabled={syncing} className="bg-primary text-primary-foreground">
                {syncing ? <><Loader2 className="h-4 w-4 ml-1 animate-spin" /> جاري المزامنة…</> : <>مزامنة الآن</>}
              </Button>
            </div>
          </div>
          {syncSummary && (
            <div className="mt-3 text-xs text-muted-foreground">
              الإجمالي: {syncSummary.total} — محدث: <span className="text-success font-semibold">{syncSummary.updated}</span> — تخطي: <span className="font-semibold">{syncSummary.skipped}</span> — خطأ: <span className="text-destructive font-semibold">{syncSummary.errors}</span>
            </div>
          )}
          {syncResults.length > 0 && (
            <div className="mt-3 max-h-60 overflow-auto rounded border border-border divide-y divide-border text-sm">
              {syncResults.map((r) => (
                <div key={r.lessonId} className="flex items-center justify-between gap-2 p-2">
                  <span className="truncate flex-1">{r.title}</span>
                  {r.status === "updated" && (
                    <Badge className="bg-success text-success-foreground text-xs shrink-0">{r.duration}</Badge>
                  )}
                  {r.status === "skipped" && (
                    <Badge variant="outline" className="text-xs shrink-0" title={r.message}>تخطي</Badge>
                  )}
                  {r.status === "error" && (
                    <Badge variant="destructive" className="text-xs shrink-0" title={r.message}>خطأ</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <CourseDetailsEditor course={course} onSaved={refresh} />

        <div className="space-y-4">
          {modules.length === 0 && (
            <Card className="p-10 text-center text-muted-foreground">لا توجد فصول بعد. أضف الفصل الأول من الأعلى.</Card>
          )}
          {modules.length > 0 && (
            <p className="text-xs text-muted-foreground">💡 اسحب الفصول من المقبض <GripVertical className="inline h-3 w-3" /> لإعادة الترتيب.</p>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEndModules}>
            <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
              {modules.map((m, idx) => (
                <ModuleCard key={m.id} module={m} index={idx} total={modules.length} onChange={refresh} />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <div className="mt-10">
          <h2 className="text-xl font-extrabold text-primary mb-3 flex items-center gap-2">
            <Film className="h-5 w-5" /> أعمال طلاب هذا الكورس
          </h2>
          <p className="text-sm text-muted-foreground mb-4">ارفع فيديوهات أعمال الطلاب — هتترَبط تلقائياً بهذا الكورس وتظهر في صفحة معاينته.</p>
          <StudentWorksManager lockedCourseId={courseId} />
        </div>

        <div className="mt-10">
          <h2 className="text-xl font-extrabold text-primary mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5" /> تاسكات الطلاب
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            أضف تاسكات يرفعها الطلاب كفيديو. تقدر تشاهد، تكتب ملاحظات، تحمّل النسخة لعندك،
            وبمجرد الموافقة هيتم حذف الفيديو من السيرفر تلقائياً.
          </p>
          <CourseTasksManager courseId={courseId} />
        </div>
      </div>
    </SiteShell>
  );
}

function ModuleCard({ module: mod, index, total, onChange }: { module: Module; index: number; total: number; onChange: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(mod.title);
  const [titleEn, setTitleEn] = useState(mod.title_en ?? "");
  const deleteBunnyFn = useServerFn(deleteBunnyVideo);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: mod.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, zIndex: isDragging ? 50 : "auto" as any };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const saveTitle = async () => {
    const { error } = await supabase.from("modules").update({ title, title_en: titleEn.trim() || null }).eq("id", mod.id);
    if (error) toast.error(error.message); else { setEditingTitle(false); onChange(); }
  };

  const move = async (dir: -1 | 1) => {
    const newIdx = mod.order_index + dir;
    if (newIdx < 0 || newIdx >= total) return;
    await supabase.from("modules").update({ order_index: newIdx }).eq("id", mod.id);
    // swap with the other module
    const { data: other } = await supabase.from("modules").select("id").eq("course_id", mod.course_id).eq("order_index", newIdx).neq("id", mod.id).maybeSingle();
    if (other) await supabase.from("modules").update({ order_index: mod.order_index }).eq("id", other.id);
    onChange();
  };

  const remove = async () => {
    if (!confirm(`حذف الفصل "${mod.title}" وجميع دروسه؟`)) return;
    // Delete Bunny videos + storage files for every lesson first, then delete rows
    for (const l of mod.lessons) {
      if (l.video_url) {
        if (l.video_url.startsWith("http")) {
          try { await deleteBunnyFn({ data: { url: l.video_url } }); } catch (e) { console.warn("bunny delete", e); }
        } else {
          await supabase.storage.from("course-videos").remove([l.video_url]);
        }
      }
    }
    await supabase.from("lessons").delete().eq("module_id", mod.id);
    const { error } = await supabase.from("modules").delete().eq("id", mod.id);
    if (error) toast.error(error.message); else { toast.success("تم الحذف"); onChange(); }
  };

  const addLesson = async () => {
    const order = mod.lessons.length;
    const { error } = await supabase.from("lessons").insert({ module_id: mod.id, title: "درس جديد", order_index: order, is_preview: false });
    if (error) toast.error(error.message); else onChange();
  };

  const onDragEndLessons = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = mod.lessons.findIndex((l) => l.id === active.id);
    const newIdx = mod.lessons.findIndex((l) => l.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(mod.lessons, oldIdx, newIdx);
    const updates = reordered.map((l, i) =>
      supabase.from("lessons").update({ order_index: i }).eq("id", l.id),
    );
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) toast.error("فشل حفظ ترتيب الدروس");
    else toast.success("تم تحديث ترتيب الدروس");
    onChange();
  };

  const reverseLessonsOrder = async () => {
    if (mod.lessons.length <= 1) return;
    const reversed = [...mod.lessons].reverse();
    const updates = reversed.map((l, i) =>
      supabase.from("lessons").update({ order_index: i }).eq("id", l.id),
    );
    await Promise.all(updates);
    toast.success("تم عكس ترتيب الدروس وحفظه بنجاح");
    onChange();
  };

  const naturalSortLessons = async () => {
    if (mod.lessons.length <= 1) return;
    const collator = new Intl.Collator("ar", { numeric: true, sensitivity: "base" });
    const sorted = [...mod.lessons].sort((a, b) => collator.compare(a.title, b.title));
    const updates = sorted.map((l, i) =>
      supabase.from("lessons").update({ order_index: i }).eq("id", l.id),
    );
    await Promise.all(updates);
    toast.success("تم ترتيب الدروس تصاعدياً حسب الاسم");
    onChange();
  };

  const moveLesson = async (lessonIndex: number, dir: -1 | 1) => {
    const targetIndex = lessonIndex + dir;
    if (targetIndex < 0 || targetIndex >= mod.lessons.length) return;
    const reordered = arrayMove(mod.lessons, lessonIndex, targetIndex);
    const updates = reordered.map((l, i) =>
      supabase.from("lessons").update({ order_index: i }).eq("id", l.id),
    );
    await Promise.all(updates);
    onChange();
  };

  return (
    <Card ref={setNodeRef} style={style} className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 p-4 bg-secondary/40 border-b">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-primary touch-none shrink-0"
            aria-label="اسحب لإعادة الترتيب"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-primary shrink-0">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <Badge variant="secondary" className="shrink-0">فصل {index + 1}</Badge>
          {editingTitle ? (
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8" placeholder="عنوان عربي" />
              <Input dir="ltr" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className="h-8" placeholder="Title (EN, optional)" />
              <Button size="sm" onClick={saveTitle}>حفظ</Button>
            </div>
          ) : (
            <button onClick={() => setEditingTitle(true)} className="font-bold text-primary hover:underline truncate">
              {mod.title}
              {mod.title_en ? <span className="ml-2 text-[10px] font-normal text-muted-foreground">/ {mod.title_en}</span> : null}
            </button>
          )}
          <span className="text-xs text-muted-foreground shrink-0">({mod.lessons.length} درس)</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="icon" variant="ghost" onClick={() => move(-1)} disabled={index === 0}><ChevronUp className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => move(1)} disabled={index === total - 1}><ChevronDown className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={remove}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap pb-1 border-b border-border/50 text-xs">
            <span className="text-muted-foreground font-medium">قائمة الدروس ({mod.lessons.length})</span>
            {mod.lessons.length > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={reverseLessonsOrder}
                  className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                  title="عكس ترتيب الدروس بالكامل إذا كانت الفيديوهات مقلوبة"
                >
                  <ArrowUpDown className="h-3 w-3 ml-1" />
                  عكس الترتيب
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={naturalSortLessons}
                  className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                  title="ترتيب الدروس تلقائياً حسب الرقم/الاسم (1، 2، 3...)"
                >
                  <ListOrdered className="h-3 w-3 ml-1" />
                  ترتيب تصاعدي (1، 2..)
                </Button>
              </div>
            )}
          </div>
          {mod.lessons.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">لا توجد دروس في هذا الفصل بعد</div>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEndLessons}>
            <SortableContext items={mod.lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              {mod.lessons.map((l, i) => (
                <LessonRow
                  key={l.id}
                  lesson={l}
                  index={i}
                  moduleLessonsCount={mod.lessons.length}
                  onChange={onChange}
                  onMove={(dir) => moveLesson(i, dir)}
                />
              ))}
            </SortableContext>
          </DndContext>
          <Button variant="outline" onClick={addLesson} className="w-full">
            <Plus className="h-4 w-4 ml-1" /> إضافة درس
          </Button>
          <ModuleResources moduleId={mod.id} />
        </div>
      )}
    </Card>
  );
}

function LessonRow({ lesson, index, moduleLessonsCount, onChange, onMove }: { lesson: Lesson; index: number; moduleLessonsCount: number; onChange: () => void; onMove: (dir: -1 | 1) => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const [titleEn, setTitleEn] = useState(lesson.title_en ?? "");
  const [duration, setDuration] = useState(lesson.duration ?? "");
  const [content, setContent] = useState(lesson.content ?? "");
  const [isPreview, setIsPreview] = useState(lesson.is_preview);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoLink, setVideoLink] = useState(lesson.video_url ?? "");
  const [savingLink, setSavingLink] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id });
  const dragStyle = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, zIndex: isDragging ? 40 : "auto" as any };
  const createTusUpload = useServerFn(createBunnyTusUpload);
  const syncLesson = useServerFn(syncLessonDuration);
  const deleteBunnyFn = useServerFn(deleteBunnyVideo);

  const isExternalLink = (lesson.video_url ?? "").startsWith("http");

  const saveVideoLink = async () => {
    const url = normalizeVideoEmbedUrl(videoLink);
    if (!url) { toast.error("ادخل رابط الفيديو"); return; }
    if (!/^https?:\/\//i.test(url)) { toast.error("الرابط لازم يبدأ بـ http(s)://"); return; }
    setSavingLink(true);
    // remove old video (Bunny or storage) if replacing with a different one
    if (lesson.video_url && lesson.video_url !== url) {
      if (lesson.video_url.startsWith("http")) {
        try { await deleteBunnyFn({ data: { url: lesson.video_url } }); } catch (e) { console.warn("bunny delete", e); }
      } else {
        await supabase.storage.from("course-videos").remove([lesson.video_url]);
      }
    }
    const { error } = await supabase.from("lessons").update({ video_url: url }).eq("id", lesson.id);
    setSavingLink(false);
    if (error) toast.error(error.message); else {
      try {
        const res = await syncLesson({ data: { lessonId: lesson.id } });
        toast.success(`تم حفظ الرابط والمدة: ${res.duration}`);
      } catch (e: any) {
        toast.success("تم حفظ رابط الفيديو");
      }
      onChange();
    }
  };

  const clearVideo = async () => {
    if (!lesson.video_url) return;
    if (!confirm("إزالة الفيديو من هذا الدرس؟")) return;
    if (lesson.video_url.startsWith("http")) {
      try { await deleteBunnyFn({ data: { url: lesson.video_url } }); } catch (e) { console.warn("bunny delete", e); }
    } else {
      await supabase.storage.from("course-videos").remove([lesson.video_url]);
    }
    const { error } = await supabase.from("lessons").update({ video_url: null }).eq("id", lesson.id);
    if (error) toast.error(error.message); else { setVideoLink(""); toast.success("تمت الإزالة"); onChange(); }
  };

  const save = async () => {
    const { error } = await supabase.from("lessons").update({ title, title_en: titleEn.trim() || null, duration: duration || null, content: content || null, is_preview: isPreview }).eq("id", lesson.id);
    if (error) toast.error(error.message); else { toast.success("تم الحفظ"); setEditing(false); onChange(); }
  };

  const remove = async () => {
    if (!confirm(`حذف الدرس "${lesson.title}"؟`)) return;
    if (lesson.video_url) {
      if (lesson.video_url.startsWith("http")) {
        try { await deleteBunnyFn({ data: { url: lesson.video_url } }); } catch (e) { console.warn("bunny delete", e); }
      } else {
        await supabase.storage.from("course-videos").remove([lesson.video_url]);
      }
    }
    const { error } = await supabase.from("lessons").delete().eq("id", lesson.id);
    if (error) toast.error(error.message); else { toast.success("تم الحذف"); onChange(); }
  };

  const uploadVideo = async (file: File) => {
    // Bunny Stream accepts very large files; cap at 5GB as a safety net.
    if (file.size > 5 * 1024 * 1024 * 1024) { toast.error("حجم الفيديو يتجاوز 5 جيجا"); return; }
    setUploading(true); setProgress(0);
    try {
      // remove old video (Bunny embed or storage path) before uploading the new one
      if (lesson.video_url) {
        if (lesson.video_url.startsWith("http")) {
          try { await deleteBunnyFn({ data: { url: lesson.video_url } }); } catch (e) { console.warn("bunny delete", e); }
        } else {
          await supabase.storage.from("course-videos").remove([lesson.video_url]);
        }
      }
      // 1) Ask the server for Bunny Stream TUS credentials
      const creds = await createTusUpload({ data: { title: lesson.title || file.name } });

      // 2) Stream the file directly to Bunny via TUS (chunked, resumable, real progress)
      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint: creds.endpoint,
          retryDelays: [0, 1000, 3000, 5000, 10000],
          chunkSize: 50 * 1024 * 1024, // 50 MB chunks
          headers: {
            AuthorizationSignature: creds.authorizationSignature,
            AuthorizationExpire: String(creds.authorizationExpire),
            VideoId: creds.videoId,
            LibraryId: creds.libraryId,
          },
          metadata: {
            filetype: file.type,
            title: lesson.title || file.name,
          },
          onError: (err) => reject(err),
          onProgress: (sent, total) => {
            if (total > 0) setProgress(Math.round((sent / total) * 100));
          },
          onSuccess: () => resolve(),
        });
        upload.start();
      });

      // 3) Save the Bunny iframe embed URL as the lesson's video_url
      const { error: dbErr } = await supabase
        .from("lessons")
        .update({ video_url: creds.iframeUrl })
        .eq("id", lesson.id);
      if (dbErr) throw dbErr;
      try {
        const res = await syncLesson({ data: { lessonId: lesson.id } });
        toast.success(`تم رفع الفيديو والمدة: ${res.duration}`);
      } catch (e: any) {
        toast.success("تم رفع الفيديو بنجاح. المدة هتتحدث تلقائياً بعد ما الفيديو يتعالج.");
      }
      onChange();
    } catch (e: any) {
      toast.error(e.message ?? "فشل رفع الفيديو");
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div ref={setNodeRef} style={dragStyle} className="rounded-lg border bg-background p-3 space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-primary touch-none shrink-0"
          aria-label="اسحب لإعادة الترتيب"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <Badge variant="outline" className="shrink-0 text-xs">{index + 1}</Badge>
        {lesson.video_url ? <Video className="h-4 w-4 text-success shrink-0" /> : <Film className="h-4 w-4 text-muted-foreground shrink-0" />}
        {editing ? (
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 flex-1" />
        ) : (
          <button onClick={() => setEditing(true)} className="font-medium hover:underline text-right flex-1 truncate">
            {lesson.title}
            {lesson.title_en ? <span className="ml-2 text-[10px] font-normal text-muted-foreground">/ {lesson.title_en}</span> : null}
          </button>
        )}
        {lesson.is_preview && <Badge className="bg-gold text-gold-foreground text-xs shrink-0">معاينة</Badge>}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onMove(-1)} disabled={index === 0}><ChevronUp className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onMove(1)} disabled={index === moduleLessonsCount - 1}><ChevronDown className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={remove}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
        </div>
      </div>

      {editing && (
        <div className="grid sm:grid-cols-2 gap-2 pt-2 border-t">
          <div className="sm:col-span-2">
            <Label className="text-xs">Lesson title (English, optional)</Label>
            <Input dir="ltr" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className="h-8" placeholder="English lesson title" />
          </div>
          <div>
            <Label className="text-xs">المدة (مثال: 12:30)</Label>
            <Input value={duration} onChange={(e) => setDuration(e.target.value)} className="h-8" />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Switch checked={isPreview} onCheckedChange={setIsPreview} id={`preview-${lesson.id}`} />
            <Label htmlFor={`preview-${lesson.id}`} className="text-xs cursor-pointer">إتاحة الدرس كمعاينة مجانية</Label>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">وصف الدرس / ملاحظات (اختياري)</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={2} className="text-sm" />
          </div>
          <div className="sm:col-span-2 flex gap-2">
            <Button size="sm" onClick={save} className="bg-gold text-gold-foreground hover:bg-gold/90">حفظ</Button>
            <Button size="sm" variant="outline" onClick={() => { setEditing(false); setTitle(lesson.title); }}>إلغاء</Button>
          </div>
        </div>
      )}

      <div className="space-y-2 pt-2 border-t">
        <div className="flex items-center gap-2">
          <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            value={videoLink}
            onChange={(e) => setVideoLink(e.target.value)}
            placeholder="ألصق الرابط"
            className="h-8 text-sm flex-1"
            dir="ltr"
          />
          <Button size="sm" onClick={saveVideoLink} disabled={savingLink} className="bg-gold text-gold-foreground hover:bg-gold/90 shrink-0">
            {savingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5 ml-1" /> حفظ الرابط</>}
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
        <input
          ref={fileRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadVideo(f); }}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> : <Upload className="h-3.5 w-3.5 ml-1" />}
          {uploading ? `جاري الرفع... ${progress}%` : "أو رفع ملف فيديو"}
        </Button>
        {lesson.video_url && !uploading && (
          <span className="text-xs text-muted-foreground truncate flex-1">
            {isExternalLink ? "🔗 لينك خارجي محفوظ" : `📁 ${lesson.video_url.split("/").pop()}`}
          </span>
        )}
        {lesson.video_url && !uploading && (
          <Button size="sm" variant="ghost" onClick={clearVideo} className="text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
        {uploading && (
          <div className="flex-1 h-1.5 bg-secondary rounded overflow-hidden">
            <div className="h-full bg-gold transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

function ModuleResources({ moduleId }: { moduleId: string }) {
  const [items, setItems] = useState<ModuleResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [viewOnly, setViewOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("module_resources").select("*").eq("module_id", moduleId).order("order_index");
    setItems((data ?? []) as ModuleResource[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [moduleId]);

  const add = async () => {
    if (!title.trim()) { toast.error("ادخل عنوان المادة"); return; }
    if (url && !/^https?:\/\//i.test(url.trim())) { toast.error("الرابط لازم يبدأ بـ http(s)://"); return; }
    setSaving(true);
    let file_path: string | null = null;
    let file_name: string | null = null;
    if (file) {
      if (file.size > 100 * 1024 * 1024) { setSaving(false); toast.error("حجم الملف يتجاوز 100 ميجا"); return; }
      setUploading(true);
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
      const path = `${moduleId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
      const contentType = file.type || "application/octet-stream";
      const { error: upErr } = await supabase.storage.from("course-materials").upload(path, file, { contentType, upsert: false });
      setUploading(false);
      if (upErr) { setSaving(false); toast.error(upErr.message); return; }
      file_path = path;
      file_name = file.name;
    }
    const finalNotes = serializeResourceMetadata(notes, viewOnly);
    const { error } = await supabase.from("module_resources").insert({
      module_id: moduleId,
      title: title.trim(),
      url: url.trim() || null,
      notes: finalNotes || null,
      order_index: items.length,
      file_path,
      file_name,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setTitle(""); setUrl(""); setNotes(""); setFile(null); setViewOnly(false);
    if (fileRef.current) fileRef.current.value = "";
    toast.success("تمت إضافة المادة بنجاح");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذه المادة؟")) return;
    const item = items.find((x) => x.id === id);
    if (item?.file_path) {
      await supabase.storage.from("course-materials").remove([item.file_path]);
    }
    const { error } = await supabase.from("module_resources").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("تم الحذف"); load(); }
  };

  const togglePermission = async (item: ModuleResource) => {
    const current = parseResourceMetadata(item.notes);
    const nextViewOnly = !current.viewOnly;
    const newNotes = serializeResourceMetadata(current.notes, nextViewOnly);
    const { error } = await supabase.from("module_resources").update({ notes: newNotes }).eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    toast.success(nextViewOnly ? "تم تغيير الحالة إلى: معاينة محمية فقط 🔒" : "تم تغيير الحالة إلى: متاح للتحميل 📥");
    load();
  };

  const openFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("course-materials").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) { toast.error("تعذر فتح الملف"); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="rounded-lg border bg-secondary/20 p-3 space-y-3">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-sm font-semibold text-primary">
        <span className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-gold" />
          ملاحظات ومواد الفصل
          <Badge variant="outline" className="text-xs">{items.length}</Badge>
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="space-y-3">
          {loading ? (
            <div className="text-xs text-muted-foreground text-center py-2">جاري التحميل…</div>
          ) : items.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-2">لا توجد مواد بعد</div>
          ) : (
            <div className="space-y-2">
              {items.map((r) => {
                const meta = parseResourceMetadata(r.notes);
                return (
                  <div key={r.id} className="bg-background rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-gold/10 text-gold flex items-center justify-center shrink-0 mt-0.5">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-foreground truncate">{r.title}</span>
                          {r.file_path && (
                            <button
                              type="button"
                              onClick={() => togglePermission(r)}
                              title="اضغط للتبديل بين المعاينة المحمية والتحميل"
                              className="inline-flex items-center cursor-pointer transition-transform hover:scale-105"
                            >
                              {meta.viewOnly ? (
                                <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                  <Lock className="h-2.5 w-2.5" /> معاينة محمية فقط (ممنوع التنزيل)
                                </span>
                              ) : (
                                <span className="text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                  <Download className="h-2.5 w-2.5" /> متاح للتحميل
                                </span>
                              )}
                            </button>
                          )}
                        </div>

                        {r.file_path && (
                          <button type="button" onClick={() => openFile(r.file_path!)} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 mt-1">
                            <FileUp className="h-3 w-3" /> {r.file_name ?? "معاينة / فتح الملف"}
                          </button>
                        )}
                        {r.url && (
                          <a href={r.url} target="_blank" rel="noopener noreferrer" dir="ltr" className="text-xs text-blue-500 hover:underline truncate block mt-0.5">
                            {r.url}
                          </a>
                        )}
                        {meta.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{meta.notes}</p>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => remove(r.id)} aria-label="حذف المادة">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-background rounded-xl border p-3.5 space-y-3">
            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5 text-gold" />
              <span>إضافة مادة / ملف جديد لهذا الفصل</span>
            </div>

            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان المادة (مثال: ملحقات العمل / PSD / PDF)" className="h-9" />
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="رابط خارجي (اختياري) — https://..." className="h-9" dir="ltr" />
            
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <Button size="sm" type="button" variant="outline" onClick={() => fileRef.current?.click()} className="h-9">
                <FileUp className="h-3.5 w-3.5 ml-1" /> {file ? "تغيير الملف" : "إرفاق ملف (أي صيغة)"}
              </Button>
              {file && <span className="text-xs text-muted-foreground truncate flex-1">{file.name}</span>}
              {file && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
            </div>

            {/* Permission / Protection Setting */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border text-xs gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Shield className={`h-5 w-5 shrink-0 ${viewOnly ? "text-amber-500" : "text-emerald-500"}`} />
                <div className="min-w-0">
                  <div className="font-bold text-foreground truncate">
                    {viewOnly ? "معاينة محمية فقط (ممنوع التحميل والطباعة)" : "متاح للتحميل والمعاينة للطلاب"}
                  </div>
                  <div className="text-[11px] text-muted-foreground line-clamp-1">
                    {viewOnly ? "يتم عرض الملف بعلامة مائية باسم ورقم هاتف الطالب مع حظر التنزيل" : "يمكن للطلاب تنزيل وحفظ الملف واستخدامه"}
                  </div>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant={viewOnly ? "default" : "outline"}
                onClick={() => setViewOnly(!viewOnly)}
                className={`h-8 text-xs shrink-0 font-bold transition-all ${
                  viewOnly ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm" : "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                }`}
              >
                {viewOnly ? "🔒 محمي (معاينة فقط)" : "📥 متاح للتحميل"}
              </Button>
            </div>

            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات أو تعليمات إضافية للطلاب (اختياري)" rows={2} className="text-sm" />
            
            <Button size="sm" onClick={add} disabled={saving} className="w-full bg-gold text-gold-foreground hover:bg-gold/90 h-9 font-bold">
              {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> {uploading ? "جاري رفع الملف..." : "جاري الحفظ..."}</> : <><Plus className="h-3.5 w-3.5 ml-1" /> إضافة المادة للفصل</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CourseDetailsEditor({ course, onSaved }: { course: any; onSaved: () => void }) {
  const [shortDesc, setShortDesc] = useState<string>(course.short_description ?? "");
  const [description, setDescription] = useState<string>(course.description ?? "");
  const [items, setItems] = useState<string[]>(Array.isArray(course.what_you_learn) ? course.what_you_learn : []);
  const [newItem, setNewItem] = useState("");
  const [suitable, setSuitable] = useState<string[]>(Array.isArray(course.suitable_for) ? course.suitable_for : []);
  const [newSuitable, setNewSuitable] = useState("");
  const [reqs, setReqs] = useState<string[]>(Array.isArray(course.requirements) ? course.requirements : []);
  const [newReq, setNewReq] = useState("");
  const [saving, setSaving] = useState(false);
  const [shortDescEn, setShortDescEn] = useState<string>(course.short_description_en ?? "");
  const [descriptionEn, setDescriptionEn] = useState<string>(course.description_en ?? "");
  const [itemsEn, setItemsEn] = useState<string[]>(Array.isArray(course.what_you_learn_en) ? course.what_you_learn_en : []);
  const [maxVideoViews, setMaxVideoViews] = useState<string>(String(course?.certificate_config?.max_video_views ?? 4));
  const [translatingEn, setTranslatingEn] = useState(false);
  const translateFn = useServerFn(translateFields);

  useEffect(() => {
    setShortDesc(course.short_description ?? "");
    setDescription(course.description ?? "");
    setItems(Array.isArray(course.what_you_learn) ? course.what_you_learn : []);
    setSuitable(Array.isArray(course.suitable_for) ? course.suitable_for : []);
    setReqs(Array.isArray(course.requirements) ? course.requirements : []);
    setShortDescEn(course.short_description_en ?? "");
    setDescriptionEn(course.description_en ?? "");
    setItemsEn(Array.isArray(course.what_you_learn_en) ? course.what_you_learn_en : []);
    setMaxVideoViews(String(course?.certificate_config?.max_video_views ?? 4));
  }, [course.id]);

  const translateToEn = async () => {
    const src: { key: string; text: string }[] = [];
    if (shortDesc.trim()) src.push({ key: "short_description", text: shortDesc.trim() });
    if (description.trim()) src.push({ key: "description", text: description.trim() });
    const arItems = items.map((s) => s.trim()).filter(Boolean);
    arItems.forEach((t, i) => src.push({ key: `wyl_${i}`, text: t }));
    if (src.length === 0) { toast.error("لا يوجد محتوى عربي للترجمة"); return; }
    setTranslatingEn(true);
    try {
      const res = await translateFn({ data: { fields: src, target: "en" as const } });
      const t = res.translations;
      if (t.short_description) setShortDescEn(t.short_description);
      if (t.description) setDescriptionEn(t.description);
      const newItemsEn = arItems.map((_, i) => t[`wyl_${i}`]).filter((v): v is string => !!v && v.trim().length > 0);
      if (newItemsEn.length) setItemsEn(newItemsEn);
      toast.success("تمت الترجمة — راجع النص قبل الحفظ");
    } catch (e: any) {
      const m = String(e?.message || "");
      if (m.includes("rate_limited")) toast.error("محاولات كتير — استنى شوية");
      else if (m.includes("credits_exhausted")) toast.error("الرصيد نفد");
      else toast.error("فشل الترجمة");
    } finally {
      setTranslatingEn(false);
    }
  };

  const save = async () => {
    setSaving(true);
    const updatedCertConfig = {
      ...(course.certificate_config || {}),
      max_video_views: Number(maxVideoViews) >= 0 ? Number(maxVideoViews) : 4,
    };
    const { error } = await supabase
      .from("courses")
      .update({
        short_description: shortDesc.trim() || null,
        description: description.trim(),
        what_you_learn: items.map((s) => s.trim()).filter(Boolean),
        suitable_for: suitable.map((s) => s.trim()).filter(Boolean),
        requirements: reqs.map((s) => s.trim()).filter(Boolean),
        short_description_en: shortDescEn.trim() || null,
        description_en: descriptionEn.trim() || null,
        what_you_learn_en: itemsEn.map((s) => s.trim()).filter(Boolean),
        certificate_config: updatedCertConfig,
      })
      .eq("id", course.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      invalidateCache(`course:slug:${course.slug}`);
      invalidateCache(`course:outline:${course.id}`);
      toast.success("تم حفظ تفاصيل الكورس");
      onSaved();
    }
  };

  const renderList = (
    label: string,
    hint: string,
    list: string[],
    setList: (v: string[]) => void,
    draft: string,
    setDraft: (v: string) => void,
    placeholder: string,
  ) => {
    const add = () => {
      const v = draft.trim();
      if (!v) return;
      setList([...list, v]);
      setDraft("");
    };
    const update = (i: number, v: string) => {
      const n = [...list]; n[i] = v; setList(n);
    };
    const remove = (i: number) => setList(list.filter((_, idx) => idx !== i));
    const move = (i: number, dir: -1 | 1) => {
      const j = i + dir; if (j < 0 || j >= list.length) return;
      const n = [...list]; [n[i], n[j]] = [n[j], n[i]]; setList(n);
    };
    return (
      <div>
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground mb-2">{hint}</p>
        <div className="space-y-2">
          {list.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-3 border border-dashed rounded">لا توجد نقاط بعد</div>
          )}
          {list.map((it, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={it} onChange={(e) => update(i, e.target.value)} className="flex-1" />
              <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}><ChevronUp className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === list.length - 1}><ChevronDown className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder={placeholder}
          />
          <Button onClick={add} variant="outline"><Plus className="h-4 w-4 ml-1" /> إضافة</Button>
        </div>
      </div>
    );
  };

  return (
    <Card className="p-5 mb-6 space-y-5">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-gold" />
        <h2 className="text-lg font-extrabold text-primary">تفاصيل الكورس (تظهر للزائر في صفحة المعاينة)</h2>
      </div>

      <div>
        <Label>وصف مختصر</Label>
        <Textarea value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} rows={2} placeholder="جملة قصيرة تظهر أعلى صفحة الكورس" />
      </div>

      <div>
        <Label>عن الكورس (الوصف الكامل)</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} placeholder="اشرح محتوى الكورس بالتفصيل…" />
      </div>

      {renderList(
        "ماذا ستتعلم؟",
        "كل سطر يظهر كنقطة منفصلة في قسم «ماذا ستتعلم».",
        items, setItems, newItem, setNewItem,
        "أضف نقطة جديدة واضغط Enter",
      )}

      {renderList(
        "هذا الكورس مناسب لك إذا كنت…",
        "كل سطر يظهر كبطاقة في قسم «هذا الكورس مناسب لك».",
        suitable, setSuitable, newSuitable, setNewSuitable,
        "مثال: صاحب مشروع وتريد إنتاج محتوى احترافي",
      )}

      {renderList(
        "ماذا تحتاج لبدء الدورة؟",
        "المتطلبات أو الأدوات المطلوبة قبل البدء.",
        reqs, setReqs, newReq, setNewReq,
        "مثال: جهاز كمبيوتر أو موبايل متصل بالإنترنت",
      )}

      <div className="border-t pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-extrabold text-primary text-base">النسخة الإنجليزية</div>
            <p className="text-xs text-muted-foreground">تظهر لما اللغة EN — اتركها فارغة لعرض العربية للجميع.</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={translatingEn}
            onClick={translateToEn}
            className="gap-1 border-gold/40 text-gold hover:bg-gold/10"
          >
            {translatingEn ? <><Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> جاري الترجمة…</> : "ترجم بالـ AI ✨"}
          </Button>
        </div>

        <div>
          <Label>Short description (English)</Label>
          <Textarea dir="ltr" value={shortDescEn} onChange={(e) => setShortDescEn(e.target.value)} rows={2} />
        </div>
        <div>
          <Label>About the course (English)</Label>
          <Textarea dir="ltr" value={descriptionEn} onChange={(e) => setDescriptionEn(e.target.value)} rows={6} />
        </div>
        <div>
          <Label>What you will learn (English)</Label>
          <p className="text-xs text-muted-foreground mb-2">سطر لكل نقطة — يفضل يكون بنفس ترتيب النسخة العربية.</p>
          <div className="space-y-2">
            {itemsEn.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-3 border border-dashed rounded">No English bullets yet</div>
            )}
            {itemsEn.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input dir="ltr" value={it} onChange={(e) => { const n = [...itemsEn]; n[i] = e.target.value; setItemsEn(n); }} className="flex-1" />
                <Button size="icon" variant="ghost" onClick={() => setItemsEn(itemsEn.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <Input
              dir="ltr"
              placeholder="Add a bullet and press Enter"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (v) { setItemsEn([...itemsEn, v]); (e.target as HTMLInputElement).value = ""; }
                }
              }}
            />
          </div>
        </div>
      </div>

      <div className="border-t pt-4 bg-secondary/20 p-4 rounded-xl space-y-2">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-gold" />
          <Label className="font-bold text-primary text-sm">الحد الأقصى لمشاهدات كل فيديو في هذا الكورس</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          كم مرة يستطيع الطالب مشاهدة فيديو الدرس الواحد (افتراضياً: 4 مشاهدات). إذا انتهت مشاهدات الطالب يُقفل الفيديو ويظهر له تنبيه بالتواصل مع الإدارة. (اكتب 0 للمشاهدة غير المحدودة).
        </p>
        <div className="flex items-center gap-3 pt-1">
          <Input
            type="number"
            min="0"
            value={maxVideoViews}
            onChange={(e) => setMaxVideoViews(e.target.value)}
            placeholder="4"
            className="w-32 bg-background font-bold text-center"
          />
          <span className="text-sm font-semibold text-muted-foreground">مشاهدات لكل درس</span>
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t">
        <Button onClick={save} disabled={saving} className="bg-gold text-gold-foreground hover:bg-gold/90">
          {saving ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <Save className="h-4 w-4 ml-1" />}
          حفظ التفاصيل
        </Button>
      </div>
    </Card>
  );
}