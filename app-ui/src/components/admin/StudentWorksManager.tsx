import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Trash2,
  Upload,
  Plus,
  Film,
  Pencil,
  X,
  Check,
  Play,
  PlayCircle,
  ArrowUp,
  ArrowDown,
  Search,
  AlertTriangle,
  ExternalLink,
  Eye,
  EyeOff,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { createBunnyTusUpload } from "@/lib/bunny.functions";
import * as tus from "tus-js-client";
import { Progress } from "@/components/ui/progress";
import { SecurePlayer } from "@/components/common/SecurePlayer";

type Work = {
  id: string;
  title: string;
  student_name: string | null;
  video_url: string;
  thumbnail_url: string | null;
  order_index: number;
  is_published: boolean;
  created_at: string;
  course_id: string | null;
};

type Course = { id: string; title: string };

function resolveEmbedUrl(input: string): string {
  if (!input) return input;
  const m = input.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  return m ? m[1] : input.trim();
}

function youtubeThumb(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}

function bunnyThumb(url: string): string | null {
  const m = url.match(/mediadelivery\.net\/(?:embed|play)\/(\d+)\/([a-f0-9-]{8,})/i);
  if (!m) return null;
  return `https://vz-${m[1]}.b-cdn.net/${m[2]}/thumbnail.jpg`;
}

function isVideoUrl(url: string): boolean {
  const u = url.toLowerCase();
  return /<iframe|youtube\.com|youtu\.be|vimeo\.com|drive\.google\.com|mediadelivery\.net|iframe\.|player\.|\/embed\/|\.mp4($|\?)|\.webm($|\?)|\.mov($|\?)|\.mkv($|\?)|\.m3u8($|\?)/.test(u);
}

function websiteScreenshot(url: string): string {
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=800&h=500`;
}

function getWorkThumbnail(w: { video_url: string; thumbnail_url?: string | null }): string | null {
  if (w.thumbnail_url) return w.thumbnail_url;
  const resolved = resolveEmbedUrl(w.video_url || "");
  if (!isVideoUrl(resolved)) return websiteScreenshot(resolved);
  return youtubeThumb(resolved) || bunnyThumb(resolved) || null;
}

export function StudentWorksManager({ lockedCourseId }: { lockedCourseId?: string } = {}) {
  const { user } = useAuth();
  const [works, setWorks] = useState<Work[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState("");
  const [studentName, setStudentName] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [order, setOrder] = useState(0);
  const [courseId, setCourseId] = useState<string>(lockedCourseId ?? "__none__");
  const [file, setFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const createTusUpload = useServerFn(createBunnyTusUpload);

  // Filter & Search & View controls
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "hidden">("all");
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Video preview dialog inside admin
  const [previewWork, setPreviewWork] = useState<Work | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Partial<Work>>({});

  const load = async () => {
    setLoading(true);
    let q = supabase.from("student_works").select("*");
    if (lockedCourseId) q = q.eq("course_id", lockedCourseId);
    const [{ data }, { data: cs }] = await Promise.all([
      q.order("order_index", { ascending: true }).order("created_at", { ascending: false }),
      supabase.from("courses").select("id,title").order("title"),
    ]);
    setWorks((data ?? []) as Work[]);
    setCourses((cs ?? []) as Course[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [lockedCourseId]);

  // Generate thumbnail from video file
  const generateThumbFromVideo = (videoFile: File): Promise<Blob | null> =>
    new Promise((resolve) => {
      try {
        const url = URL.createObjectURL(videoFile);
        const v = document.createElement("video");
        v.preload = "metadata";
        v.muted = true;
        v.playsInline = true;
        v.crossOrigin = "anonymous";
        v.src = url;
        const cleanup = () => URL.revokeObjectURL(url);
        v.onloadedmetadata = () => {
          try { v.currentTime = Math.min(1, (v.duration || 2) / 2); } catch { /* ignore */ }
        };
        v.onseeked = () => {
          try {
            const canvas = document.createElement("canvas");
            const w = v.videoWidth || 1280;
            const h = v.videoHeight || 720;
            const maxW = 1280;
            const scale = Math.min(1, maxW / w);
            canvas.width = Math.round(w * scale);
            canvas.height = Math.round(h * scale);
            const ctx = canvas.getContext("2d");
            if (!ctx) { cleanup(); resolve(null); return; }
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((b) => { cleanup(); resolve(b); }, "image/jpeg", 0.85);
          } catch { cleanup(); resolve(null); }
        };
        v.onerror = () => { cleanup(); resolve(null); };
      } catch { resolve(null); }
    });

  // Calculate duplicates by normalized title
  const duplicateMap = useMemo(() => {
    const map = new Map<string, Work[]>();
    works.forEach((w) => {
      const norm = (w.title || "").trim().toLowerCase();
      if (!norm) return;
      const list = map.get(norm) ?? [];
      list.push(w);
      map.set(norm, list);
    });
    return map;
  }, [works]);

  const duplicateGroups = useMemo(() => {
    return Array.from(duplicateMap.entries()).filter(([, list]) => list.length > 1);
  }, [duplicateMap]);

  const totalDuplicateWorksCount = useMemo(() => {
    return duplicateGroups.reduce((acc, [, list]) => acc + list.length, 0);
  }, [duplicateGroups]);

  // Check if current add-title matches existing titles
  const isTitleDuplicate = useMemo(() => {
    const norm = title.trim().toLowerCase();
    if (!norm) return false;
    return (duplicateMap.get(norm)?.length ?? 0) > 0;
  }, [title, duplicateMap]);

  // Submit new work
  const submit = async () => {
    if (!user) return;
    if (!title.trim()) { toast.error("اكتب عنوان للفيديو"); return; }
    if (!videoUrl.trim() && !file) { toast.error("ارفع فيديو أو ضع لينك"); return; }
    setBusy(true);
    try {
      let finalUrl = resolveEmbedUrl(videoUrl.trim());
      let finalThumb: string | null = null;
      if (file) {
        if (file.size > 5 * 1024 * 1024 * 1024) throw new Error("حجم الفيديو يتجاوز 5 جيجا");
        setUploading(true); setProgress(0);
        const creds = await createTusUpload({ data: { title: title.trim() || file.name } });
        await new Promise<void>((resolve, reject) => {
          const upload = new tus.Upload(file, {
            endpoint: creds.endpoint,
            retryDelays: [0, 1000, 3000, 5000, 10000],
            chunkSize: 50 * 1024 * 1024,
            headers: {
              AuthorizationSignature: creds.authorizationSignature,
              AuthorizationExpire: String(creds.authorizationExpire),
              VideoId: creds.videoId,
              LibraryId: creds.libraryId,
            },
            metadata: { filetype: file.type, title: title.trim() || file.name },
            onError: (err) => reject(err),
            onProgress: (sent, total) => { if (total > 0) setProgress(Math.round((sent / total) * 100)); },
            onSuccess: () => resolve(),
          });
          upload.start();
        });
        finalUrl = creds.iframeUrl;
        setUploading(false); setProgress(0);
      }

      if (thumbFile) {
        const ext = thumbFile.name.split(".").pop() || "jpg";
        const thumbPath = `student-works/thumbs/${crypto.randomUUID()}.${ext}`;
        const { error: tErr } = await supabase.storage
          .from("course-assets")
          .upload(thumbPath, thumbFile, { contentType: thumbFile.type, upsert: false });
        if (tErr) throw tErr;
        finalThumb = supabase.storage.from("course-assets").getPublicUrl(thumbPath).data.publicUrl;
      } else if (file) {
        try {
          const blob = await generateThumbFromVideo(file);
          if (blob) {
            const thumbPath = `student-works/thumbs/${crypto.randomUUID()}.jpg`;
            const { error: tErr } = await supabase.storage
              .from("course-assets")
              .upload(thumbPath, blob, { contentType: "image/jpeg", upsert: false });
            if (!tErr) {
              finalThumb = supabase.storage.from("course-assets").getPublicUrl(thumbPath).data.publicUrl;
            }
          }
        } catch { /* ignore */ }
      }

      const { error } = await supabase.from("student_works").insert({
        title: title.trim(),
        student_name: studentName.trim() || null,
        video_url: finalUrl,
        thumbnail_url: finalThumb,
        order_index: order,
        is_published: true,
        created_by: user.id,
        course_id: courseId === "__none__" ? null : courseId,
      });
      if (error) throw error;
      toast.success("تمت إضافة عمل الطالب بنجاح!");
      setTitle(""); setStudentName(""); setVideoUrl(""); setOrder(0); setFile(null); setThumbFile(null); setThumbPreview(null);
      setCourseId(lockedCourseId ?? "__none__");
      setShowAddForm(false);
      await load();
    } catch (e: any) {
      toast.error(e.message || "تعذر الحفظ");
    } finally {
      setBusy(false);
      setUploading(false);
    }
  };

  const togglePublish = async (w: Work) => {
    const nextState = !w.is_published;
    setWorks((prev) => prev.map((x) => (x.id === w.id ? { ...x, is_published: nextState } : x)));
    const { error } = await supabase.from("student_works").update({ is_published: nextState }).eq("id", w.id);
    if (error) {
      toast.error(error.message);
      load();
    } else {
      toast.success(nextState ? "تم تفعيل النشر للزوار" : "تم إخفاء العمل عن الزوار");
    }
  };

  const remove = async (w: Work) => {
    if (!confirm(`متأكد من حذف العمل "${w.title}" نهائياً؟`)) return;
    setWorks((prev) => prev.filter((x) => x.id !== w.id));
    const { error } = await supabase.from("student_works").delete().eq("id", w.id);
    if (error) {
      toast.error(error.message);
      load();
    } else {
      toast.success("تم حذف العمل بنجاح");
    }
  };

  // Reorder up/down
  const moveWork = async (w: Work, direction: "up" | "down") => {
    const list = [...filteredWorks];
    const currentIndex = list.findIndex((item) => item.id === w.id);
    if (currentIndex < 0) return;
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const targetWork = list[targetIndex];
    let newCurrentOrder = targetWork.order_index;
    let newTargetOrder = w.order_index;
    if (newCurrentOrder === newTargetOrder) {
      newCurrentOrder = direction === "up" ? Math.max(0, targetWork.order_index - 1) : targetWork.order_index + 1;
    }

    setWorks((prev) =>
      prev.map((item) => {
        if (item.id === w.id) return { ...item, order_index: newCurrentOrder };
        if (item.id === targetWork.id) return { ...item, order_index: newTargetOrder };
        return item;
      }).sort((a, b) => a.order_index - b.order_index)
    );

    try {
      await Promise.all([
        supabase.from("student_works").update({ order_index: newCurrentOrder }).eq("id", w.id),
        supabase.from("student_works").update({ order_index: newTargetOrder }).eq("id", targetWork.id),
      ]);
      toast.success("تم تحديث الترتيب");
    } catch {
      toast.error("تعذر حفظ الترتيب");
      load();
    }
  };

  const saveWorkOrder = async (w: Work, newOrder: number) => {
    if (w.order_index === newOrder) return;
    const { error } = await supabase.from("student_works").update({ order_index: newOrder }).eq("id", w.id);
    if (error) toast.error("تعذر حفظ الترتيب");
    else {
      toast.success("تم تحديث رقم الترتيب");
      setWorks((prev) =>
        prev.map((x) => (x.id === w.id ? { ...x, order_index: newOrder } : x)).sort((a, b) => a.order_index - b.order_index)
      );
    }
  };

  // One-click unpublish duplicate copies so visitors see each name only once
  const unpublishDuplicates = async () => {
    if (duplicateGroups.length === 0) return;
    const extraCount = totalDuplicateWorksCount - duplicateGroups.length;
    if (!confirm(`سيتم إبقاء أول نسخة منشورة لكل عنوان، وإخفاء باقي النسخ المكررة (${extraCount} فيديو) لكي لا تتكرر أمام الزوار. هل تود المتابعة؟`)) return;

    setBusy(true);
    try {
      const idsToUnpublish: string[] = [];
      for (const [, list] of duplicateGroups) {
        const sorted = [...list].sort((a, b) => a.order_index - b.order_index);
        for (let i = 1; i < sorted.length; i++) {
          if (sorted[i].is_published) {
            idsToUnpublish.push(sorted[i].id);
          }
        }
      }

      if (idsToUnpublish.length === 0) {
        toast.info("النسخ المكررة مخفية بالفعل من قبل.");
        setBusy(false);
        return;
      }

      const { error } = await supabase
        .from("student_works")
        .update({ is_published: false })
        .in("id", idsToUnpublish);

      if (error) throw error;
      toast.success(`تم إخفاء ${idsToUnpublish.length} فيديو مكرر بنجاح! الآن لن يظهر للزوار سوى فيديو واحد فريد لكل اسم.`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "تعذر إخفاء المكررات");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (w: Work) => {
    setEditingId(w.id);
    setEdit({
      title: w.title,
      student_name: w.student_name,
      video_url: w.video_url,
      thumbnail_url: w.thumbnail_url,
      order_index: w.order_index,
      course_id: w.course_id,
      is_published: w.is_published,
    });
  };

  const saveEdit = async (id: string) => {
    if (!edit.title?.trim()) { toast.error("العنوان مطلوب"); return; }
    const { error } = await supabase.from("student_works").update({
      title: edit.title?.trim(),
      student_name: edit.student_name?.trim() || null,
      video_url: resolveEmbedUrl(edit.video_url?.trim() || ""),
      thumbnail_url: edit.thumbnail_url?.trim() || null,
      order_index: Number(edit.order_index) || 0,
      course_id: edit.course_id || null,
      is_published: edit.is_published ?? true,
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم تحديث بيانات العمل");
    setEditingId(null); setEdit({});
    load();
  };

  // Filter works based on search, course, status, and duplicates
  const filteredWorks = useMemo(() => {
    return works.filter((w) => {
      // Search
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchTitle = (w.title || "").toLowerCase().includes(q);
        const matchStudent = (w.student_name || "").toLowerCase().includes(q);
        const matchUrl = (w.video_url || "").toLowerCase().includes(q);
        if (!matchTitle && !matchStudent && !matchUrl) return false;
      }
      // Course filter
      if (courseFilter === "none" && w.course_id !== null) return false;
      if (courseFilter !== "all" && courseFilter !== "none" && w.course_id !== courseFilter) return false;
      // Status filter
      if (statusFilter === "published" && !w.is_published) return false;
      if (statusFilter === "hidden" && w.is_published) return false;
      // Duplicates only
      if (duplicatesOnly) {
        const norm = (w.title || "").trim().toLowerCase();
        if ((duplicateMap.get(norm)?.length ?? 0) <= 1) return false;
      }
      return true;
    });
  }, [works, search, courseFilter, statusFilter, duplicatesOnly, duplicateMap]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Stats & Duplicate Warning */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 bg-card/60 border-border/80 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground font-medium">إجمالي الأعمال</div>
            <div className="text-2xl font-extrabold text-primary">{works.length}</div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <Film className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 bg-card/60 border-border/80 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground font-medium">منشور للزوار</div>
            <div className="text-2xl font-extrabold text-emerald-500">
              {works.filter((w) => w.is_published).length}
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 grid place-items-center">
            <Eye className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 bg-card/60 border-border/80 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground font-medium">مخفي عن الزوار</div>
            <div className="text-2xl font-extrabold text-slate-400">
              {works.filter((w) => !w.is_published).length}
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-slate-500/10 text-slate-400 grid place-items-center">
            <EyeOff className="h-5 w-5" />
          </div>
        </Card>

        <Card className={`p-4 border-border/80 flex items-center justify-between ${totalDuplicateWorksCount > 0 ? "bg-amber-500/10 border-amber-500/30" : "bg-card/60"}`}>
          <div>
            <div className="text-xs text-muted-foreground font-medium">عناوين مكررة</div>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-extrabold ${totalDuplicateWorksCount > 0 ? "text-amber-500" : "text-muted-foreground"}`}>
                {totalDuplicateWorksCount}
              </span>
              {totalDuplicateWorksCount > 0 && (
                <span className="text-[11px] text-amber-500 font-bold bg-amber-500/20 px-1.5 py-0.5 rounded">
                  {duplicateGroups.length} مجموعات
                </span>
              )}
            </div>
          </div>
          <div className={`h-10 w-10 rounded-xl grid place-items-center ${totalDuplicateWorksCount > 0 ? "bg-amber-500/20 text-amber-500" : "bg-muted text-muted-foreground"}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* Duplicate Alert & Quick Clean Action */}
      {duplicateGroups.length > 0 && (
        <Card className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-primary">
                  تم رصد {totalDuplicateWorksCount} فيديوهات تتشارك نفس الاسم ({duplicateGroups.map(([t, list]) => `"${t}" (${list.length})`).slice(0, 3).join("، ")}{duplicateGroups.length > 3 ? "..." : ""})
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  المنصة في الصفحة العامة تمنع تكرار نفس الاسم تلقائياً للزوار، لكن يمكنك أيضاً إخفاء النسخ المكررة بنقرة واحدة لترتيب اللوحة.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant={duplicatesOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setDuplicatesOnly(!duplicatesOnly)}
                className="text-xs"
              >
                {duplicatesOnly ? "عرض كل الأعمال" : "فلترة المكررات فقط"}
              </Button>
              <Button
                size="sm"
                variant="default"
                disabled={busy}
                onClick={unpublishDuplicates}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
              >
                إخفاء النسخ المكررة للزوار
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Add Work Header & Expandable Form */}
      <Card className="overflow-hidden border-border/80 shadow-sm">
        <div
          onClick={() => setShowAddForm(!showAddForm)}
          className="p-4 bg-card hover:bg-muted/40 cursor-pointer transition-colors flex items-center justify-between select-none"
        >
          <div className="flex items-center gap-2.5 font-bold text-primary">
            <div className="h-8 w-8 rounded-lg bg-gold/15 text-gold grid place-items-center">
              <Plus className="h-4 w-4" />
            </div>
            <span>إضافة عمل طالب جديد (فيديو / رابط / ملف)</span>
          </div>
          <Button size="sm" variant="ghost" className="gap-1 text-xs">
            {showAddForm ? <>إغلاق النموذج <ChevronUp className="h-4 w-4" /></> : <>فتح النموذج <ChevronDown className="h-4 w-4" /></>}
          </Button>
        </div>

        {showAddForm && (
          <div className="p-5 border-t border-border/60 bg-muted/20 space-y-4 animate-in fade-in-50 duration-200">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5">
                  عنوان العمل <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: استايل كرتوني 3D، قصة أنيميشن، إعلان موشن..."
                  maxLength={150}
                  className={isTitleDuplicate ? "border-amber-500 focus-visible:ring-amber-500/20" : ""}
                />
                {isTitleDuplicate && (
                  <div className="flex items-center gap-1 text-xs text-amber-500 mt-1.5 font-medium">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>تنبيه: يوجد فيديو مسبقاً يحمل نفس هذا الاسم ("{title}"). يفضل كتابة اسم مميز لتفادي التكرار أمام الزوار.</span>
                  </div>
                )}
              </div>

              <div>
                <Label className="mb-1.5 block">اسم الطالب أو المصمم (اختياري)</Label>
                <Input
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="مثال: أحمد محمد، سارة خالد..."
                  maxLength={100}
                />
              </div>

              <div className="sm:col-span-2">
                <Label className="mb-1.5 block">
                  رابط الفيديو أو الموقع (Bunny / يوتيوب / فيميو / كود &lt;iframe&gt; / لينك موقع)
                </Label>
                <Input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder='https://iframe.mediadelivery.net/play/... أو https://youtube.com/... أو كود <iframe>'
                  dir="ltr"
                />
              </div>

              <div className="sm:col-span-2 rounded-xl border border-dashed border-border p-4 bg-background/50 space-y-2">
                <Label className="font-semibold block">أو ارفع ملف فيديو مباشرة من جهازك (رفع آمن إلى سيرفر الأكاديمية Bunny):</Label>
                <Input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const selected = e.target.files?.[0] ?? null;
                    setFile(selected);
                  }}
                />
                {file && (
                  <div className="text-xs text-emerald-500 font-semibold flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> تم اختيار ملف: {file.name} ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                  </div>
                )}
                {uploading && (
                  <div className="mt-2 space-y-1">
                    <Progress value={progress} className="h-2" />
                    <div className="text-xs text-muted-foreground">جاري الرفع على السيرفر… {progress}%</div>
                  </div>
                )}
              </div>

              <div>
                <Label className="mb-1.5 block">صورة الغلاف / المصغّرة (اختياري - يتم استخراجها تلقائياً)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setThumbFile(f);
                    if (f) setThumbPreview(URL.createObjectURL(f));
                    else setThumbPreview(null);
                  }}
                />
                {thumbFile && <div className="text-xs text-muted-foreground mt-1">{thumbFile.name}</div>}
              </div>

              <div>
                <Label className="mb-1.5 block">رقم الترتيب (الرقم الأقل يظهر أولاً للزوار)</Label>
                <Input
                  type="number"
                  value={order}
                  onChange={(e) => setOrder(Number(e.target.value) || 0)}
                  min={0}
                />
              </div>

              {!lockedCourseId && (
                <div className="sm:col-span-2">
                  <Label className="mb-1.5 block">الكورس المرتبط بالعمل</Label>
                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger><SelectValue placeholder="عام (يظهر في الصفحة الرئيسية)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">عام (الصفحة الرئيسية وقسم أعمال الطلاب العام)</SelectItem>
                      {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Preview thumbnail if available */}
            {(thumbPreview || (videoUrl && (youtubeThumb(videoUrl) || bunnyThumb(videoUrl)))) && (
              <div className="p-3 bg-background rounded-xl border flex items-center gap-4">
                <div className="w-28 aspect-video rounded-lg overflow-hidden bg-black shrink-0 relative">
                  <img
                    src={thumbPreview || youtubeThumb(videoUrl) || bunnyThumb(videoUrl) || ""}
                    alt="معاينة الغلاف"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 grid place-items-center bg-black/20">
                    <PlayCircle className="h-6 w-6 text-white drop-shadow" />
                  </div>
                </div>
                <div className="text-xs">
                  <div className="font-bold text-primary">معاينة شكل الفيديو قبل الحفظ</div>
                  <div className="text-muted-foreground">{title || "بدون عنوان"} {studentName ? `• ${studentName}` : ""}</div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="ghost" onClick={() => setShowAddForm(false)}>
                إلغاء
              </Button>
              <Button
                onClick={submit}
                disabled={busy || uploading}
                className="bg-gold text-gold-foreground hover:bg-gold/90 font-bold px-6 shadow-md"
              >
                <Upload className="h-4 w-4 ml-1.5" />
                {uploading ? `جاري الرفع... ${progress}%` : busy ? "جاري الحفظ..." : "حفظ العمل ونشره"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Filter and View Controls Bar */}
      <Card className="p-4 space-y-3 bg-card border-border/80">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في العنوان، اسم الطالب، أو الرابط..."
              className="pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter by Course */}
            {!lockedCourseId && (
              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger className="w-[180px] text-xs">
                  <SelectValue placeholder="تصفية حسب الكورس" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الكورسات والعام</SelectItem>
                  <SelectItem value="none">أعمال عامة فقط (بدون كورس)</SelectItem>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {/* Filter by Status */}
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-[140px] text-xs">
                <SelectValue placeholder="حالة النشر" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="published">المنشور للناس</SelectItem>
                <SelectItem value="hidden">المخفي فقط</SelectItem>
              </SelectContent>
            </Select>

            {/* Duplicates toggle button */}
            <Button
              variant={duplicatesOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setDuplicatesOnly(!duplicatesOnly)}
              className={`text-xs gap-1.5 ${duplicatesOnly ? "bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold" : ""}`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>المكررات ({totalDuplicateWorksCount})</span>
            </Button>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
              <Button
                type="button"
                size="icon"
                variant={viewMode === "grid" ? "default" : "ghost"}
                onClick={() => setViewMode("grid")}
                className="h-7 w-7 rounded-md"
                title="عرض الكروت المرئية (شكل الفيديوهات)"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant={viewMode === "list" ? "default" : "ghost"}
                onClick={() => setViewMode("list")}
                className="h-7 w-7 rounded-md"
                title="عرض القائمة المدمجة"
              >
                <List className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Active Filter summary */}
        {(search || courseFilter !== "all" || statusFilter !== "all" || duplicatesOnly) && (
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground pt-1 border-t">
            <span>النتائج المعروضة: <b>{filteredWorks.length}</b> من أصل <b>{works.length}</b></span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearch(""); setCourseFilter("all"); setStatusFilter("all"); setDuplicatesOnly(false); }}
              className="h-6 px-2 text-xs text-destructive hover:text-destructive"
            >
              إعادة ضبط الفلاتر
            </Button>
          </div>
        )}
      </Card>

      {/* Videos List / Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden animate-pulse">
              <div className="aspect-video bg-muted" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </Card>
          ))}
        </div>
      ) : filteredWorks.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground space-y-3">
          <Film className="h-12 w-12 mx-auto opacity-30" />
          <div className="text-base font-bold text-primary">لا توجد أعمال مطابقة للفلاتر الحالية</div>
          <p className="text-xs">جرب تغيير شروط البحث أو الفلاتر أو إضافة عمل جديد من الزر في الأعلى.</p>
        </Card>
      ) : viewMode === "grid" ? (
        /* VISUAL CARDS GRID - Shows video preview thumbnail, badges, quick reorder and remove */
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorks.map((w, index) => {
            const thumb = getWorkThumbnail(w);
            const normTitle = (w.title || "").trim().toLowerCase();
            const sameTitleCount = duplicateMap.get(normTitle)?.length ?? 0;
            const isDuplicate = sameTitleCount > 1;
            const course = courses.find((c) => c.id === w.course_id);

            return (
              <Card
                key={w.id}
                className={`overflow-hidden flex flex-col justify-between group border transition-all duration-200 hover:shadow-lg ${
                  isDuplicate ? "border-amber-500/40 bg-amber-500/[0.02]" : "border-border/80 bg-card"
                }`}
              >
                <div>
                  {/* Visual Video Thumbnail Container */}
                  <div className="relative aspect-video bg-black overflow-hidden group/thumb">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={w.title}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center bg-slate-900 text-slate-500">
                        <Film className="h-10 w-10 opacity-50" />
                      </div>
                    )}

                    {/* Interactive Play Button to Watch inside Admin */}
                    <button
                      type="button"
                      onClick={() => setPreviewWork(w)}
                      className="absolute inset-0 grid place-items-center bg-black/40 group-hover/thumb:bg-black/60 transition-colors"
                      title="معاينة وتشغيل الفيديو"
                    >
                      <div className="h-12 w-12 rounded-full bg-gold/90 text-gold-foreground grid place-items-center shadow-lg transition-transform group-hover/thumb:scale-110">
                        <Play className="h-6 w-6 fill-current ml-0.5" />
                      </div>
                    </button>

                    {/* Top Badges */}
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                      <Badge className="bg-black/75 backdrop-blur-md text-gold border border-gold/40 text-[11px] font-extrabold px-2 py-0.5">
                        #{w.order_index}
                      </Badge>
                    </div>

                    <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
                      {w.is_published ? (
                        <Badge className="bg-emerald-500/90 text-white font-bold text-[10px] px-2 py-0.5">
                          منشور للزوار
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-800/90 text-slate-300 border border-slate-700 text-[10px] px-2 py-0.5">
                          مخفي
                        </Badge>
                      )}
                    </div>

                    {/* Duplicate Badge */}
                    {isDuplicate && (
                      <div className="absolute bottom-2 right-2 z-10">
                        <Badge className="bg-amber-500 text-slate-950 font-bold text-[10px] px-2 py-0.5 gap-1 shadow">
                          <AlertTriangle className="h-3 w-3" /> مكرر ({sameTitleCount})
                        </Badge>
                      </div>
                    )}

                    {/* Course Badge */}
                    <div className="absolute bottom-2 left-2 z-10 max-w-[65%]">
                      <span className="text-[10px] bg-black/80 backdrop-blur-sm text-slate-200 px-2 py-0.5 rounded truncate block border border-white/10">
                        {course ? course.title : "عام (الصفحة الرئيسية)"}
                      </span>
                    </div>
                  </div>

                  {/* Card Content & Edit Mode */}
                  {editingId === w.id ? (
                    <div className="p-4 space-y-3 bg-muted/30 border-t">
                      <div>
                        <Label className="text-xs">العنوان</Label>
                        <Input
                          value={edit.title ?? ""}
                          onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">اسم الطالب</Label>
                        <Input
                          value={edit.student_name ?? ""}
                          onChange={(e) => setEdit({ ...edit, student_name: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">رقم الترتيب</Label>
                        <Input
                          type="number"
                          value={edit.order_index ?? 0}
                          onChange={(e) => setEdit({ ...edit, order_index: Number(e.target.value) || 0 })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">رابط الفيديو</Label>
                        <Input
                          value={edit.video_url ?? ""}
                          onChange={(e) => setEdit({ ...edit, video_url: e.target.value })}
                          className="h-8 text-xs"
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">الكورس</Label>
                        <Select
                          value={edit.course_id ?? "__none__"}
                          onValueChange={(v) => setEdit({ ...edit, course_id: v === "__none__" ? null : v })}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">عام (الصفحة الرئيسية)</SelectItem>
                            {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditingId(null); setEdit({}); }}>
                          <X className="h-3.5 w-3.5 ml-1" /> إلغاء
                        </Button>
                        <Button size="sm" className="h-7 text-xs bg-gold text-gold-foreground hover:bg-gold/90" onClick={() => saveEdit(w.id)}>
                          <Check className="h-3.5 w-3.5 ml-1" /> حفظ
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-sm text-primary leading-snug line-clamp-2" title={w.title}>
                          {w.title}
                        </h4>
                      </div>

                      <div className="text-xs text-muted-foreground flex items-center justify-between gap-2 flex-wrap">
                        <span>{w.student_name ? `بواسطة: ${w.student_name}` : "بدون اسم طالب"}</span>
                        <a
                          href={resolveEmbedUrl(w.video_url)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-gold hover:underline"
                        >
                          فتح الرابط <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Footer with Quick Controls */}
                {editingId !== w.id && (
                  <div className="p-3 pt-2 bg-muted/20 border-t flex items-center justify-between gap-2">
                    {/* Reorder Buttons (▲ / ▼) */}
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-md"
                        disabled={index === 0}
                        onClick={() => moveWork(w, "up")}
                        title="تقديم الترتيب للأمام (سهم لأعلى)"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-md"
                        disabled={index === filteredWorks.length - 1}
                        onClick={() => moveWork(w, "down")}
                        title="تأخير الترتيب للخلف (سهم لأسفل)"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>

                      {/* Direct order input */}
                      <Input
                        type="number"
                        defaultValue={w.order_index}
                        onBlur={(e) => saveWorkOrder(w, Number(e.target.value) || 0)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="h-7 w-12 text-center text-xs p-1"
                        title="اكتب الترتيب واضغط Enter"
                      />
                    </div>

                    {/* Publish & Edit & Delete */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1" title={w.is_published ? "منشور للناس" : "مخفي"}>
                        <Switch
                          checked={w.is_published}
                          onCheckedChange={() => togglePublish(w)}
                          aria-label="نشر العمل"
                        />
                      </div>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-md"
                        onClick={() => startEdit(w)}
                        title="تعديل البيانات"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-md text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => remove(w)}
                        title="حذف هذا العمل"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        /* COMPACT LIST VIEW */
        <div className="space-y-2">
          {filteredWorks.map((w, index) => {
            const thumb = getWorkThumbnail(w);
            const normTitle = (w.title || "").trim().toLowerCase();
            const sameTitleCount = duplicateMap.get(normTitle)?.length ?? 0;
            const isDuplicate = sameTitleCount > 1;
            const course = courses.find((c) => c.id === w.course_id);

            return (
              <Card
                key={w.id}
                className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isDuplicate ? "border-amber-500/40 bg-amber-500/[0.02]" : ""
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Mini Thumbnail */}
                  <div
                    onClick={() => setPreviewWork(w)}
                    className="relative w-20 aspect-video rounded-lg overflow-hidden bg-black shrink-0 cursor-pointer group"
                    title="انقر لتشغيل الفيديو"
                  >
                    {thumb ? (
                      <img src={thumb} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-muted-foreground"><Film className="h-5 w-5" /></div>
                    )}
                    <div className="absolute inset-0 grid place-items-center bg-black/30 group-hover:bg-black/50 transition-colors">
                      <Play className="h-4 w-4 fill-white text-white" />
                    </div>
                  </div>

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-primary text-sm truncate">{w.title}</span>
                      {isDuplicate && (
                        <Badge className="bg-amber-500 text-slate-950 text-[10px] px-1.5 py-0">مكرر ({sameTitleCount})</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{w.student_name ? `بواسطة: ${w.student_name}` : "بدون اسم طالب"}</span>
                      <span>•</span>
                      <span>ترتيب: #{w.order_index}</span>
                      <span>•</span>
                      <span>{course ? course.title : "عام (الرئيسية)"}</span>
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 shrink-0 justify-end">
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={index === 0}
                      onClick={() => moveWork(w, "up")}
                      title="تقديم"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={index === filteredWorks.length - 1}
                      onClick={() => moveWork(w, "down")}
                      title="تأخير"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{w.is_published ? "منشور" : "مخفي"}</span>
                    <Switch checked={w.is_published} onCheckedChange={() => togglePublish(w)} />
                  </div>

                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(w)} title="تعديل">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>

                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => remove(w)} title="حذف">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Video Preview Modal inside Admin */}
      <Dialog open={!!previewWork} onOpenChange={(o) => !o && setPreviewWork(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden [&>button]:hidden bg-[#0B1220] border-slate-800 text-white">
          <DialogClose
            aria-label="إغلاق"
            className="absolute left-3 top-3 z-50 grid h-9 w-9 place-items-center rounded-full bg-slate-800/80 text-white hover:bg-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </DialogClose>
          <DialogHeader className="p-4 border-b border-slate-800">
            <DialogTitle className="text-right text-base text-white flex items-center justify-between pl-8">
              <span>{previewWork?.title}</span>
              {previewWork?.student_name && (
                <span className="text-xs text-slate-400 font-normal">بواسطة: {previewWork.student_name}</span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="relative w-full aspect-video bg-black">
            {previewWork && (
              <SecurePlayer
                url={resolveEmbedUrl(previewWork.video_url)}
                title={previewWork.title}
              />
            )}
          </div>
          <div className="p-3 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300">
            <span>ترتيب العرض: <b>#{previewWork?.order_index}</b> • الحالة: <b>{previewWork?.is_published ? "منشور للزوار" : "مخفي"}</b></span>
            <a
              href={resolveEmbedUrl(previewWork?.video_url || "")}
              target="_blank"
              rel="noreferrer"
              className="text-gold hover:underline inline-flex items-center gap-1"
            >
              فتح الرابط في نافذة جديدة <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
