import { useState, useId, useEffect } from "react";
import { Check, Plus, X, ShoppingCart, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/use-cart";
import { toast } from "sonner";

interface CustomBundleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CustomBundleModal({ isOpen, onClose }: CustomBundleModalProps) {
  if (!isOpen) return null;

  const titleId = useId();
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [bundleName, setBundleName] = useState("باقتي التعليمية الخاصة");
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const { add } = useCart();

  useEffect(() => {
    supabase
      .from("courses")
      .select("id, title, price, discount_price, image_url, is_free")
      .eq("status", "published")
      .eq("is_hidden", false)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const paid = (data as any[]).filter((c: any) => !c.is_free && (c.price > 0 || c.discount_price > 0));
          setAllCourses(paid);
          if (paid.length >= 2) {
            setSelectedCourseIds([paid[0].id, paid[1].id]);
          } else if (paid.length === 1) {
            setSelectedCourseIds([paid[0].id]);
          }
        }
      });
  }, []);

  const toggleCourse = (id: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectedCourses = allCourses.filter((c) => selectedCourseIds.includes(c.id));
  const rawTotal = selectedCourses.reduce((sum, c) => sum + (c.discount_price || c.price), 0);
  const discountAmount = Math.round(rawTotal * 0.08);
  const finalPrice = Math.max(0, rawTotal - discountAmount);

  const handleSaveAndAddToCart = () => {
    if (selectedCourseIds.length < 2) {
      toast.error("يجب اختيار دورتين على الأقل لإنشاء الباقة والحصول على الخصم");
      return;
    }

    // Add each selected course into cart
    selectedCourseIds.forEach((id) => add(id));
    toast.success(`تم إنشاء "${bundleName}" وتطبيق خصم 8% وإضافتها إلى سلة مشترياتك!`);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-3xl bg-[#1e1b1b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 left-4 z-10 w-8 h-8 rounded-full bg-[#e50914] hover:bg-[#393434] text-white flex items-center justify-center transition-colors"
          title="إلغاء"
          aria-label="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="p-6 border-b border-white/10 bg-[#121212]">
          <div className="flex items-center gap-2 text-[#e50914] text-sm font-semibold mb-1">
            <Sparkles className="w-4 h-4" />
            <span>عرض حصري - خصم 8%</span>
          </div>
          <h2 id={titleId} className="text-2xl font-bold text-white">إنشيء باقتك الخاصة</h2>
          <p className="text-white/60 text-xs mt-1">اختر الدورات التي ترغب في دراستها وسنمنحك خصماً إضافياً 8% على إجمالي الباقة فوراً</p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 thin-scroll">
          {/* Summary Box */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#252121] p-4 rounded-xl border border-white/5">
            <div>
              <label className="block text-white/80 text-xs font-semibold mb-1">اسم الباقة</label>
              <input
                type="text"
                value={bundleName}
                onChange={(e) => setBundleName(e.target.value)}
                className="w-full bg-[#393434] text-white text-sm px-3 py-2 rounded-lg border border-white/10 focus:outline-none focus:border-[#e50914]"
                placeholder="أدخل اسم الباقة"
              />
            </div>
            <div>
              <span className="block text-white/80 text-xs font-semibold mb-1">عدد الدورات المختارة</span>
              <div className="bg-[#393434] text-white text-sm px-3 py-2 rounded-lg font-bold text-center border border-white/10">
                {selectedCourseIds.length} دورات
              </div>
            </div>
            <div>
              <span className="block text-white/80 text-xs font-semibold mb-1">السعر الإجمالي بعد الخصم</span>
              <div className="bg-[#393434] text-white text-sm px-3 py-2 rounded-lg flex items-center justify-between border border-white/10">
                <span className="text-white/40 line-through text-xs">${rawTotal}</span>
                <span className="text-[#5aca26] font-bold text-base">${finalPrice}</span>
              </div>
            </div>
          </div>

          {/* Courses Selector */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold text-sm">
                اختر دورات الباقة <span className="text-xs font-normal text-white/60">(يجب اختيار دورتين على الأقل)</span>
              </h3>
              <span className="text-xs text-[#e50914] font-semibold">وفر ${discountAmount} اليوم</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto p-1">
              {allCourses.map((c) => {
                const selected = selectedCourseIds.includes(c.id);
                return (
                  <div
                    key={c.id}
                    onClick={() => toggleCourse(c.id)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all duration-200 select-none ${
                      selected
                        ? "bg-[#393434] border-[#e50914] shadow-md"
                        : "bg-[#252121] border-white/5 hover:border-white/20"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                        selected ? "bg-[#e50914] border-[#e50914] text-white" : "border-white/30 bg-transparent"
                      }`}
                    >
                      {selected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <img
                      src={c.image_url}
                      alt={c.title}
                      className="w-14 h-10 rounded-lg object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white text-xs font-semibold truncate">{c.title}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-white/60">{c.category}</span>
                        <span className="text-xs font-bold text-white">${c.discount_price || c.price}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/10 bg-[#121212] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-[#393434] hover:bg-[#4a4444] text-white text-xs font-semibold transition-colors"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSaveAndAddToCart}
            className="main__btn green text-xs px-6 py-2.5 shadow-lg shadow-[#5aca26]/20"
          >
            <ShoppingCart className="w-4 h-4" />
            حفظ وإضافة للسلة
          </button>
        </div>
      </div>
    </div>
  );
}
