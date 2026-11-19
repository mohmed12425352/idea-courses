import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ClipboardList, Upload, CheckCircle2, Clock, AlertCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

type Task = {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  due_at: string | null;
  lesson_id: string | null;
};

type Submission = {
  id: string;
  task_id: string;
  video_path: string | null;
  status: "pending" | "approved" | "rejected";
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  grade: number | null;
  is_late: boolean;
};

export function StudentTasksPanel({ courseId, lessonId }: { courseId: string; lessonId?: string | null }) {
  const { user } = useAuth();
  const { isEn } = useI18n();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subs, setSubs] = useState<Record<string, Submission | undefined>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("course_tasks")
      .select("id,title,description,order_index,due_at,lesson_id")
      .eq("course_id", courseId)
      .eq("is_published", true)
      .order("order_index", { ascending: true });
    if (lessonId) query = query.eq("lesson_id", lessonId);
    else query = query.is("lesson_id", null);
    const { data: ts } = await query;
    const list = (ts ?? []) as Task[];
    setTasks(list);
    if (list.length) {
      const ids = list.map((t) => t.id);
      const { data: ss } = await supabase
        .from("task_submissions")
        .select("*")
        .in("task_id", ids)
        .order("created_at", { ascending: false });
      const map: Record<string, Submission> = {};
      (ss ?? []).forEach((s: any) => { if (!map[s.task_id]) map[s.task_id] = s as Submission; });
      setSubs(map);
    } else {
      setSubs({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [courseId, lessonId]);

  // Realtime: refresh when this user's submissions change (approve/reject/new)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`task-subs-${user.id}-${lessonId ?? "any"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_submissions", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, courseId, lessonId]);

  if (loading) return null;
  if (tasks.length === 0) return null;

  const total = tasks.length;
  const approved = tasks.filter((t) => subs[t.id]?.status === "approved").length;
  const pending = tasks.filter((t) => subs[t.id]?.status === "pending").length;
  const percent = total > 0 ? Math.round((approved / total) * 100) : 0;

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 bg-gold/10 border-b space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="font-semibold text-sm flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-gold" /> {isEn ? `Tasks for this session (${total})` : `تاسكات هذه السيشن (${total})`}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="font-bold text-primary">{approved}/{total}</span>
            <span>{isEn ? "completed" : "مكتمل"}</span>
            {pending > 0 && (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <Clock className="h-3 w-3" /> {isEn ? `${pending} under review` : `${pending} قيد المراجعة`}
              </Badge>
            )}
            <span className="font-bold text-gold">{percent}%</span>
          </div>
        </div>
        <Progress value={percent} className="h-2" />
      </div>
      <div className="divide-y">
        {tasks.map((t) => (
          <TaskItem key={t.id} task={t} submission={subs[t.id]} onChanged={load} />
        ))}
      </div>
    </Card>
  );
}

function TaskItem({
  task,
  submission,
  onChanged,
}: {
  task: Task;
  submission: Submission | undefined;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const { isEn } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!task.due_at) return;
    const t = setInterval(() => setNow(Date.now()), 1000 * 30);
    return () => clearInterval(t);
  }, [task.due_at]);

  const dueMs = task.due_at ? new Date(task.due_at).getTime() : null;
  const remaining = dueMs ? dueMs - now : null;
  const isOverdue = remaining !== null && remaining <= 0;
  const countdown = (() => {
    if (remaining === null) return null;
    const abs = Math.abs(remaining);
    const d = Math.floor(abs / 86400000);
    const h = Math.floor((abs % 86400000) / 3600000);
    const m = Math.floor((abs % 3600000) / 60000);
    if (d > 0) return isEn ? `${d}d and ${h}h` : `${d} يوم و ${h} ساعة`;
    if (h > 0) return isEn ? `${h}h and ${m}m` : `${h} ساعة و ${m} دقيقة`;
    return isEn ? `${m}m` : `${m} دقيقة`;
  })();

  const statusUI =
    submission?.status === "approved" ? (
      <Badge className="bg-success/20 text-success gap-1"><CheckCircle2 className="h-3 w-3" /> {isEn ? "Approved" : "تمت الموافقة"}</Badge>
    ) : submission?.status === "rejected" ? (
      <Badge className="bg-destructive/20 text-destructive gap-1"><AlertCircle className="h-3 w-3" /> {isEn ? "Rejected — re-upload" : "مرفوض — أعد الرفع"}</Badge>
    ) : submission ? (
      <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> {isEn ? "Under Review" : "قيد المراجعة"}</Badge>
    ) : null;

  const canUpload =
    !submission ||
    submission.status === "rejected" ||
    (submission.status === "pending" && !submission.video_path);

  const upload = async (selectedFile?: File) => {
    const targetFile = selectedFile ?? file;
    if (!user) { toast.error(isEn ? "Please sign in" : "سجّل الدخول"); return; }
    if (!targetFile) { toast.error(isEn ? "Select a video" : "اختر فيديو"); return; }
    if (targetFile.size > 500 * 1024 * 1024) { toast.error(isEn ? "Maximum size 500MB" : "الحد الأقصى 500 ميجا"); return; }
    setUploading(true);
    setProgress(10);
    try {
      const ext = targetFile.name.split(".").pop() || "mp4";
      const path = `task-submissions/${task.id}/${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("course-videos")
        .upload(path, targetFile, { contentType: targetFile.type, upsert: false });
      if (upErr) throw upErr;
      setProgress(80);
      if (submission && (submission.status === "rejected" || submission.status === "pending")) {
        // If existing rejected/pending submission, replace its video and reset to pending
        if (submission.video_path) {
          await supabase.storage.from("course-videos").remove([submission.video_path]);
        }
        const { error } = await supabase
          .from("task_submissions")
          .update({
            video_path: path,
            status: "pending",
            admin_notes: null,
            reviewed_at: null,
          })
          .eq("id", submission.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("task_submissions").insert({
          task_id: task.id,
          user_id: user.id,
          video_path: path,
          status: "pending",
        });
        if (error) {
          // clean up uploaded file on row insert failure
          await supabase.storage.from("course-videos").remove([path]);
          throw error;
        }
      }
      setProgress(100);
      toast.success(isEn ? "Video submitted, awaiting review" : "تم إرسال الفيديو، في انتظار المراجعة");
      setFile(null);
      onChanged();
    } catch (e: any) {
      toast.error(e.message || (isEn ? "Upload failed" : "فشل الإرسال"));
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 800);
    }
  };

  const removeMine = async () => {
    if (!submission || submission.status !== "pending") return;
    if (!confirm(isEn ? "Withdraw submission and delete video?" : "سحب التسليم وحذف الفيديو؟")) return;
    if (submission.video_path) {
      await supabase.storage.from("course-videos").remove([submission.video_path]);
    }
    const { error } = await supabase.from("task_submissions").delete().eq("id", submission.id);
    if (error) toast.error(error.message);
    else { toast.success(isEn ? "Deleted" : "تم الحذف"); onChanged(); }
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-primary">{task.title}</h4>
          {task.description && (
            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{task.description}</p>
          )}
          {task.due_at && (
            <div className="text-xs mt-2 flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">
                {isEn ? "Deadline: " : "الميعاد النهائي: "}{new Date(task.due_at).toLocaleString(isEn ? "en-GB" : "ar-EG")}
              </span>
              {!submission && (
                isOverdue ? (
                  <Badge className="bg-destructive/20 text-destructive">{isEn ? `Deadline passed ${countdown} ago` : `انتهى الميعاد منذ ${countdown}`}</Badge>
                ) : (
                  <Badge className="bg-gold/20 text-gold-foreground">{isEn ? `${countdown} remaining` : `باقي ${countdown}`}</Badge>
                )
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1 items-center">
          {submission?.is_late && <Badge className="bg-orange-500/20 text-orange-600">{isEn ? "Late" : "متأخر"}</Badge>}
          {submission?.grade !== null && submission?.grade !== undefined && (
            <Badge className="bg-primary/15 text-primary">{isEn ? `Grade: ${submission.grade}/100` : `الدرجة: ${submission.grade}/100`}</Badge>
          )}
          {statusUI}
        </div>
      </div>

      {submission?.admin_notes && (
        <div className="rounded-lg bg-secondary/40 border p-3 text-sm">
          <div className="text-xs font-semibold text-primary mb-1">{isEn ? "Instructor Notes" : "ملاحظات المدرّب"}</div>
          <p className="whitespace-pre-line">{submission.admin_notes}</p>
        </div>
      )}

      {canUpload && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="file"
            accept="video/*"
            onChange={(e) => {
              const selected = e.target.files?.[0] ?? null;
              setFile(selected);
              if (selected) upload(selected);
            }}
            className="max-w-xs"
          />
          <Button
            size="sm"
            onClick={() => upload()}
            disabled={uploading || !file}
            className="bg-gold text-gold-foreground hover:bg-gold/90"
          >
            <Upload className="h-4 w-4 ml-1" /> {uploading ? (isEn ? "Sending..." : "جاري الإرسال…") : submission ? (isEn ? "Re-upload" : "إعادة الإرسال") : (isEn ? "Upload Video" : "إرسال الفيديو")}
          </Button>
          {submission?.status === "pending" && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={removeMine}>
              <Trash2 className="h-4 w-4 ml-1" /> {isEn ? "Withdraw" : "سحب"}
            </Button>
          )}
        </div>
      )}
      {uploading && <Progress value={progress} className="h-1.5" />}

      {!canUpload && submission?.status === "pending" && submission.video_path && (
        <div className="text-xs text-muted-foreground">
          {isEn ? "Your video was uploaded, awaiting instructor review." : "تم رفع فيديوك، في انتظار مراجعة المدرّب."}
          <Button size="sm" variant="ghost" className="text-destructive mr-2 h-6 px-2 text-xs" onClick={removeMine}>
            {isEn ? "Withdraw" : "سحب"}
          </Button>
        </div>
      )}
    </div>
  );
}
