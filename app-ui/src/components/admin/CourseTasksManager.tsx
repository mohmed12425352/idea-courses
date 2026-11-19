import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Pencil,
  Save,
  X,
  ClipboardList,
  Inbox,
  Download,
  Check,
  PlayCircle,
} from "lucide-react";

type Task = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  order_index: number;
  is_published: boolean;
  created_at: string;
  due_at: string | null;
  lesson_id: string | null;
};

type LessonOption = {
  id: string;
  title: string;
  module_title: string;
  module_order: number;
  order_index: number;
};

type Submission = {
  id: string;
  task_id: string;
  user_id: string;
  video_path: string | null;
  status: "pending" | "approved" | "rejected";
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  grade: number | null;
  is_late: boolean;
  student_name?: string | null;
  student_email?: string | null;
};

export function CourseTasksManager({ courseId }: { courseId: string }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Partial<Task>>({});
  const [openSubsFor, setOpenSubsFor] = useState<Task | null>(null);
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [lessonId, setLessonId] = useState<string>("");

  const loadLessons = async () => {
    const { data } = await supabase
      .from("modules")
      .select("id,title,order_index,lessons(id,title,order_index)")
      .eq("course_id", courseId)
      .order("order_index", { ascending: true });
    const opts: LessonOption[] = [];
    (data ?? []).forEach((m: any) => {
      (m.lessons ?? [])
        .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .forEach((l: any) => {
          opts.push({
            id: l.id,
            title: l.title,
            module_title: m.title,
            module_order: m.order_index ?? 0,
            order_index: l.order_index ?? 0,
          });
        });
    });
    setLessons(opts);
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("course_tasks")
      .select("*")
      .eq("course_id", courseId)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setTasks((data ?? []) as Task[]);
    setLoading(false);
  };

  useEffect(() => { load(); loadLessons(); }, [courseId]);

  const lessonLabel = (id: string | null) => {
    if (!id) return null;
    const l = lessons.find((x) => x.id === id);
    return l ? `${l.module_title} — ${l.title}` : "درس محذوف";
  };

  const add = async () => {
    if (!user) return;
    if (!title.trim()) { toast.error("اكتب عنوان التاسك"); return; }
    if (!lessonId) { toast.error("اختر السيشن/الدرس المرتبط بالتاسك"); return; }
    setBusy(true);
    const { error } = await supabase.from("course_tasks").insert({
      course_id: courseId,
      lesson_id: lessonId,
      title: title.trim(),
      description: description.trim() || null,
      order_index: tasks.length,
      is_published: true,
      created_by: user.id,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تمت إضافة التاسك");
    setTitle(""); setDescription(""); setDueAt(""); setLessonId("");
    load();
  };

  const remove = async (t: Task) => {
    if (!confirm(`حذف التاسك "${t.title}" وكل الفيديوهات المرفوعة فيه؟`)) return;
    // Best-effort cleanup of remaining videos for this task
    const { data: subs } = await supabase
      .from("task_submissions")
      .select("video_path")
      .eq("task_id", t.id);
    const paths = (subs ?? []).map((s: any) => s.video_path).filter(Boolean);
    if (paths.length) await supabase.storage.from("course-videos").remove(paths);
    const { error } = await supabase.from("course_tasks").delete().eq("id", t.id);
    if (error) toast.error(error.message);
    else { toast.success("تم الحذف"); load(); }
  };

  const togglePublish = async (t: Task) => {
    const { error } = await supabase
      .from("course_tasks")
      .update({ is_published: !t.is_published })
      .eq("id", t.id);
    if (error) toast.error(error.message); else load();
  };

  const startEdit = (t: Task) => {
    setEditingId(t.id);
    setEdit({ title: t.title, description: t.description, order_index: t.order_index, due_at: t.due_at, lesson_id: t.lesson_id });
  };
  const saveEdit = async (id: string) => {
    if (!edit.title?.trim()) { toast.error("العنوان مطلوب"); return; }
    if (!edit.lesson_id) { toast.error("اختر السيشن/الدرس المرتبط بالتاسك"); return; }
    const { error } = await supabase.from("course_tasks").update({
      title: edit.title.trim(),
      description: edit.description?.trim() || null,
      order_index: Number(edit.order_index) || 0,
      due_at: edit.due_at ? new Date(edit.due_at).toISOString() : null,
      lesson_id: edit.lesson_id,
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setEditingId(null); setEdit({}); load();
  };

  return (
    <div className="space-y-5">
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 font-semibold text-primary">
          <Plus className="h-4 w-4" /> إضافة تاسك جديد للطلاب
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>عنوان التاسك</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: صمّم لوجو مطعم" maxLength={200} />
          </div>
          <div className="sm:col-span-2">
            <Label>السيشن/الدرس المرتبط <span className="text-destructive">*</span></Label>
            <Select value={lessonId} onValueChange={setLessonId}>
              <SelectTrigger>
                <SelectValue placeholder={lessons.length ? "اختر السيشن" : "لا توجد دروس بعد — أضف درس أولاً"} />
              </SelectTrigger>
              <SelectContent>
                {lessons.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.module_title} — {l.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">التاسك هيظهر للطالب فقط لما يفتح هذه السيشن.</p>
          </div>
          <div className="sm:col-span-2">
            <Label>وصف التاسك (المطلوب من الطالب)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="اشرح المطلوب بالتفصيل…"
              rows={4}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>الميعاد النهائي (اختياري)</Label>
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={add} disabled={busy} className="bg-gold text-gold-foreground hover:bg-gold/90">
            <Plus className="h-4 w-4 ml-1" /> {busy ? "جاري الحفظ…" : "إضافة التاسك"}
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        {loading ? (
          <Card className="p-6 text-center text-muted-foreground text-sm">جاري التحميل…</Card>
        ) : tasks.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto opacity-40 mb-2" /> لا توجد تاسكات بعد
          </Card>
        ) : (
          tasks.map((t) => (
            <Card key={t.id} className="p-4 space-y-3">
              {editingId === t.id ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <Label>العنوان</Label>
                    <Input value={edit.title ?? ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>السيشن/الدرس المرتبط</Label>
                    <Select value={edit.lesson_id ?? ""} onValueChange={(v) => setEdit({ ...edit, lesson_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر السيشن" />
                      </SelectTrigger>
                      <SelectContent>
                        {lessons.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.module_title} — {l.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label>الوصف</Label>
                    <Textarea value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} rows={4} />
                  </div>
                  <div>
                    <Label>الترتيب</Label>
                    <Input type="number" value={edit.order_index ?? 0} onChange={(e) => setEdit({ ...edit, order_index: Number(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label>الميعاد النهائي</Label>
                    <Input
                      type="datetime-local"
                      value={edit.due_at ? new Date(edit.due_at).toISOString().slice(0, 16) : ""}
                      onChange={(e) => setEdit({ ...edit, due_at: e.target.value || null })}
                    />
                  </div>
                  <div className="sm:col-span-2 flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEdit({}); }}>
                      <X className="h-4 w-4 ml-1" /> إلغاء
                    </Button>
                    <Button size="sm" onClick={() => saveEdit(t.id)} className="bg-gold text-gold-foreground hover:bg-gold/90">
                      <Save className="h-4 w-4 ml-1" /> حفظ
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-bold text-primary">{t.title}</div>
                      {!t.is_published && <Badge variant="secondary" className="text-[10px]">غير منشور</Badge>}
                    </div>
                    {t.description && (
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{t.description}</p>
                    )}
                    <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-2">
                      <span>ترتيب: {t.order_index}</span>
                      <span>السيشن: {lessonLabel(t.lesson_id) ?? "— غير مرتبط —"}</span>
                      {t.due_at && (
                        <span>الميعاد النهائي: {new Date(t.due_at).toLocaleString("ar-EG")}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">منشور</span>
                      <Switch checked={t.is_published} onCheckedChange={() => togglePublish(t)} />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setOpenSubsFor(t)}>
                      <Inbox className="h-4 w-4 ml-1" /> التسليمات
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => startEdit(t)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(t)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      <Dialog open={!!openSubsFor} onOpenChange={(o) => !o && setOpenSubsFor(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-right">تسليمات: {openSubsFor?.title}</DialogTitle>
          </DialogHeader>
          {openSubsFor && <SubmissionsList taskId={openSubsFor.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SubmissionsList({ taskId }: { taskId: string }) {
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("task_submissions")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });
    const list = (data ?? []) as Submission[];
    const userIds = Array.from(new Set(list.map((s) => s.user_id)));
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,name,email")
        .in("id", userIds);
      const map = new Map<string, any>((profs ?? []).map((p: any) => [p.id, p]));
      list.forEach((s) => {
        const p = map.get(s.user_id);
        s.student_name = p?.name ?? null;
        s.student_email = p?.email ?? null;
      });
    }
    setSubs(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, [taskId]);

  if (loading) return <div className="text-center text-sm text-muted-foreground py-6">جاري التحميل…</div>;
  if (subs.length === 0) return <div className="text-center text-sm text-muted-foreground py-6">لا توجد تسليمات بعد.</div>;

  return (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
      {subs.map((s) => (
        <SubmissionRow key={s.id} submission={s} onChanged={load} />
      ))}
    </div>
  );
}

function SubmissionRow({ submission, onChanged }: { submission: Submission; onChanged: () => void }) {
  const [notes, setNotes] = useState(submission.admin_notes ?? "");
  const [grade, setGrade] = useState<string>(submission.grade?.toString() ?? "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);

  const ensureSignedUrl = async (): Promise<string | null> => {
    if (!submission.video_path) return null;
    const { data, error } = await supabase.storage
      .from("course-videos")
      .createSignedUrl(submission.video_path, 60 * 60);
    if (error) { toast.error(error.message); return null; }
    return data.signedUrl;
  };

  const play = async () => {
    const url = await ensureSignedUrl();
    if (!url) return;
    setPreviewUrl(url);
    setShowPlayer(true);
  };

  const download = async () => {
    const url = await ensureSignedUrl();
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      const ext = submission.video_path?.split(".").pop() || "mp4";
      a.download = `task-${submission.id}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 1500);
      toast.success("تم تحميل الفيديو");
    } catch {
      window.open(url, "_blank");
    }
  };

  const decide = async (status: "approved" | "rejected") => {
    if (status === "approved" && submission.video_path) {
      if (!confirm("بعد الموافقة هيتم حذف الفيديو من السيرفر نهائياً. متأكد إنك حمّلت نسخة عندك؟")) return;
    }
    const gradeNum = grade.trim() === "" ? null : Math.max(0, Math.min(100, Number(grade)));
    if (gradeNum !== null && Number.isNaN(gradeNum)) { toast.error("درجة غير صحيحة"); return; }
    setBusy(true);
    let pathToClear = submission.video_path;
    if (status === "approved" && pathToClear) {
      const { error: rmErr } = await supabase.storage.from("course-videos").remove([pathToClear]);
      if (rmErr) {
        setBusy(false);
        toast.error("فشل حذف الفيديو: " + rmErr.message);
        return;
      }
    }
    const { error } = await supabase
      .from("task_submissions")
      .update({
        status,
        admin_notes: notes.trim() || null,
        grade: gradeNum,
        reviewed_at: new Date().toISOString(),
        video_path: status === "approved" ? null : submission.video_path,
      })
      .eq("id", submission.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(status === "approved" ? "تمت الموافقة وحذف الفيديو" : "تم الرفض");
      onChanged();
    }
  };

  const saveNotesOnly = async () => {
    const gradeNum = grade.trim() === "" ? null : Math.max(0, Math.min(100, Number(grade)));
    if (gradeNum !== null && Number.isNaN(gradeNum)) { toast.error("درجة غير صحيحة"); return; }
    setBusy(true);
    const { error } = await supabase
      .from("task_submissions")
      .update({ admin_notes: notes.trim() || null, grade: gradeNum })
      .eq("id", submission.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("تم الحفظ");
  };

  const statusBadge =
    submission.status === "approved" ? (
      <Badge className="bg-success/20 text-success">تمت الموافقة</Badge>
    ) : submission.status === "rejected" ? (
      <Badge className="bg-destructive/20 text-destructive">مرفوض</Badge>
    ) : (
      <Badge variant="secondary">قيد المراجعة</Badge>
    );

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-primary">{submission.student_name || "طالب"}</div>
          <div className="text-xs text-muted-foreground" dir="ltr">{submission.student_email}</div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {new Date(submission.created_at).toLocaleString("ar-EG")}
          </div>
        </div>
        <div className="flex flex-wrap gap-1 items-center">
          {submission.is_late && <Badge className="bg-orange-500/20 text-orange-600">متأخر</Badge>}
          {submission.grade !== null && submission.grade !== undefined && (
            <Badge className="bg-primary/15 text-primary">الدرجة: {submission.grade}/100</Badge>
          )}
          {statusBadge}
        </div>
      </div>

      {submission.video_path ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={play}>
            <PlayCircle className="h-4 w-4 ml-1" /> مشاهدة
          </Button>
          <Button size="sm" variant="outline" onClick={download}>
            <Download className="h-4 w-4 ml-1" /> تحميل
          </Button>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          {submission.status === "approved"
            ? "تم حذف الفيديو بعد الموافقة."
            : "لا يوجد فيديو مرفق."}
        </div>
      )}

      <div>
        <Label className="text-xs">ملاحظات للطالب</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="اكتب ملاحظاتك على الشغل…"
        />
      </div>
      <div>
        <Label className="text-xs">الدرجة (0 – 100)</Label>
        <Input
          type="number"
          min={0}
          max={100}
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          placeholder="اختياري"
          className="max-w-[140px]"
        />
      </div>
      <div className="flex flex-wrap gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={saveNotesOnly} disabled={busy}>
          حفظ الملاحظات/الدرجة
        </Button>
        {submission.status !== "rejected" && (
          <Button size="sm" variant="outline" className="text-destructive" onClick={() => decide("rejected")} disabled={busy}>
            <X className="h-4 w-4 ml-1" /> رفض
          </Button>
        )}
        {submission.status !== "approved" && (
          <Button size="sm" onClick={() => decide("approved")} disabled={busy} className="bg-gold text-gold-foreground hover:bg-gold/90">
            <Check className="h-4 w-4 ml-1" /> موافقة وحذف الفيديو
          </Button>
        )}
      </div>

      <Dialog open={showPlayer} onOpenChange={(o) => { setShowPlayer(o); if (!o) setPreviewUrl(null); }}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle className="text-right">معاينة فيديو الطالب</DialogTitle>
          </DialogHeader>
          <div className="relative w-full aspect-video bg-black">
            {previewUrl && (
              <video src={previewUrl} controls className="absolute inset-0 w-full h-full" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
