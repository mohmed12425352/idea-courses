import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Trash2, Upload, Plus, ImageIcon } from "lucide-react";

type Story = {
  id: string;
  image_url: string;
  caption: string | null;
  order_index: number;
  is_published: boolean;
  created_at: string;
};

export function SuccessStoriesManager() {
  const { user } = useAuth();
  const [items, setItems] = useState<Story[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [order, setOrder] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("success_stories")
      .select("*")
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Story[]);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!user) return;
    if (!file) { toast.error("اختر صورة للقصة"); return; }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `success-stories/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("course-assets")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("course-assets").getPublicUrl(path);

      const { error } = await supabase.from("success_stories").insert({
        image_url: pub.publicUrl,
        caption: caption.trim() || null,
        order_index: order,
        is_published: true,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success("تمت الإضافة، هتظهر في الصفحة الرئيسية");
      setFile(null); setCaption(""); setOrder(0);
      const input = document.getElementById("ss-file") as HTMLInputElement | null;
      if (input) input.value = "";
      load();
    } catch (e: any) {
      toast.error(e.message || "تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  const togglePublish = async (s: Story) => {
    const { error } = await supabase.from("success_stories").update({ is_published: !s.is_published }).eq("id", s.id);
    if (error) toast.error(error.message); else load();
  };

  const remove = async (s: Story) => {
    if (!confirm("متأكد من حذف هذه القصة؟")) return;
    const { error } = await supabase.from("success_stories").delete().eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف");
    load();
  };

  return (
    <div className="space-y-5">
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 font-semibold text-primary">
          <Plus className="h-4 w-4" /> رفع قصة نجاح جديدة
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>صورة القصة (سكرين شوت / ريفيو طالب)</Label>
            <Input id="ss-file" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file && <div className="text-xs text-muted-foreground mt-1">{file.name}</div>}
          </div>
          <div className="sm:col-span-2">
            <Label>تعليق (اختياري)</Label>
            <Input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} />
          </div>
          <div>
            <Label>الترتيب (الأقل يظهر أولاً)</Label>
            <Input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value) || 0)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={busy} className="bg-gold text-gold-foreground hover:bg-gold/90">
            <Upload className="h-4 w-4 ml-1" /> {busy ? "جاري الرفع…" : "رفع القصة"}
          </Button>
        </div>
      </Card>

      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {items.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground sm:col-span-2 md:col-span-3">
            <ImageIcon className="h-10 w-10 mx-auto opacity-40 mb-2" /> لا توجد قصص بعد
          </Card>
        ) : (
          items.map((s) => (
            <Card key={s.id} className="p-3 space-y-2">
              <div className="aspect-[9/16] w-full overflow-hidden rounded-lg bg-muted">
                <img src={s.image_url} alt={s.caption ?? "قصة نجاح"} className="w-full h-full object-contain bg-card" />
              </div>
              {s.caption && <div className="text-sm text-muted-foreground line-clamp-2">{s.caption}</div>}
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">ترتيب: {s.order_index}</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">منشور</span>
                  <Switch checked={s.is_published} onCheckedChange={() => togglePublish(s)} />
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(s)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}