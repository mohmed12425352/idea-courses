import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePricing } from "@/lib/pricing";
import { bundleDiscountPercent, useCart } from "@/hooks/use-cart";
import { Loader2, ShoppingCart, Trash2, ArrowLeft, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { STATIC_COURSES } from "@/lib/staticCoursesData";

type CartCourse = {
  id: string;
  slug: string;
  title: string;
  title_en?: string | null;
  image_url: string | null;
  price: number;
  discount_price: number | null;
};

export function CartSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t, isEn, dir } = useI18n();
  const { ids, remove, clear } = useCart();
  const [courses, setCourses] = useState<CartCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    if (!open) return;
    const arr = Array.from(ids);
    if (arr.length === 0) {
      setCourses([]);
      return;
    }
    setLoading(true);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const dbUuids = arr.filter((id) => uuidRegex.test(id));
    const nonUuidIds = arr.filter((id) => !uuidRegex.test(id));

    // Match static courses safely
    const staticMatches: CartCourse[] = [];
    for (const id of nonUuidIds) {
      const found = STATIC_COURSES.find((c) => c.id === id || c.slug === id);
      if (found) {
        staticMatches.push({
          id: found.id,
          slug: found.slug,
          title: found.title,
          image_url: found.image_url,
          price: found.price,
          discount_price: found.discount_price,
        });
      }
    }

    if (dbUuids.length > 0) {
      supabase
        .from("courses")
        .select("id, slug, title, title_en, image_url, price, discount_price")
        .in("id", dbUuids)
        .then(({ data, error }) => {
          if (error) {
            console.warn("[CartSheet] Supabase error:", error.message);
            setCourses(staticMatches);
          } else {
            const dbList = (data ?? []) as CartCourse[];
            setCourses([...dbList, ...staticMatches]);
          }
          setLoading(false);
        })
        .then(undefined, () => {
          setCourses(staticMatches);
          setLoading(false);
        });
    } else {
      setCourses(staticMatches);
      setLoading(false);
    }
  }, [open, ids]);

  const { adjust } = usePricing();
  const subtotal = useMemo(
    () => courses.reduce((sum, c) => sum + adjust(Number(c.discount_price ?? c.price)), 0),
    [courses, adjust],
  );
  const pct = bundleDiscountPercent(courses.length);
  const total = Math.round((subtotal * (100 - pct)) / 100);

  const goCheckout = () => {
    onOpenChange(false);
    if (courses.length === 1) {
      nav({ to: "/checkout/$courseId", params: { courseId: courses[0].id } });
    } else if (courses.length >= 2) {
      nav({ to: "/checkout-bundle" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-full sm:max-w-md flex flex-col bg-[#1e1b1b] border-[#393434] text-white p-5 sm:p-6"
      >
        <SheetHeader className="text-right pb-3 border-b border-[#342f2f] pl-10 rtl:pl-10 rtl:pr-0">
          <SheetTitle className="flex items-center gap-2 text-white font-bold text-lg">
            <span className="w-8 h-8 rounded-lg bg-[#e50914]/20 flex items-center justify-center text-[#e50914]">
              <ShoppingCart className="h-4 w-4" />
            </span>
            <span>{isEn ? "Cart" : "سلة المشتريات"}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#e50914] text-white font-bold mr-1">
              {courses.length}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto -mx-5 px-5 py-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/60 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-[#e50914]" />
              <span className="text-xs">{isEn ? "Loading..." : "جاري تحميل السلة..."}</span>
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-16 text-white/60 flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-[#252121] border border-[#393434] flex items-center justify-center text-[#e50914] shadow-inner">
                <ShoppingCart className="w-8 h-8" />
              </div>
              <p className="font-bold text-white text-base">
                {isEn ? "Your cart is empty" : "سلة المشتريات فارغة"}
              </p>
              <p className="text-xs text-white/60 max-w-[240px] leading-relaxed">
                {isEn
                  ? "Start adding courses to build a discounted bundle."
                  : "لم تقم بإضافة أي دورات بعد. تصفح الدورات وأضف ما يناسبك الآن!"}
              </p>
            </div>
          ) : (
            courses.map((c) => {
              const price = adjust(Number(c.discount_price ?? c.price));
              const title = isEn && c.title_en ? c.title_en : c.title;
              return (
                <div
                  key={c.id}
                  className="flex gap-3 rounded-xl border border-[#393434] bg-[#252121] p-3 hover:border-white/20 transition-all group"
                >
                  {c.image_url && (
                    <img
                      src={c.image_url}
                      alt={title}
                      className="h-16 w-22 rounded-lg object-cover bg-black/40 shrink-0 border border-white/5"
                    />
                  )}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div className="text-xs sm:text-sm font-semibold text-white line-clamp-2 leading-snug">
                      {title}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-black text-[#5aca26]" dir="ltr">
                        {price} {isEn ? "EGP" : "ج.م"}
                      </span>
                      <button
                        type="button"
                        onClick={() => remove(c.id)}
                        className="text-white/40 hover:text-red-400 p-1 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
                        title={isEn ? "Delete" : "حذف"}
                        aria-label={isEn ? "Delete" : "حذف"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {courses.length > 0 && (
          <div className="border-t border-[#342f2f] pt-4 space-y-3 bg-[#1e1b1b]">
            <div className="space-y-1.5 text-xs text-white/70">
              <div className="flex justify-between">
                <span>{isEn ? "Subtotal" : "المجموع الفرعي"}</span>
                <span className="font-semibold text-white" dir="ltr">
                  {subtotal} {isEn ? "EGP" : "ج.م"}
                </span>
              </div>
              {pct > 0 && (
                <div className="flex justify-between text-[#5aca26] font-semibold">
                  <span>
                    {isEn
                      ? `Bundle discount (${pct}%)`
                      : `خصم الباقة (${pct}%)`}
                  </span>
                  <span dir="ltr">-{subtotal - total} {isEn ? "EGP" : "ج.م"}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-baseline font-bold text-base border-t border-[#342f2f] pt-2">
              <span className="text-white">{isEn ? "Total" : "الإجمالي"}</span>
              <span className="text-lg font-black text-[#5aca26]" dir="ltr">
                {total} {isEn ? "EGP" : "ج.م"}
              </span>
            </div>

            {courses.length < 4 && (
              <div className="bg-[#252121] border border-[#393434] rounded-lg p-2 text-[11px] text-[#e50914] text-center font-medium">
                {isEn
                  ? "Add another course for a bigger bundle discount!"
                  : "أضف دورة أخرى للحصول على خصم باقة أكبر!"}
              </div>
            )}

            <Button
              type="button"
              onClick={goCheckout}
              className="w-full h-11 bg-gradient-to-r from-[#e50914] to-[#b8050e] hover:from-[#d6004c] text-white font-bold text-sm rounded-xl shadow-lg shadow-[#e50914]/25 cursor-pointer active:scale-98 transition-all"
            >
              {courses.length >= 2
                ? (isEn ? "Subscribe to Bundle" : "اشترك في الباقة الآن")
                : (isEn ? "Enroll Now" : "متابعة الشراء")}
            </Button>

            <button
              type="button"
              onClick={clear}
              className="w-full text-[11px] text-white/50 hover:text-red-400 py-1 transition-colors cursor-pointer text-center block"
            >
              {isEn ? "Clear Cart" : "تفريغ السلة بالكامل"}
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
