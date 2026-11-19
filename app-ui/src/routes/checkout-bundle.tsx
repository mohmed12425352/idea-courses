import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { SiteShell } from "@/components/layout/SiteShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { bundleDiscountPercent, useCart } from "@/hooks/use-cart";
import { createKashierBundleSession } from "@/lib/bundle.functions";
import { usePricing } from "@/lib/pricing";
import { MascotLoader } from "@/components/common/MascotLoader";

export const Route = createFileRoute("/checkout-bundle")({
  head: () => ({
    meta: [
      { title: "باكدج الكورسات — فكرة ديزاين" },
      { name: "description", content: "اشترك في أكثر من كورس بخصم فوري ودفعة واحدة عبر Kashier — فكرة ديزاين." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BundleCheckoutPage,
});

type CartCourse = { id: string; slug: string; title: string; image_url: string | null; price: number; discount_price: number | null };

function BundleCheckoutPage() {
  const { ids, remove, count } = useCart();
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [courses, setCourses] = useState<CartCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const createBundleFn = useServerFn(createKashierBundleSession);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { nav({ to: "/register", search: { redirect: "/checkout-bundle" } }); return; }
  }, [user, authLoading, nav]);

  useEffect(() => {
    const arr = Array.from(ids);
    if (arr.length === 0) { setCourses([]); setLoading(false); return; }
    setLoading(true);
    supabase
      .from("courses")
      .select("id, slug, title, image_url, price, discount_price")
      .in("id", arr)
      .then(({ data }) => { setCourses((data ?? []) as CartCourse[]); setLoading(false); });
  }, [ids]);

  const { adjust } = usePricing();
  const subtotal = useMemo(
    () => courses.reduce((s, c) => s + adjust(Number(c.discount_price ?? c.price)), 0),
    [courses, adjust],
  );
  const pct = bundleDiscountPercent(courses.length);
  const total = Math.round((subtotal * (100 - pct)) / 100);

  const pay = async () => {
    if (courses.length < 2) { toast.error("لازم كورسين على الأقل للباكدج"); return; }
    const w = window.open("about:blank", "_blank");
    setPaying(true);
    try {
      const res = await createBundleFn({ data: { courseIds: courses.map((c) => c.id) } });
      if (!res?.ok) { w?.close(); toast.error(res?.error ?? "تعذّر فتح بوابة الدفع"); setPaying(false); return; }
      if (w) w.location.href = res.checkoutUrl;
      else window.location.href = res.checkoutUrl;
      toast.info("تم فتح بوابة الدفع. هيتم تفعيل كل الكورسات بعد التأكيد.");
    } catch (e: unknown) {
      w?.close();
      toast.error(e instanceof Error ? e.message : "تعذّر فتح بوابة الدفع");
    } finally { setPaying(false); }
  };

  if (loading || authLoading) {
    return (
      <SiteShell>
        <div className="container-page py-28 flex flex-col items-center justify-center min-h-[60vh]">
          <MascotLoader size="lg" message="جاري تجهيز سلة الكورسات..." />
        </div>
      </SiteShell>
    );
  }
  if (count === 0) return (
    <SiteShell>
      <div className="container-page py-20 max-w-xl text-center">
        <Card className="p-8">
          <h1 className="text-2xl font-bold mb-2">السلة فاضية</h1>
          <p className="text-muted-foreground mb-5">ضيف كورسات من صفحة الدورات وارجعلنا هنا.</p>
          <Button onClick={() => nav({ to: "/courses" })} className="bg-gold text-gold-foreground hover:bg-gold/90">تصفح الكورسات</Button>
        </Card>
      </div>
    </SiteShell>
  );
  if (count === 1) {
    // Route through single-course checkout
    nav({ to: "/checkout/$courseId", params: { courseId: courses[0].id } });
    return null;
  }

  return (
    <SiteShell>
      <div className="container-page py-12 max-w-5xl">
        <h1 className="text-3xl font-extrabold text-primary mb-2">باكدج {courses.length} كورسات</h1>
        <p className="text-muted-foreground mb-8">دفعة واحدة، تفعيل تلقائي لكل الكورسات بعد الدفع.</p>
        <div className="grid lg:grid-cols-[1fr_360px] gap-8">
          <div className="space-y-3">
            {courses.map((c) => {
              const price = adjust(Number(c.discount_price ?? c.price));
              return (
                <Card key={c.id} className="p-3 flex gap-3 items-center">
                  {c.image_url && <img src={c.image_url} alt="" className="h-20 w-28 rounded object-cover" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold line-clamp-2">{c.title}</div>
                    <div className="text-primary font-bold text-sm mt-1">{price} ج.م</div>
                  </div>
                  <button onClick={() => remove(c.id)} className="p-2 text-muted-foreground hover:text-destructive" aria-label="حذف">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </Card>
              );
            })}
          </div>
          <Card className="p-6 h-fit sticky top-20">
            <h2 className="text-lg font-bold mb-4">ملخص الباكدج</h2>
            <div className="space-y-2 text-sm border-b pb-3">
              <div className="flex justify-between"><span className="text-muted-foreground">عدد الكورسات</span><span>{courses.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">المجموع</span><span>{subtotal} ج.م</span></div>
              {pct > 0 && (
                <div className="flex justify-between text-success"><span>خصم الباكدج ({pct}%)</span><span>-{subtotal - total} ج.م</span></div>
              )}
            </div>
            <div className="flex justify-between font-bold text-lg mt-3">
              <span>الإجمالي</span>
              <span className="text-primary">{total} ج.م</span>
            </div>
            {courses.length < 4 && (
              <p className="text-[11px] text-muted-foreground mt-2">
                ضيف كورس تاني وخد خصم أكبر — 3 كورسات 15% • 4 فأكثر 20%
              </p>
            )}
            <Button onClick={pay} disabled={paying} className="w-full mt-4 bg-gold text-white hover:bg-gold/90">
              {paying ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <ShieldCheck className="h-4 w-4 ml-2" />}
              ادفع الباكدج
            </Button>
            <Badge variant="secondary" className="mt-3 w-full justify-center">
              <CheckCircle2 className="ml-1 h-3.5 w-3.5" /> تفعيل تلقائي لكل الكورسات
            </Badge>
          </Card>
        </div>
      </div>
    </SiteShell>
  );
}
