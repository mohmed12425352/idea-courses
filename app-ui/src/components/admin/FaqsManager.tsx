import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Save, HelpCircle, Pencil, X } from "lucide-react";

type Faq = {
  id: string;
  question: string;
  answer: string;
  order_index: number;
  is_published: boolean;
};

export function FaqsManager() {
  const [items, setItems] = useState<Faq[]>([]);
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [order, setOrder] = useState(0);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQ, setEditQ] = useState("");
  const [editA, setEditA] = useState("");
  const [editOrder, setEditOrder] = useState(0);

  const load = async () => {
    const { data } = await supabase
      .from("faqs")
      .select("*")
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });
    setItems((data ?? []) as Faq[]);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!q.trim() || !a.trim()) { toast.error("اكتب السؤال والإجابة"); return; }
    setBusy(true);
    const { error } = await supabase.from("faqs").insert({
      question: q.trim(),
      answer: a.trim(),
      order_index: order,
      is_published: true,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تمت الإضافة");
    setQ(""); setA(""); setOrder(0);
    load();
  };

  const startEdit = (f: Faq) => {
    setEditingId(f.id);
    setEditQ(f.question);
    setEditA(f.answer);
    setEditOrder(f.order_index);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await supabase
      .from("faqs")
      .update({ question: editQ.trim(), answer: editA.trim(), order_index: editOrder })
      .eq("id", editingId);
    if (error) { toast.error(error.message); return; }
    toast.success("تم التحديث");
    setEditingId(null);
    load();
  };

  const togglePublish = async (f: Faq) => {
    const { error } = await supabase.from("faqs").update({ is_published: !f.is_published }).eq("id", f.id);
    if (error) toast.error(error.message); else load();
  };

  const remove = async (f: Faq) => {
    if (!confirm("متأكد من حذف هذا السؤال؟")) return;
    const { error } = await supabase.from("faqs").delete().eq("id", f.id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف");
    load();
  };

  return (
    <div className="space-y-5" dir="rtl">
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 font-semibold text-primary">
          <Plus className="h-4 w-4" /> إضافة سؤال جديد
        </div>
        <div className="grid gap-3">
          <div>
            <Label>السؤال</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="مثال: هل أحصل على شهادة بعد إنهاء الكورس؟" />
          </div>
          <div>
            <Label>الإجابة</Label>
            <Textarea value={a} onChange={(e) => setA(e.target.value)} rows={3} placeholder="اكتب إجابة واضحة ومختصرة…" />
          </div>
          <div className="max-w-[180px]">
            <Label>الترتيب (الأقل يظهر أولاً)</Label>
            <Input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value) || 0)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={busy} className="bg-gold text-gold-foreground hover:bg-gold/90">
            <Plus className="h-4 w-4 ml-1" /> {busy ? "جاري الحفظ…" : "إضافة السؤال"}
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        {items.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <HelpCircle className="h-10 w-10 mx-auto opacity-40 mb-2" /> لا توجد أسئلة بعد
          </Card>
        ) : (
          items.map((f) => (
            <Card key={f.id} className="p-4">
              {editingId === f.id ? (
                <div className="space-y-3">
                  <div>
                    <Label>السؤال</Label>
                    <Input value={editQ} onChange={(e) => setEditQ(e.target.value)} />
                  </div>
                  <div>
                    <Label>الإجابة</Label>
                    <Textarea value={editA} onChange={(e) => setEditA(e.target.value)} rows={3} />
                  </div>
                  <div className="max-w-[180px]">
                    <Label>الترتيب</Label>
                    <Input type="number" value={editOrder} onChange={(e) => setEditOrder(Number(e.target.value) || 0)} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4 ml-1" /> إلغاء
                    </Button>
                    <Button size="sm" onClick={saveEdit} className="bg-gold text-gold-foreground hover:bg-gold/90">
                      <Save className="h-4 w-4 ml-1" /> حفظ
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-primary">{f.question}</div>
                      <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{f.answer}</div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">منشور</span>
                        <Switch checked={f.is_published} onCheckedChange={() => togglePublish(f)} />
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => startEdit(f)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(f)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">ترتيب: {f.order_index}</div>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}