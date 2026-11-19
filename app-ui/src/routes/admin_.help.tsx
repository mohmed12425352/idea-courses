import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/layout/SiteShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  ArrowRight, LifeBuoy, Link as LinkIcon, Loader2, Plus, Save, Trash2, Upload,
  ChevronUp, ChevronDown, Eye, EyeOff, Video,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { createBunnyTusUpload } from "@/lib/bunny.functions";
import * as tus from "tus-js-client";

export const Route = createFileRoute("/admin_/help")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login", search: { redirect: "/admin/help" } });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" });
    if (!isAdmin) throw redirect({ to: "/" });
  },
  component: AdminHelpPage,
});

type HelpVideo = {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

const normalizeUrl = (input: string) => {
  const decoded = input
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
  const iframeMatch = decoded.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  return (iframeMatch ? iframeMatch[1] : decoded)
    .trim()
    .replace(/^https?:\/\/player\.mediadelivery\.net\//i, "https://iframe.mediadelivery.net/");
};

function AdminHelpPage() {
  const [videos, setVideos] = useState<HelpVideo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("help_videos")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) toast.error(error.message);
    else setVideos((data as HelpVideo[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  return (
    <SiteShell>
      <div className="container-page py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-primary flex items-center gap-2">
              <LifeBuoy className="h-6 w-6 text-gold" /> مركز المساعدة
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              أضف فيديوهات شرح للطلاب — بترفعها هنا وبتظهر لهم في صفحة <code>/help</code>.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin"><ArrowRight className="h-4 w-4 ml-1" /> رجوع للإدارة</Link>
          </Button>
        </div>

        <AddHelpVideoCard onAdded={load} nextOrder={(videos[videos.length - 1]?.sort_order ?? 0) + 1} />

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Video className="h-5 w-5 text-gold" />
            <h2 className="text-lg font-extrabold text-primary">الفيديوهات المتاحة ({videos.length})</h2>
          </div>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">جاري التحميل...</div>
          ) : videos.length === 0 ? (
            <div className="text-center py-10 border border-dashed rounded-lg text-sm text-muted-foreground">
              لا يوجد فيديوهات بعد. أضف أول فيديو مساعدة من الأعلى.
            </div>
          ) : (
            <div className="space-y-3">
              {videos.map((v, i) => (
                <HelpVideoRow
                  key={v.id}
                  video={v}
                  onChange={load}
                  isFirst={i === 0}
                  isLast={i === videos.length - 1}
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </SiteShell>
  );
}

function AddHelpVideoCard({ onAdded, nextOrder }: { onAdded: () => void; nextOrder: number }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const createTusUpload = useServerFn(createBunnyTusUpload);

  const uploadFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024 * 1024) { toast.error("حجم الفيديو يتجاوز 5 جيجا"); return; }
    setUploading(true); setProgress(0);
    try {
      const creds = await createTusUpload({ data: { title: title || file.name } });
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
          metadata: { filetype: file.type, title: title || file.name },
          onError: (err) => reject(err),
          onProgress: (sent, total) => { if (total > 0) setProgress(Math.round((sent / total) * 100)); },
          onSuccess: () => resolve(),
        });
        upload.start();
      });
      setVideoUrl(creds.iframeUrl);
      toast.success("تم رفع الفيديو بنجاح");
    } catch (e: any) {
      toast.error(e.message ?? "فشل رفع الفيديو");
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const add = async () => {
    const t = title.trim();
    const url = normalizeUrl(videoUrl);
    if (!t) { toast.error("اكتب عنوان الفيديو"); return; }
    if (!/^https?:\/\//i.test(url)) { toast.error("رابط الفيديو غير صحيح"); return; }
    setSaving(true);
    const { error } = await supabase.from("help_videos").insert({
      title: t,
      description: description.trim() || null,
      video_url: url,
      sort_order: nextOrder,
      is_active: true,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تمت الإضافة");
    setTitle(""); setDescription(""); setVideoUrl("");
    onAdded();
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Plus className="h-5 w-5 text-gold" />
        <h2 className="text-lg font-extrabold text-primary">إضافة فيديو مساعدة جديد</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>عنوان الفيديو</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: طريقة تفعيل كود الدخول" />
        </div>
        <div>
          <Label>وصف مختصر (اختياري)</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="جملة تعريفية قصيرة" />
        </div>
      </div>

      <div>
        <Label className="flex items-center gap-1"><LinkIcon className="h-3.5 w-3.5" /> رابط الفيديو (Bunny / YouTube)</Label>
        <Input
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://iframe.mediadelivery.net/embed/... أو https://youtu.be/..."
          className="ltr:text-left"
          dir="ltr"
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
        />
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="sm:w-auto">
          {uploading ? <><Loader2 className="h-4 w-4 animate-spin ml-1" /> جاري الرفع... {progress}%</> : <><Upload className="h-4 w-4 ml-1" /> أو رفع فيديو مباشرة</>}
        </Button>
        <div className="flex-1" />
        <Button onClick={add} disabled={saving || uploading} className="bg-gold text-gold-foreground hover:bg-gold/90">
          {saving ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Save className="h-4 w-4 ml-1" />} حفظ الفيديو
        </Button>
      </div>
    </Card>
  );
}

function HelpVideoRow({ video, onChange, isFirst, isLast }: { video: HelpVideo; onChange: () => void; isFirst: boolean; isLast: boolean }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description ?? "");
  const [videoUrl, setVideoUrl] = useState(video.video_url);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("help_videos").update({
      title: title.trim(),
      description: description.trim() || null,
      video_url: normalizeUrl(videoUrl),
    }).eq("id", video.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("تم الحفظ"); setEditing(false); onChange(); }
  };

  const remove = async () => {
    if (!confirm(`حذف الفيديو "${video.title}"؟`)) return;
    const { error } = await supabase.from("help_videos").delete().eq("id", video.id);
    if (error) toast.error(error.message); else { toast.success("تم الحذف"); onChange(); }
  };

  const toggleActive = async () => {
    const { error } = await supabase.from("help_videos").update({ is_active: !video.is_active }).eq("id", video.id);
    if (error) toast.error(error.message); else onChange();
  };

  const move = async (dir: -1 | 1) => {
    const target = dir === -1 ? video.sort_order - 1 : video.sort_order + 1;
    const { data: other } = await supabase.from("help_videos").select("id, sort_order").eq("sort_order", target).maybeSingle();
    await supabase.from("help_videos").update({ sort_order: target }).eq("id", video.id);
    if (other) await supabase.from("help_videos").update({ sort_order: video.sort_order }).eq("id", other.id);
    onChange();
  };

  return (
    <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 space-y-3">
      {editing ? (
        <div className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div><Label>العنوان</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><Label>الوصف</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          </div>
          <div><Label>رابط الفيديو</Label><Textarea value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} rows={2} dir="ltr" /></div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving} className="bg-gold text-gold-foreground hover:bg-gold/90">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> : <Save className="h-3.5 w-3.5 ml-1" />} حفظ
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setEditing(false); setTitle(video.title); setDescription(video.description ?? ""); setVideoUrl(video.video_url); }}>إلغاء</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-bold text-primary flex items-center gap-2 flex-wrap">
              <span className="truncate">{video.title}</span>
              {!video.is_active && <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">مخفي</span>}
            </div>
            {video.description && <div className="text-xs text-muted-foreground mt-1 truncate">{video.description}</div>}
            <div className="text-[11px] text-muted-foreground/70 mt-1 truncate ltr:text-left" dir="ltr">{video.video_url}</div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => move(-1)} disabled={isFirst} title="لأعلى"><ChevronUp className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => move(1)} disabled={isLast} title="لأسفل"><ChevronDown className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={toggleActive} title={video.is_active ? "إخفاء" : "إظهار"}>
              {video.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>تعديل</Button>
            <Button size="icon" variant="ghost" onClick={remove}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}