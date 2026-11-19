import { Link, useNavigate } from "@tanstack/react-router";
import { Star, ShoppingCart, Heart, Users, PlayCircle, Sparkles, ArrowUpLeft, CheckCircle2 } from "lucide-react";
import { useWishlist } from "@/hooks/use-wishlist";
import { useCart } from "@/hooks/use-cart";
import { usePricing } from "@/lib/pricing";
import type { StaticCourse } from "@/lib/staticCoursesData";

const LEVEL_AR: Record<string, string> = {
  beginner: "مبتدئ",
  intermediate: "متوسط",
  advanced: "متقدم",
};

export function CourseCard({
  course,
  enrolled = false,
}: {
  course: StaticCourse | any;
  enrolled?: boolean;
}) {
  const navigate = useNavigate();
  const { toggle: toggleWish, isSaved } = useWishlist();
  const saved = isSaved(course.id);
  const { toggle: toggleCart, has: inCart } = useCart();
  const cartAdded = inCart(course.id);
  const { fmt: formatPrice } = usePricing();

  const cleanTitle = String(course.title || "").replace(/\*\*/g, "").trim();
  const rawPrice = Number(course.price ?? 0);
  const rawDiscount = course.discount_price != null ? Number(course.discount_price) : null;
  const hasDiscount = rawDiscount !== null && rawDiscount >= 0 && rawDiscount < rawPrice;
  const finalPrice = hasDiscount ? rawDiscount! : rawPrice;
  const discountPct = hasDiscount && rawPrice > 0 ? Math.round(((rawPrice - finalPrice) / rawPrice) * 100) : 0;
  const isFree = course.is_free || finalPrice === 0;
  const levelLabel = LEVEL_AR[String(course.level || "").toLowerCase()] || course.level || "كل المستويات";
  const ratingVal = Number(course.rating || 4.9);

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWish(course.id);
  };

  const handleCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (enrolled) return;
    toggleCart(course.id);
  };

  const handleSubscribe = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (enrolled) {
      navigate({ to: "/learn/$slug", params: { slug: course.slug || course.id } });
    } else {
      navigate({ to: "/checkout/$courseId", params: { courseId: course.id } });
    }
  };

  return (
    <div className="group relative flex flex-col rounded-2xl bg-[#19171b] border border-white/[0.08] hover:border-[#e50914]/50 overflow-hidden shadow-xl hover:shadow-[0_20px_50px_-15px_rgba(229,9,20,0.22)] transition-all duration-300 hover:-translate-y-1">
      {/* Thumbnail Container */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#111012]">
        <img
          src={
            course.image_url ||
            "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80"
          }
          alt={cleanTitle}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#19171b] via-black/20 to-transparent opacity-85" />

        {/* Top Badges */}
        <div className="absolute top-3 inset-x-3 flex items-center justify-between gap-2 z-10">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-black/70 backdrop-blur-md text-white/90 border border-white/15">
              {levelLabel}
            </span>
            {discountPct > 0 && !enrolled && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-[#e50914] text-white shadow-md">
                خصم {discountPct}%
              </span>
            )}
            {enrolled && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500 text-white inline-flex items-center gap-1 shadow-md">
                <CheckCircle2 className="w-3 h-3" /> مشترك
              </span>
            )}
          </div>

          {/* Floating Wishlist Button */}
          <button
            type="button"
            onClick={handleWishlist}
            className={`w-8 h-8 rounded-full backdrop-blur-md border flex items-center justify-center transition-all cursor-pointer ${
              saved
                ? "bg-[#e50914] border-[#e50914] text-white shadow-md shadow-[#e50914]/40"
                : "bg-black/55 border-white/15 text-white/80 hover:bg-black/80 hover:text-white"
            }`}
            title={saved ? "إزالة من المفضلة" : "إضافة للمفضلة"}
            aria-label="المفضلة"
          >
            <Heart className={`w-3.5 h-3.5 ${saved ? "fill-white" : ""}`} />
          </button>
        </div>

        {/* Hover Preview Overlay */}
        <Link
          to="/courses/$slug"
          params={{ slug: course.slug || course.id }}
          className="absolute inset-0 z-[5] flex items-center justify-center bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        >
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-[#121212] text-xs font-extrabold shadow-xl transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
            <PlayCircle className="w-4 h-4 text-[#e50914]" />
            <span>استعراض تفاصيل الكورس</span>
            <ArrowUpLeft className="w-3.5 h-3.5" />
          </span>
        </Link>

        {/* Bottom Meta Strip on Image */}
        <div className="absolute bottom-2.5 inset-x-3 z-10 flex items-center justify-between text-xs">
          {course.category && (
            <span className="text-[11px] font-bold text-[#f5c518] bg-black/60 backdrop-blur-sm px-2.5 py-0.5 rounded-md border border-[#f5c518]/25 truncate max-w-[65%]">
              {course.category}
            </span>
          )}
          <div className="flex items-center gap-2.5 mr-auto bg-black/60 backdrop-blur-sm px-2.5 py-0.5 rounded-md border border-white/10">
            <span className="inline-flex items-center gap-1 font-bold text-white text-[11.5px]">
              <Star className="w-3 h-3 fill-[#f5c518] text-[#f5c518]" />
              {(ratingVal > 0 ? ratingVal : 4.9).toFixed(1)}
            </span>
            <span className="text-white/30">|</span>
            <span className="inline-flex items-center gap-1 text-white/80 text-[11px]">
              <Users className="w-3 h-3 text-white/60" />
              {course.students_count || 18}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <Link
          to="/courses/$slug"
          params={{ slug: course.slug || course.id }}
          className="text-base font-extrabold text-white group-hover:text-[#f5c518] transition-colors line-clamp-2 leading-snug mb-1.5"
          title={cleanTitle}
        >
          {cleanTitle}
        </Link>

        {course.short_description ? (
          <p className="text-xs text-white/55 line-clamp-2 leading-relaxed mb-3">
            {course.short_description}
          </p>
        ) : (
          <p className="text-xs text-white/45 mb-3">
            بإشراف {course.instructor_name || "فريق فكرة ديزاين"}
          </p>
        )}

        {/* Footer: Price + CTA */}
        <div className="mt-auto pt-3.5 border-t border-white/[0.07] flex items-center justify-between gap-2">
          <div>
            {enrolled ? (
              <span className="text-xs font-extrabold text-emerald-400">مُفعّل في حسابك</span>
            ) : isFree ? (
              <span className="inline-flex items-center gap-1 text-sm font-black text-emerald-400">
                <Sparkles className="w-3.5 h-3.5" /> مجاناً
              </span>
            ) : (
              <div className="flex flex-col">
                <span className="text-base sm:text-lg font-black text-white leading-none">
                  {formatPrice(finalPrice)}
                </span>
                {hasDiscount && (
                  <span className="text-[11px] text-white/40 line-through mt-0.5">
                    {formatPrice(rawPrice)}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {!enrolled && !isFree && (
              <button
                type="button"
                onClick={handleCart}
                className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                  cartAdded
                    ? "bg-[#f5c518]/20 border-[#f5c518] text-[#f5c518]"
                    : "bg-white/[0.05] border-white/10 text-white/80 hover:bg-white/[0.12] hover:text-white"
                }`}
                title={cartAdded ? "مضاف للسلة" : "أضف للسلة"}
                aria-label="السلة"
              >
                <ShoppingCart className="w-4 h-4" />
              </button>
            )}

            {enrolled ? (
              <Link
                to="/learn/$slug"
                params={{ slug: course.slug || course.id }}
                className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold inline-flex items-center justify-center transition-all shadow-md shadow-emerald-600/20"
              >
                ابدأ المشاهدة
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleSubscribe}
                className="h-9 px-4 rounded-xl bg-gradient-to-r from-[#e50914] to-[#b80710] hover:from-[#ff1f2a] hover:to-[#d10813] text-white text-xs font-extrabold inline-flex items-center justify-center transition-all shadow-md shadow-[#e50914]/25 cursor-pointer"
              >
                {isFree ? "ابدأ مجاناً" : "اشترك الآن"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
