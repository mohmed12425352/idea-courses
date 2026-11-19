import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowRight, Lock, Trash2, Search } from "lucide-react";

export const Route = createFileRoute("/admin_/lesson-blocks")({
  ssr: false,
  component: LessonBlocksPage,
});

type Course = { id: string; title: string };
type Student = { id: string; name: string | null; email: string | null };
type Lesson = { id: string; title: string; module_id: string; order_index: number; module_title: string; module_order: number };
type BlockRow = {
  id: string;
  user_id: string;
  lesson_id: string;
  reason: string | null;
  created_at: string;
  student_name: string | null;
  student_email: string | null;
  lesson_title: string;
  course_title: string;
};

function LessonBlocksPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentQuery, setStudentQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);

  useEffect(() => {
    if (authLoading || !isAdmin) return;
    (async () => {
      const [{ data: cs }, { data: ss }] = await Promise.all([
        supabase.from("courses").select("id,title").order("title"),
        supabase.from("profiles").select("id,name,email").order("name"),
      ]);
      setCourses((cs ?? []) as Course[]);
      setStudents((ss ?? []) as Student[]);
      await loadBlocks();
    })();
  }, [authLoading, isAdmin]);

  const loadBlocks = async () => {
    const { data, error } = await supabase
      .from("lesson_access_blocks")
      .select("id,user_id,lesson_id,reason,created_at")
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    const raw = data ?? [];
    const lessonIds = Array.from(new Set(raw.map((r: any) => r.lesson_id)));
    const userIds = Array.from(new Set(raw.map((r: any) => r.user_id)));
    const [{ data: lessonsData }, { data: profs }] = await Promise.all([
      lessonIds.length
        ? supabase.from("lessons").select("id,title, modules:module_id(title, courses:course_id(title))").in("id", lessonIds)
        : Promise.resolve({ data: [] as any[] }),
      userIds.length
        ? supabase.from("profiles").select("id,name,email").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const lessonMap = new Map<string, any>((lessonsData ?? []).map((l: any) => [l.id, l]));
    const profMap = new Map<string, any>((profs ?? []).map((p: any) => [p.id, p]));
    const rows: BlockRow[] = raw.map((r: any) => {
      const l = lessonMap.get(r.lesson_id);
      const p = profMap.get(r.user_id);
      return {
        id: r.id,
        user_id: r.user_id,
        lesson_id: r.lesson_id,
        reason: r.reason,
        created_at: r.created_at,
        student_name: p?.name ?? null,
        student_email: p?.email ?? null,
        lesson_title: l?.title ?? "درس محذوف",
        course_title: l?.modules?.courses?.title ?? "—",
      };
    });
    setBlocks(rows);
  };

  useEffect(() => {
    if (!selectedCourseId) { setLessons([]); setSelectedLessonIds([]); return; }
    (async () => {
      const { data } = await supabase
        .from("modules")
        .select("id,title,order_index, lessons(id,title,order_index,module_id)")
        .eq("course_id", selectedCourseId)
        .order("order_index");
      const flat: Lesson[] = [];
      (data ?? []).forEach((m: any) => {
        (m.lessons ?? [])
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .forEach((l: any) => flat.push({
            id: l.id, title: l.title, module_id: m.id, order_index: l.order_index,
            module_title: m.title, module_order: m.order_index,
          }));
      });
      setLessons(flat);
      setSelectedLessonIds([]);
    })();
  }, [selectedCourseId]);

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return students.slice(0, 100);
    return students.filter((s) =>
      (s.name ?? "").toLowerCase().includes(q) || (s.email ?? "").toLowerCase().includes(q)
    ).slice(0, 100);
  }, [students, studentQuery]);

  const toggleLesson = (id: string) => {
    setSelectedLessonIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const applyBlocks = async () => {
    if (!selectedStudentId) { toast.error("اختر الطالب"); return; }
    if (selectedLessonIds.length === 0) { toast.error("اختر محاضرة واحدة على الأقل"); return; }
    setBusy(true);
    try {
      const rows = selectedLessonIds.map((lid) => ({
        user_id: selectedStudentId,
        lesson_id: lid,
        reason: reason.trim() || null,
        blocked_by: user?.id ?? null,
      }));
      const { error } = await supabase
        .from("lesson_access_blocks")
        .upsert(rows, { onConflict: "user_id,lesson_id", ignoreDuplicates: false });
      if (error) throw error;
      toast.success(`تم قفل ${selectedLessonIds.length} محاضرة`);
      setSelectedLessonIds([]);
      setReason("");
      await loadBlocks();
    } catch (e: any) {
      toast.error(e.message || "تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  const removeBlock = async (id: string) => {
    if (!confirm("فك القفل عن هذه المحاضرة للطالب؟")) return;
    const { error } = await supabase.from("lesson_access_blocks").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم فك القفل");
    loadBlocks();
  };

  if (authLoading) return <div className="p-8 text-center text-muted-foreground">جاري التحميل…</div>;
  if (!isAdmin) return <div className="p-8 text-center text-destructive">غير مصرح</div>;

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Lock className="h-6 w-6" /> قفل محاضرات لطالب
        </h1>
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin"><ArrowRight className="h-4 w-4 ml-1" />رجوع للأدمن</Link>
        </Button>
      </div>

      <Card className="p-5 space-y-4">
        <div className="font-semibold text-primary">قفل محاضرات جديدة</div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>الطالب</Label>
            <div className="relative">
              <Search className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="ابحث بالاسم أو الإيميل…"
                className="pr-9"
              />
            </div>
            <div className="border rounded-md max-h-56 overflow-auto divide-y">
              {filteredStudents.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedStudentId(s.id)}
                  className={`w-full text-right p-2 text-sm hover:bg-muted transition ${selectedStudentId === s.id ? "bg-primary/10" : ""}`}
                >
                  <div className="font-medium">{s.name || "بدون اسم"}</div>
                  <div className="text-xs text-muted-foreground" dir="ltr">{s.email}</div>
                </button>
              ))}
              {filteredStudents.length === 0 && (
                <div className="p-3 text-center text-sm text-muted-foreground">لا نتائج</div>
              )}
            </div>
            {selectedStudent && (
              <div className="text-xs text-primary">
                محدد: {selectedStudent.name} — {selectedStudent.email}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>الكورس</Label>
            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
              <SelectTrigger><SelectValue placeholder="اختر الكورس" /></SelectTrigger>
              <SelectContent>
                {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>

            <Label className="mt-3">السبب (اختياري)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: لم يسدد الرسوم" />
          </div>
        </div>

        {selectedCourseId && selectedStudentId && (() => {
          const courseLessonIds = new Set(lessons.map((l) => l.id));
          const activeBlocks = blocks.filter(
            (b) => b.user_id === selectedStudentId && courseLessonIds.has(b.lesson_id)
          );
          return activeBlocks.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-destructive">المحاضرات المقفولة حاليًا لهذا الطالب في الكورس ({activeBlocks.length})</Label>
              <div className="border border-destructive/40 rounded-md divide-y bg-destructive/5">
                {activeBlocks.map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-2 text-sm">
                    <div>
                      <div className="font-medium">{b.lesson_title}</div>
                      {b.reason && <div className="text-xs text-muted-foreground">السبب: {b.reason}</div>}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => removeBlock(b.id)}>
                      <Trash2 className="h-4 w-4 ml-1" /> فك القفل
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null;
        })()}

        {selectedCourseId && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>المحاضرات ({selectedLessonIds.length} محددة)</Label>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedLessonIds(lessons.map((l) => l.id))}>تحديد الكل</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedLessonIds([])}>إلغاء الكل</Button>
              </div>
            </div>
            <div className="border rounded-md max-h-72 overflow-auto divide-y">
              {lessons.map((l) => (
                <label key={l.id} className="flex items-center gap-3 p-2 text-sm hover:bg-muted cursor-pointer">
                  <Checkbox checked={selectedLessonIds.includes(l.id)} onCheckedChange={() => toggleLesson(l.id)} />
                  <div className="flex-1">
                    <div className="font-medium">{l.title}</div>
                    <div className="text-xs text-muted-foreground">{l.module_title}</div>
                  </div>
                </label>
              ))}
              {lessons.length === 0 && (
                <div className="p-3 text-center text-sm text-muted-foreground">لا توجد محاضرات</div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={applyBlocks} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            <Lock className="h-4 w-4 ml-1" /> {busy ? "جاري القفل…" : "قفل المحاضرات المحددة"}
          </Button>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="font-semibold text-primary">المحاضرات المقفولة حاليًا ({blocks.length})</div>
        {blocks.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">لا يوجد قفل حاليًا</div>
        ) : (
          <div className="divide-y">
            {blocks.map((b) => (
              <div key={b.id} className="py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{b.lesson_title}</div>
                  <div className="text-xs text-muted-foreground">{b.course_title}</div>
                  <div className="text-xs mt-1">
                    الطالب: <span className="font-medium">{b.student_name || "—"}</span>
                    <span className="text-muted-foreground" dir="ltr"> · {b.student_email}</span>
                  </div>
                  {b.reason && <div className="text-xs mt-1 text-muted-foreground">السبب: {b.reason}</div>}
                </div>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeBlock(b.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}