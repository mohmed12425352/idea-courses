import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Percent, Tag, Trash2, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Course = {
  id: string;
  title: string;
  image_url: string | null;
  category: string;
  price: number;
  discount_price: number | null;
};

export function DiscountsManager() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // form state
  const [selectedId, setSelectedId] = useState<string>("");
  const [mode, setMode] = useState<"percent" | "amount" | "final">("percent");
  const [value, setValue] = useState<string>("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("courses")
      .select("id,title,image_url,category,price,discount_price")
      .order("created_at", { ascending: false });
    setCourses((data ?? []) as Course[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const selected = courses.find((c) => c.id === selectedId);

  const computeDiscountPrice = (course: Course): number | null => {
    const num = Number(value);
    if (!isFinite(num) || num <= 0) return null;
    let result: number;
    if (mode === "percent") {
      if (num >= 100) return 0;
      result = course.price - (course.price * num) / 100;
    } else if (mode === "amount") {
      result = course.price - num;
    } else {
      result = num;
    }
    result = Math.max(0, Math.round(result * 100) / 100);
    if (result >= course.price) return null;
    return result;
  };

  const applyDiscount = async () => {
    if (!selected) return toast.error("اختار الكورس الأول");
    const dp = computeDiscountPrice(selected);
    if (dp == null) return toast.error("القيمة غير صالحة — لازم تقل عن السعر الأصلي");
    setSavingId(selected.id);
    const { error } = await supabase.from("courses").update({ discount_price: dp }).eq("id", selected.id);
    setSavingId(null);
    if (error) {
      toast.error("تعذر حفظ الخصم");
      return;
    }
    toast.success(`تم تطبيق الخصم على «${selected.title}»`);
    setValue("");
    load();
  };

  const removeDiscount = async (id: string) => {
    setSavingId(id);
    const { error } = await supabase.from("courses").update({ discount_price: null }).eq("id", id);
    setSavingId(null);
    if (error) {
      toast.error("تعذر إزالة الخصم");
      return;
    }
    toast.success("تم إلغاء الخصم");
    load();
  };

  const previewPrice = selected ? computeDiscountPrice(selected) : null;
  const previewPct =
    selected && previewPrice != null && selected.price > 0
      ? Math.round(((selected.price - previewPrice) / selected.price) * 100)
      : 0;

  const discounted = courses.filter((c) => c.discount_price != null && c.discount_price < c.price);

  return (
    <div className="space-y-6">
      {/* Hero create card */}
      <Card className="relative overflow-hidden border-gold/40 bg-gradient-to-br from-gold/5 via-background to-rose-500/5 p-5 md:p-6">
        <div className="pointer-events-none absolute -top-16 -left-16 h-48 w-48 rounded-full bg-gold/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-rose-500/20 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-gold to-rose-500 text-white shadow-lg">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg leading-tight">إضافة خصم على كورس</h3>
              <p className="text-xs text-muted-foreground">اختار الكورس وحدد قيمة الخصم — هيظهر فوراً في الصفحة الرئيسية</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-12">
            <div className="md:col-span-5">
              <Label className="text-xs mb-1.5 block">الكورس</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="اختار كورس..." />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title} — {c.price} ج.م
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-3">
              <Label className="text-xs mb-1.5 block">نوع الخصم</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as any)}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">نسبة مئوية %</SelectItem>
                  <SelectItem value="amount">مبلغ خصم (ج.م)</SelectItem>
                  <SelectItem value="final">السعر النهائي (ج.م)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs mb-1.5 block">القيمة</Label>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={mode === "percent" ? "مثلاً 25" : "مثلاً 200"}
                className="bg-background"
              />
            </div>

            <div className="md:col-span-2 flex items-end">
              <Button
                onClick={applyDiscount}
                disabled={!selected || !value || savingId === selected?.id}
                className="w-full bg-gradient-to-r from-gold to-rose-500 text-white hover:opacity-90 font-bold"
              >
                {savingId === selected?.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Percent className="h-4 w-4 ml-1.5" /> طبّق الخصم
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Live preview */}
          {selected && (
            <div className="mt-4 flex items-center gap-4 rounded-xl border bg-background/80 backdrop-blur p-3">
              {selected.image_url && (
                <img src={selected.image_url} alt="" className="h-14 w-20 rounded-lg object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{selected.title}</div>
                <div className="text-xs text-muted-foreground">
                  السعر الأصلي: <span className="line-through">{selected.price} ج.م</span>
                </div>
              </div>
              <div className="text-left">
                {previewPrice != null ? (
                  <>
                    <div className="text-xs text-muted-foreground">السعر بعد الخصم</div>
                    <div className="text-2xl font-extrabold text-rose-600 leading-none">
                      {previewPrice} <span className="text-xs font-medium text-muted-foreground">ج.م</span>
                    </div>
                    <div className="mt-1 inline-block rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-bold text-rose-600">
                      خصم {previewPct}%
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground">حدد قيمة صالحة</div>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Active discounts list */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Tag className="h-4 w-4 text-gold" />
          <h3 className="font-bold">الخصومات الفعّالة</h3>
          <Badge variant="secondary">{discounted.length}</Badge>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">جاري التحميل…</div>
        ) : discounted.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground text-sm border-dashed">
            لا توجد خصومات حالياً. ابدأ بإضافة خصم من الأعلى ✨
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {discounted.map((c) => {
              const pct = Math.round(((c.price - (c.discount_price as number)) / c.price) * 100);
              return (
                <Card key={c.id} className="relative overflow-hidden p-4 flex gap-3 border-rose-500/30">
                  <div className="absolute top-0 left-0 bg-gradient-to-l from-rose-500 to-rose-600 text-white text-xs font-bold px-3 py-1 rounded-br-lg">
                    خصم {pct}%
                  </div>
                  {c.image_url && (
                    <img src={c.image_url} alt="" className="w-20 h-20 rounded-lg object-cover mt-4" />
                  )}
                  <div className="flex-1 min-w-0 pt-4">
                    <div className="font-bold truncate">{c.title}</div>
                    <div className="text-xs text-muted-foreground">{c.category}</div>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="text-lg font-extrabold text-rose-600">{c.discount_price} ج.م</span>
                      <span className="text-xs text-muted-foreground line-through">{c.price} ج.م</span>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeDiscount(c.id)}
                    disabled={savingId === c.id}
                    title="إلغاء الخصم"
                    className="self-start"
                  >
                    {savingId === c.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}