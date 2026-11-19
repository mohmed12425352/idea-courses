import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SiteShell } from "@/components/layout/SiteShell";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  CheckCircle2, Clock, PlayCircle, Star, Lock, Play, Users, Award,
  Globe, Infinity as InfinityIcon, Film, GraduationCap, Rocket, Target,
  Lightbulb, Video, ShieldCheck, Heart, ShoppingCart, Share2, Check,
  ChevronDown, AlertCircle, MessageSquareText, Image as ImageIcon, ZoomIn, X, ChevronRight, ChevronLeft
} from "lucide-react";
import { allReviewImages } from "@/components/common/reviewImages";
import { STATIC_REVIEWS } from "@/lib/staticCoursesData";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { swr } from "@/lib/cache";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FakePurchaseNotifier } from "@/components/common/FakePurchaseNotifier";
import { useI18n } from "@/lib/i18n";
import { usePricing } from "@/lib/pricing";
import { useWishlist } from "@/hooks/use-wishlist";
import { useCart } from "@/hooks/use-cart";
import { getStaticCourseBySlug } from "@/lib/staticCoursesData";
import { SecurePlayer } from "@/components/common/SecurePlayer";

function parseDurationToSeconds(d: any): number {
  if (d == null) return 0;
  const s = String(d).trim();
  if (!s) return 0;
  if (/^\d+:\d+:\d+$/.test(s)) {
    const p = s.split(":").map(Number);
    return p[0] * 3600 + p[1] * 60 + p[2];
  }
  if (/^\d+:\d+$/.test(s)) {
    const p = s.split(":").map(Number);
    return p[0] * 60 + p[1];
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n * 60;
}

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s <= 0) return "";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} ${h === 1 ? "ساعة" : h === 2 ? "ساعتين" : h <= 10 ? "ساعات" : "ساعة"}`);
  if (m > 0) parts.push(`${m} دقيقة`);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} و ${parts[1]}`;
}

export const Route = createFileRoute("/courses_/$slug")({
  loader: async ({ params }) => {
    try {
      const raw = String(params.slug || "").trim();
      let decoded = raw;
      try { decoded = decodeURIComponent(raw).trim(); } catch {}
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);

      let q = supabase.from("courses").select("*");
      if (isUuid) {
        q = q.or(`id.eq.${raw},slug.eq.${raw}`);
      } else if (decoded !== raw) {
        q = q.or(`slug.eq.${raw},slug.eq.${decoded},slug.ilike.${raw},slug.ilike.${decoded}`);
      } else {
        q = q.or(`slug.eq.${raw},slug.ilike.${raw}`);
      }
      const { data } = await q.maybeSingle();
      if (data) return { initialCourse: data };

      const fallback = getStaticCourseBySlug(raw) || getStaticCourseBySlug(decoded);
      return { initialCourse: fallback || null };
    } catch {
      return { initialCourse: null };
    }
  },
  head: ({ loaderData, params }) => {
    const course = (loaderData as any)?.initialCourse;
    const title = course?.title
      ? `${course.title} — Idea Courses`
      : "تفاصيل الدورة — Idea Courses";
    const rawDesc = course?.short_description || course?.description || "دورة تعليمية احترافية عبر منصة فكرة Idea Courses.";
    const cleanDesc = rawDesc.replace(/<[^>]*>?/gm, "").slice(0, 160).trim();
    const image = course?.image_url || "/logo.png";
    const canonical = `https://fekradesign.shalaby3.online/courses/${params.slug}`;

    return {
      meta: [
        { title },
        { name: "description", content: cleanDesc },
        { property: "og:title", content: title },
        { property: "og:description", content: cleanDesc },
        { property: "og:image", content: image },
        { property: "og:url", content: canonical },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: cleanDesc },
        { name: "twitter:image", content: image },
      ],
      links: [
        { rel: "canonical", href: canonical },
      ],
      scripts: course?.title
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Course",
                "name": course.title,
                "description": cleanDesc,
                "provider": {
                  "@type": "Organization",
                  "name": "Idea Courses",
                  "sameAs": "https://fekradesign.shalaby3.online",
                },
                ...(course.price
                  ? {
                      "offers": {
                        "@type": "Offer",
                        "price": course.price,
                        "priceCurrency": "EGP",
                        "availability": "https://schema.org/InStock",
                      },
                    }
                  : {}),
              }),
            },
          ]
        : [],
    };
  },
  component: CourseDetailPage,
});

function CourseDetailPage() {
  const { slug } = Route.useParams();
  const loaderData = Route.useLoaderData();
  const { user, profile, isAdmin, isModerator } = useAuth();
  const nav = useNavigate();
  const { isEn } = useI18n();
  const { adjust } = usePricing();
  const { toggle: toggleWish, isSaved } = useWishlist();
  const { toggle: toggleCart, has: inCart } = useCart();

  const [loading, setLoading] = useState(!loaderData?.initialCourse);
  const [course, setCourse] = useState<any>(() => loaderData?.initialCourse || null);
  const [modules, setModules] = useState<any[]>([]);
  const [enrolled, setEnrolled] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [previewLesson, setPreviewLesson] = useState<{ url: string; title: string } | null>(null);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reviews tabs & WhatsApp screenshots state
  const [reviewTab, setReviewTab] = useState<"written" | "whatsapp">("written");
  const [whatsappImages, setWhatsappImages] = useState<string[]>(allReviewImages);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowRight") {
        setLightboxIndex((prev) => (prev !== null ? (prev - 1 + whatsappImages.length) % whatsappImages.length : 0));
      }
      if (e.key === "ArrowLeft") {
        setLightboxIndex((prev) => (prev !== null ? (prev + 1) % whatsappImages.length : 0));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, whatsappImages.length]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1. Try Supabase
      let c: any = null;
      const raw = String(slug || "").trim();
      let decoded = raw;
      try { decoded = decodeURIComponent(raw).trim(); } catch {}
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);

      try {
        const cached = await swr(`course:slug:${raw}`, 5 * 60_000, async () => {
          let q = supabase.from("courses").select("*");
          if (isUuid) {
            q = q.or(`id.eq.${raw},slug.eq.${raw}`);
          } else if (decoded !== raw) {
            q = q.or(`slug.eq.${raw},slug.eq.${decoded},slug.ilike.${raw},slug.ilike.${decoded}`);
          } else {
            q = q.or(`slug.eq.${raw},slug.ilike.${raw}`);
          }
          const { data } = await q.maybeSingle();
          return data;
        });
        if (cached) c = cached;
      } catch (err) {
        // ignore network error
      }

      if (!c) {
        c = getStaticCourseBySlug(raw) || getStaticCourseBySlug(decoded);
      }

      if (cancelled) return;

      if (!c) {
        if (!loaderData?.initialCourse) {
          setCourse(null);
        }
        setLoading(false);
        return;
      }
      setCourse(c);
      setLoading(false);

      // Outline from supabase
      try {
        const { data: outlineData } = await supabase.rpc("get_course_outline", { _course_id: c.id });
        if (outlineData && Array.isArray(outlineData) && outlineData.length > 0) {
          const map = new Map<string, any>();
          for (const r of outlineData as any[]) {
            if (!r.module_id) continue;
            if (!map.has(r.module_id)) {
              map.set(r.module_id, {
                id: r.module_id,
                title: r.module_title,
                order_index: r.module_order,
                lessons: [],
              });
            }
            if (r.lesson_id) {
              map.get(r.module_id).lessons.push({
                id: r.lesson_id,
                title: r.lesson_title,
                duration: r.lesson_duration,
                order_index: r.lesson_order,
                is_preview: r.is_preview,
              });
            }
          }
          const sortedMods = Array.from(map.values())
            .sort((a, b) => (Number(a.order_index ?? 0) - Number(b.order_index ?? 0)))
            .map((m) => ({
              ...m,
              lessons: m.lessons.sort((a: any, b: any) => (Number(a.order_index ?? 0) - Number(b.order_index ?? 0))),
            }));
          setModules(sortedMods);
        } else {
          const fallback = getStaticCourseBySlug(raw) || getStaticCourseBySlug(decoded);
          if (fallback?.modules) setModules(fallback.modules);
        }
      } catch {
        const fallback = getStaticCourseBySlug(raw) || getStaticCourseBySlug(decoded);
        if (fallback?.modules) setModules(fallback.modules);
      }

      // Check enrollment accurately
      if (user) {
        if (isAdmin || isModerator) {
          setEnrolled(true);
        } else {
          const { data: userEnrs } = await supabase
            .from("enrollments")
            .select("id, course_id, status, courses(id, slug)")
            .eq("user_id", user.id)
            .neq("status", "banned");

          const isMatch = (userEnrs ?? []).some((enr: any) => {
            const courseObj = Array.isArray(enr.courses) ? enr.courses[0] : enr.courses;
            return (
              (c?.id && enr.course_id === c.id) ||
              enr.course_id === raw ||
              courseObj?.id === c?.id ||
              courseObj?.slug === raw ||
              courseObj?.slug === decoded ||
              (c?.slug && (courseObj?.slug === c.slug || enr.course_id === c.id))
            );
          });
          setEnrolled(isMatch);
        }
      }

      // Fetch reviews for this course
      try {
        const { data: dbRevs } = await supabase
          .from("reviews")
          .select("id,rating,comment,created_at,author_name,is_approved,user_id")
          .eq("course_id", c.id)
          .eq("is_approved", true)
          .order("created_at", { ascending: false });

        let list = (dbRevs ?? []) as any[];

        if (user) {
          const { data: myRev } = await supabase
            .from("reviews")
            .select("id,rating,comment,created_at,author_name,is_approved,user_id")
            .eq("course_id", c.id)
            .eq("user_id", user.id)
            .maybeSingle();

          if (myRev && !list.some((r) => r.id === myRev.id)) {
            list = [myRev, ...list];
          }
        }

        if (list.length === 0) {
          list = STATIC_REVIEWS.slice(0, 6).map((sr) => ({
            id: sr.id,
            author_name: sr.user_name,
            rating: sr.rating,
            comment: sr.comment,
            created_at: new Date().toISOString(),
            is_approved: true,
          }));
        }

        if (!cancelled) setReviews(list);
      } catch (err) {
        console.warn("Failed to load reviews:", err);
      }

      // Fetch success stories (WhatsApp screenshots) if available in DB
      try {
        const { data: stories } = await supabase
          .from("success_stories")
          .select("id,image_url,caption,order_index,is_published")
          .eq("is_published", true)
          .order("order_index", { ascending: true })
          .order("created_at", { ascending: false });

        if (!cancelled && stories && stories.length > 0) {
          const urls = stories.map((s: any) => s.image_url).filter(Boolean);
          if (urls.length > 0) {
            setWhatsappImages(urls);
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [slug, user, isAdmin, isModerator]);

  if (loading && !course) {
    return (
      <SiteShell>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 bg-[#252121]">
          <div className="w-16 h-16 rounded-full bg-[#e50914]/10 flex items-center justify-center text-[#e50914] mb-4 animate-pulse">
            <Video className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">جاري تحميل بيانات الدورة…</h2>
          <p className="text-white/60 text-sm max-w-sm mb-6">
            يرجى الانتظار قليلاً...
          </p>
        </div>
      </SiteShell>
    );
  }

  if (!course) {
    return (
      <SiteShell>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 bg-[#252121]">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">عذراً، لم يتم العثور على هذه الدورة</h2>
          <p className="text-white/60 text-sm max-w-sm mb-6">
            قد يكون تم تغيير رابط الدورة أو أنها لم تعد متاحة حالياً.
          </p>
          <Link
            to="/courses"
            className="main__btn small"
          >
            تصفح جميع الدورات
          </Link>
        </div>
      </SiteShell>
    );
  }

  const finalPrice = adjust(course.discount_price ?? course.price);
  const listPrice = adjust(course.price);
  const hasDiscount = course.discount_price && course.discount_price < course.price;
  const isFree = course.is_free || course.price === 0 || course.discount_price === 0;

  const totalLessons = modules.reduce((s, m) => s + (m.lessons?.length ?? 0), 0) || course.lessons_count || 32;
  const totalSeconds = modules.reduce(
    (s, m) => s + (m.lessons ?? []).reduce((ss: number, l: any) => ss + parseDurationToSeconds(l.duration), 0),
    0
  );

  const suitableFor: string[] = course.suitable_for || [
    "تريد صناعة محتوى وبناء هوية وعلامة تجارية احترافية بسرعة وجودة عالية",
    "صاحب مشروع وتريد إنتاج محتوى وإعلانات مميزة دون الحاجة للاعتماد على شركات",
    "فريلانسر وتريد تقديم خدمات المونتاج والموشن جرافيك لعملائك بمقابل مادي ممتاز",
    "مبتدئ وتبحث عن مسار عملي واضح لتعلم المجال خطوة بخطوة بدون تشتت",
  ];

  const whatYouLearn: string[] = course.what_you_learn || [
    "إتقان كافة الأدوات والميزات الاحترافية واستخدامها بكفاءة",
    "فهم خطوات بناء العمل من البداية وحتى مرحلة الريندر النهائي",
    "توظيف أحدث تقنيات الذكاء الاصطناعي لرفع سرعة وإتقان المشاريع",
    "تنفيذ تطبيقات عملية ومشاريع تجارية كاملة خطوة بخطوة",
    "نصائح تسعير الخدمات والتعامل مع العملاء في سوق العمل الحر",
    "شهادة إتمام معتمدة توثق مهاراتك ومكتسباتك بالدورة",
  ];

  const requirements: string[] = course.requirements || [
    "لا يشترط أي خبرة سابقة، نبدأ معك من الصفر تماماً",
    "جهاز كمبيوتر أو لابتوب بمواصفات متوسطة على الأقل",
    "اتصال بالإنترنت والشغف الجاد للتطبيق والممارسة العملية",
  ];

  const handleEnroll = () => {
    if (!user) {
      toast.info("سجّل حسابك أولاً للاشتراك في الدورة");
      nav({ to: "/register", search: { redirect: `/courses/${course.slug}` } });
      return;
    }
    if (enrolled) {
      nav({ to: "/learn/$slug", params: { slug: course.slug } });
      return;
    }
    nav({ to: "/checkout/$courseId", params: { courseId: course.id } });
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      toast.success("تم نسخ رابط الدورة بنجاح");
    }
  };

  const submitReview = async () => {
    if (!user || !course) {
      toast.error(isEn ? "Please log in first" : "يرجى تسجيل الدخول أولاً");
      return;
    }
    const text = newComment.trim();
    if (text.length < 3) {
      toast.error(isEn ? "Write your review in detail (at least 3 characters)" : "اكتب رأيك بالتفصيل (3 أحرف على الأقل)");
      return;
    }
    setSubmitting(true);
    try {
      const authorName = profile?.name || user.email?.split("@")[0] || "طالب متميز";
      const { data, error } = await supabase
        .from("reviews")
        .insert({
          user_id: user.id,
          course_id: course.id,
          rating: newRating,
          comment: text,
          author_name: authorName,
        })
        .select("id,rating,comment,created_at,author_name,is_approved,user_id")
        .maybeSingle();

      if (error) throw error;

      const newRev = data || {
        id: "new-" + Date.now(),
        author_name: authorName,
        rating: newRating,
        comment: text,
        created_at: new Date().toISOString(),
        is_approved: false,
      };

      setReviews((prev) => [newRev, ...prev]);
      setNewComment("");
      toast.success(isEn ? "Thank you! Your review has been submitted" : "تم إرسال تقييمك بنجاح، شكراً لمشاركتك ❤️");
    } catch (err: any) {
      console.error("Submit review error:", err);
      toast.error(isEn ? "Failed to submit review" : "تعذر إرسال التقييم، يرجى المحاولة لاحقاً");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SiteShell>
      {!enrolled && <FakePurchaseNotifier courseTitle={course.title} />}

      <div className="bg-[#252121] text-white min-h-screen py-8 pb-36 lg:pb-12">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6">

          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-xs text-white/50 mb-6 overflow-x-auto whitespace-nowrap">
            <Link to="/" className="hover:text-white transition-colors">الرئيسية</Link>
            <span>/</span>
            <Link to="/courses" className="hover:text-white transition-colors">الدورات التعليمية</Link>
            <span>/</span>
            {course.category && (
              <>
                <span className="hover:text-white transition-colors">{course.category}</span>
                <span>/</span>
              </>
            )}
            <span className="text-[#e50914] font-semibold truncate max-w-[280px]">{course.title}</span>
          </nav>

          {/* Top Hero Preview Video / Banner */}
          <div className="relative aspect-video max-h-[460px] w-full overflow-hidden rounded-2xl border border-[#443e3e] bg-black shadow-2xl mb-8">
            {course.preview_video_url ? (
              <CoursePreviewMedia url={course.preview_video_url} poster={course.image_url} title={course.title} />
            ) : course.image_url ? (
              <img src={course.image_url} alt={course.title} className="w-full h-full object-cover" />
            ) : null}
          </div>

          {/* Main 2-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">

            {/* Left Column: Course Info & Details */}
            <div className="space-y-6">

              {/* Title & Meta */}
              <div className="bg-[#2f2b2b] border border-[#443e3e] rounded-2xl p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {course.level && (
                    <span className="px-3 py-1 rounded-md text-xs font-bold bg-[#443e3e] text-white">
                      المستوى: {course.level}
                    </span>
                  )}
                  {course.category && (
                    <span className="px-3 py-1 rounded-md text-xs font-bold bg-[#e50914]/15 text-[#e50914] border border-[#e50914]/30">
                      {course.category}
                    </span>
                  )}
                  {isFree && (
                    <span className="px-3 py-1 rounded-md text-xs font-bold bg-[#5aca26]/20 text-[#5aca26] border border-[#5aca26]/40">
                      دورة مجانية
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-4">
                  {course.title}
                </h1>

                <p className="text-sm sm:text-base text-white/70 leading-relaxed mb-6">
                  {course.short_description || course.description}
                </p>

                {/* Quick Info Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-[#443e3e]/60 text-center">
                  <div className="bg-[#383333] rounded-xl p-3">
                    <div className="flex items-center justify-center gap-1 text-[#ffb800] font-black text-base">
                      <Star className="w-4 h-4 fill-current" />
                      <span>{(course.rating || 5.0).toFixed(1)}</span>
                    </div>
                    <div className="text-[11px] text-white/50 mt-0.5">({course.reviews_count || 48} تقييم)</div>
                  </div>

                  <div className="bg-[#383333] rounded-xl p-3">
                    <div className="flex items-center justify-center gap-1 text-white font-black text-base">
                      <Users className="w-4 h-4 text-[#e50914]" />
                      <span>{course.students_count || 320}</span>
                    </div>
                    <div className="text-[11px] text-white/50 mt-0.5">طالب ملتحق</div>
                  </div>

                  <div className="bg-[#383333] rounded-xl p-3">
                    <div className="flex items-center justify-center gap-1 text-white font-black text-base">
                      <Film className="w-4 h-4 text-[#5aca26]" />
                      <span>{totalLessons}</span>
                    </div>
                    <div className="text-[11px] text-white/50 mt-0.5">دروس الدورة</div>
                  </div>

                  <div className="bg-[#383333] rounded-xl p-3">
                    <div className="flex items-center justify-center gap-1 text-white font-black text-base">
                      <Clock className="w-4 h-4 text-[#3073df]" />
                      <span>{totalSeconds > 0 ? formatDuration(totalSeconds) : (course.duration || "8 ساعات")}</span>
                    </div>
                    <div className="text-[11px] text-white/50 mt-0.5">إجمالي المدة</div>
                  </div>
                </div>
              </div>

              {/* What you'll learn */}
              <div className="bg-[#2f2b2b] border border-[#443e3e] rounded-2xl p-6 sm:p-8">
                <div className="flex items-center gap-2 mb-5">
                  <span className="w-8 h-8 rounded-lg bg-[#5aca26]/20 flex items-center justify-center text-[#5aca26]">
                    <Rocket className="w-4 h-4" />
                  </span>
                  <h2 className="text-lg font-black text-white">ماذا ستتعلم في هذه الدورة ؟</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {whatYouLearn.map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5 bg-[#383333] rounded-xl p-3.5 border border-[#484242]">
                      <CheckCircle2 className="w-4 h-4 text-[#5aca26] shrink-0 mt-0.5" />
                      <span className="text-xs sm:text-sm text-white/90 leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Suitable for */}
              <div className="bg-[#2f2b2b] border border-[#443e3e] rounded-2xl p-6 sm:p-8">
                <div className="flex items-center gap-2 mb-5">
                  <span className="w-8 h-8 rounded-lg bg-[#e50914]/20 flex items-center justify-center text-[#e50914]">
                    <Target className="w-4 h-4" />
                  </span>
                  <h2 className="text-lg font-black text-white">هذا الكورس مناسب لك إذا كنت :</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {suitableFor.map((item, i) => (
                    <div key={i} className="bg-[#383333] rounded-xl p-3.5 border border-[#484242] text-xs sm:text-sm text-white/85 leading-relaxed flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#e50914] shrink-0 mt-2" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Requirements */}
              <div className="bg-[#2f2b2b] border border-[#443e3e] rounded-2xl p-6 sm:p-8">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-8 h-8 rounded-lg bg-[#3073df]/20 flex items-center justify-center text-[#3073df]">
                    <GraduationCap className="w-4 h-4" />
                  </span>
                  <h2 className="text-lg font-black text-white">ماذا تحتاج لبدء الدورة ؟</h2>
                </div>
                <div className="space-y-2">
                  {requirements.map((req, i) => (
                    <div key={i} className="bg-[#383333] rounded-xl px-4 py-3 border border-[#484242] text-xs sm:text-sm text-white/80">
                      • {req}
                    </div>
                  ))}
                </div>
              </div>

              {/* Curriculum */}
              <div id="course-curriculum" className="bg-[#2f2b2b] border border-[#443e3e] rounded-2xl p-6 sm:p-8">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-[#e50914]/20 flex items-center justify-center text-[#e50914]">
                      <Video className="w-4 h-4" />
                    </span>
                    <h2 className="text-lg font-black text-white">مسار التعلم / محتوى الدورة</h2>
                  </div>
                  <span className="text-xs text-white/50">{totalLessons} درس • {modules.length} فصول</span>
                </div>

                {modules.length === 0 ? (
                  <p className="text-center text-white/50 text-sm py-6">سيتم إضافة المحتوى قريباً</p>
                ) : (
                  <Accordion type="multiple" className="space-y-3">
                    {modules.map((m, idx) => (
                      <AccordionItem
                        key={m.id}
                        value={m.id}
                        className="bg-[#383333] border border-[#484242] rounded-xl px-4 py-1 overflow-hidden"
                      >
                        <AccordionTrigger className="hover:no-underline py-3 text-right">
                          <div className="flex items-center justify-between w-full pl-2">
                            <div className="flex items-center gap-2 text-right">
                              <span className="text-[#e50914] font-black text-sm">فصل {idx + 1} |</span>
                              <span className="text-sm font-bold text-white">{m.title}</span>
                            </div>
                            <span className="text-xs text-white/50 font-normal">
                              {m.lessons?.length || 0} درس
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-3 border-t border-[#484242]/70 space-y-2">
                          {(m.lessons || []).map((l: any, lIdx: number) => {
                            const canWatch = l.is_preview || enrolled;
                            return (
                              <div
                                key={l.id || lIdx}
                                className="flex items-center justify-between gap-2.5 sm:gap-4 p-2.5 sm:p-3 rounded-xl bg-[#2f2b2b] border border-[#443e3e] hover:border-[#e50914]/40 transition-colors"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  {canWatch ? (
                                    <PlayCircle className="w-4 h-4 text-[#e50914] shrink-0" />
                                  ) : (
                                    <Lock className="w-4 h-4 text-white/30 shrink-0" />
                                  )}
                                  <div className="min-w-0 flex-1 flex flex-wrap items-center gap-1.5 sm:gap-2">
                                    <span className="text-xs sm:text-sm font-medium text-white/90 leading-snug break-words">
                                      {l.title}
                                    </span>
                                    {l.is_preview && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#5aca26]/20 text-[#5aca26] border border-[#5aca26]/30 shrink-0 whitespace-nowrap">
                                        معاينة مجانية
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                  {l.duration && (
                                    <span className="text-[11px] sm:text-xs text-white/50 font-medium whitespace-nowrap">
                                      {l.duration}
                                    </span>
                                  )}
                                  {canWatch ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (enrolled) {
                                          nav({
                                            to: "/learn/$slug",
                                            params: { slug: course.slug || course.id },
                                            search: { lesson: l.id },
                                          });
                                        } else {
                                          setPreviewLesson({
                                            url: l.video_url || "https://player.vimeo.com/video/1058477380",
                                            title: l.title,
                                          });
                                        }
                                      }}
                                      className="px-2.5 sm:px-3 py-1 bg-[#e50914] hover:bg-[#b8050e] text-white text-[11px] sm:text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0 shadow-sm"
                                    >
                                      <Play className="w-3 h-3 fill-current" />
                                      <span>مشاهدة</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={handleEnroll}
                                      className="px-2.5 sm:px-3 py-1 bg-[#443e3e] hover:bg-[#524b4b] text-white/70 hover:text-white text-[11px] sm:text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                                    >
                                      <Lock className="w-3 h-3" />
                                      <span>مغلق</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </div>

              {/* Instructor */}
              <div className="bg-[#2f2b2b] border border-[#443e3e] rounded-2xl p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-right">
                  <div className="w-20 h-20 rounded-2xl bg-[#e50914] flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-[#e50914]/30 shrink-0">
                    {course.instructor_name?.[0] || "ح"}
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-bold text-[#e50914] uppercase tracking-wider block mb-1">
                      المدرب المعتمد
                    </span>
                    <h3 className="text-xl font-black text-white mb-2">
                      {course.instructor_name || "حسني عبد الرحمن"}
                    </h3>
                    <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                      خبير ومدرّب في مجال الموشن جرافيك والمونتاج وصناعة المحتوى بالذكاء الاصطناعي مع أكثر من 10 سنوات خبرة، درّب ما يزيد عن 15,000 طالب ومبدع في كافة أنحاء العالم العربي.
                    </p>
                  </div>
                </div>
              </div>

              {/* Reviews & Social Proof Section */}
              <div className="bg-[#2f2b2b] border border-[#443e3e] rounded-2xl p-6 sm:p-8 shadow-xl">
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-[#443e3e]/60">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-8 h-8 rounded-lg bg-[#ffb800]/20 flex items-center justify-center text-[#ffb800]">
                        <Star className="w-4 h-4 fill-current" />
                      </span>
                      <h2 className="text-xl font-black text-white">{isEn ? "Student Reviews & Experiences" : "تجارب وآراء طلابنا في الدورة"}</h2>
                    </div>
                    <p className="text-xs text-white/60">
                      {isEn
                        ? "Real feedback and chats from students who learned and achieved results with us"
                        : "آراء حقيقية ومحادثات من المشتركين الذين طبقوا وحققوا نتائج عملية"}
                    </p>
                  </div>

                  {/* Mode Switcher Tabs */}
                  <div className="flex items-center gap-1.5 bg-[#252121] p-1.5 rounded-xl border border-[#443e3e] self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setReviewTab("written")}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        reviewTab === "written"
                          ? "bg-[#e50914] text-white shadow-md shadow-[#e50914]/30"
                          : "text-white/70 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <MessageSquareText className="w-3.5 h-3.5" />
                      <span>{isEn ? "Comments" : "تعليقات الطلاب"} ({reviews.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReviewTab("whatsapp")}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        reviewTab === "whatsapp"
                          ? "bg-[#25D366] text-black shadow-md shadow-[#25D366]/30"
                          : "text-white/70 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>{isEn ? "WhatsApp Chats" : "سكرينات الواتساب"} ({whatsappImages.length})</span>
                    </button>
                  </div>
                </div>

                {/* TAB 1: WRITTEN STUDENT REVIEWS */}
                {reviewTab === "written" && (
                  <>
                    {/* Add Review Box */}
                    {user && (
                      <div className="bg-[#383333] border border-[#484242] rounded-xl p-4 sm:p-5 mb-6 shadow-md">
                        <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-2">
                          <Star className="w-3.5 h-3.5 text-[#ffb800] fill-current" />
                          <span>{isEn ? "Share your review for this course" : "شاركنا رأيك وتجربتك في الدورة"}</span>
                        </h4>
                        <p className="text-[11px] text-white/50 mb-3">
                          {isEn ? "Your review helps fellow students choose their learning path" : "رأيك بيساعد باقي الطلاب ويوجههم للأفضل"}
                        </p>
                        <div className="flex items-center gap-1.5 mb-3">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setNewRating(star)}
                              className="p-1 cursor-pointer transition-transform hover:scale-110"
                            >
                              <Star
                                className={`w-5 h-5 ${
                                  star <= newRating ? "fill-[#ffb800] text-[#ffb800]" : "text-white/20"
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                        <Textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder={isEn ? "Write your detailed review and feedback..." : "اكتب تقييمك وتجربتك مع الدورة بالتفصيل…"}
                          className="bg-[#2f2b2b] text-white border-[#443e3e] text-xs resize-none mb-3 rounded-xl focus-visible:border-[#e50914]"
                          rows={3}
                          maxLength={1000}
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-white/40">{newComment.length} / 1000</span>
                          <button
                            type="button"
                            onClick={submitReview}
                            disabled={submitting || newComment.trim().length < 3}
                            className="main__btn small disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {submitting ? (isEn ? "Posting..." : "جاري النشر…") : (isEn ? "Post Review" : "نشر التقييم")}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Reviews List */}
                    {reviews.length === 0 ? (
                      <div className="text-center py-8 text-white/50 text-xs">
                        {isEn ? "No reviews yet. Be the first to review!" : "لا توجد تقييمات بعد. كن أول من يشارك رأيه!"}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {reviews.map((r, i) => (
                          <div key={r.id || i} className="bg-[#383333] border border-[#484242] hover:border-white/20 transition-all rounded-xl p-4 flex flex-col justify-between shadow-md">
                            <div>
                              <div className="flex items-center justify-between mb-2.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#e50914] to-[#ffb800] text-white font-bold text-xs flex items-center justify-center shadow-sm shrink-0">
                                    {(r.author_name || "ط")[0].toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-xs font-bold text-white block truncate">{r.author_name || (isEn ? "Student" : "طالب معتمد")}</span>
                                    <span className="text-[10px] text-emerald-400 font-medium">طالب معتمد ✓</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-0.5 text-[#ffb800] shrink-0">
                                  {Array.from({ length: 5 }).map((_, si) => (
                                    <Star
                                      key={si}
                                      className={`w-3.5 h-3.5 ${
                                        si < (r.rating || 5) ? "fill-[#ffb800] text-[#ffb800]" : "text-white/20"
                                      }`}
                                    />
                                  ))}
                                </div>
                              </div>
                              <p className="text-xs text-white/80 leading-relaxed">{r.comment}</p>
                            </div>
                            {r.created_at && (
                              <div className="text-[10px] text-white/40 mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
                                <span>{new Date(r.created_at).toLocaleDateString(isEn ? "en-GB" : "ar-EG", { year: "numeric", month: "short", day: "numeric" })}</span>
                                {r.is_approved === false && (
                                  <span className="text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">قيد المراجعة</span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* TAB 2: WHATSAPP SCREENSHOTS GRID */}
                {reviewTab === "whatsapp" && (
                  <div>
                    <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-white/70">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                        <span className="font-semibold text-white/90">سكرينات محادثات ورسائل حقيقية عبر واتساب</span>
                      </span>
                      <span className="text-[11px] text-white/50">اضغط على أي صورة لتكبيرها وقراءتها بوضوح</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                      {whatsappImages.map((imgUrl, i) => (
                        <div
                          key={i}
                          onClick={() => setLightboxIndex(i)}
                          className="group relative aspect-[3/4] bg-[#1e1b1b] border border-[#393434] hover:border-[#25D366] rounded-xl overflow-hidden shadow-md cursor-pointer transition-all duration-200 hover:shadow-xl hover:shadow-[#25D366]/10 flex flex-col justify-between"
                          title="اضغط للتكبير والقراءة"
                        >
                          <div className="relative w-full h-full bg-[#131111] flex items-center justify-center p-1.5">
                            <img
                              src={imgUrl}
                              alt={`رأي واتساب ${i + 1}`}
                              loading="lazy"
                              className="w-full h-full object-contain rounded-lg transition-transform duration-300 group-hover:scale-[1.03]"
                            />

                            {/* Hover Overlay with Zoom Icon */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-1.5 pointer-events-none p-2 text-center">
                              <div className="w-9 h-9 rounded-full bg-[#25D366] text-black flex items-center justify-center shadow-lg font-bold">
                                <ZoomIn className="w-5 h-5" />
                              </div>
                              <span className="text-[11px] font-bold text-white bg-black/70 px-2 py-0.5 rounded-md">تكبير المحادثة</span>
                            </div>

                            {/* WhatsApp Badge */}
                            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-md border border-white/10 text-[10px] text-white font-medium flex items-center gap-1 shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#25D366]" />
                              <span>واتساب #{i + 1}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Right Column: Sticky Sidebar Card (Platform Layout) */}
            <div className="lg:sticky lg:top-24 space-y-4">
              <div className="bg-[#2f2b2b] border border-[#443e3e] rounded-2xl overflow-hidden shadow-2xl">
                {/* Thumbnail */}
                <div className="relative aspect-video w-full bg-black">
                  <img
                    src={course.image_url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800"}
                    alt={course.title}
                    className="w-full h-full object-cover"
                  />
                  {course.level && (
                    <span className="absolute top-3 right-3 px-3 py-1 rounded-md text-xs font-bold bg-[#252121]/90 text-white border border-white/20 backdrop-blur-md">
                      {course.level}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="p-5 sm:p-6 space-y-4">
                  {/* Price */}
                  <div className="flex items-baseline justify-between border-b border-[#443e3e]/60 pb-4">
                    <div>
                      <span className="text-xs text-white/50 block">سعر الاشتراك</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-[#5aca26]">
                          {isFree ? "مجاناً" : `${finalPrice} ج.م`}
                        </span>
                        {hasDiscount && !isFree && (
                          <span className="text-xs text-white/40 line-through">
                            {listPrice} ج.م
                          </span>
                        )}
                      </div>
                    </div>
                    {hasDiscount && !isFree && (
                      <span className="px-2.5 py-1 rounded-md bg-[#e50914]/20 text-[#e50914] text-xs font-bold border border-[#e50914]/30">
                        خصم {Math.round(((listPrice - finalPrice) / listPrice) * 100)}%
                      </span>
                    )}
                  </div>

                  {/* Primary Enroll Button */}
                  <button
                    type="button"
                    onClick={handleEnroll}
                    className="w-full h-12 bg-gradient-to-r from-[#e50914] to-[#b8050e] hover:from-[#f0131e] hover:to-[#9e040c] text-white font-bold text-base rounded-xl transition-all shadow-lg shadow-[#e50914]/25 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    {enrolled ? "ابدأ التعلم الآن" : isFree ? "سجل مجاناً الآن" : "إشترك الآن"}
                  </button>

                  {/* Action Icons Row (Cart + Wishlist + Share) */}
                  {!enrolled && (
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => toggleCart(course.id)}
                        className={`h-10 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${
                          inCart(course.id)
                            ? "bg-[#e50914] text-white border-[#e50914]"
                            : "bg-[#383333] border-[#484242] text-white/80 hover:text-white hover:border-white/40"
                        }`}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>{inCart(course.id) ? "في السلة" : "أضف للسلة"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleWish(course.id)}
                        className={`h-10 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${
                          isSaved(course.id)
                            ? "bg-[#5aca26] text-white border-[#5aca26]"
                            : "bg-[#383333] border-[#484242] text-white/80 hover:text-white hover:border-white/40"
                        }`}
                      >
                        <Heart className="w-3.5 h-3.5" />
                        <span>{isSaved(course.id) ? "بالمفضلة" : "المفضلة"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="h-10 rounded-xl bg-[#383333] border border-[#484242] text-white/80 hover:text-white hover:border-white/40 flex items-center justify-center gap-1.5 text-xs font-semibold transition-all"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>مشاركة</span>
                      </button>
                    </div>
                  )}

                  {/* Features Checklist */}
                  <div className="pt-4 border-t border-[#443e3e]/60 space-y-3">
                    <h4 className="text-xs font-bold text-white/90">تشمل هذه الدورة على :</h4>
                    <ul className="space-y-2.5 text-xs text-white/80">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#5aca26] shrink-0" />
                        <span>مجتمع خاص بالطلاب للمتابعة والتطبيقات</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#5aca26] shrink-0" />
                        <span>شهادة إتمام معتمدة لتوثيق ملفك المهني</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#5aca26] shrink-0" />
                        <span>وصول مدى الحياة للدورة وتحديثاتها المجانية</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#5aca26] shrink-0" />
                        <span>{totalLessons} درس وتطبيق عملي خطوة بخطوة</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#5aca26] shrink-0" />
                        <span>جميع الملفات والمشاريع التدريبية المفتوحة</span>
                      </li>
                    </ul>
                  </div>

                  {/* Guarantee Box */}
                  <div className="bg-[#383333] border border-[#5aca26]/30 rounded-xl p-3.5 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#5aca26]/20 flex items-center justify-center text-[#5aca26] shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#5aca26] block">ضمان استرداد 100%</span>
                      <span className="text-[11px] text-white/60">استرداد كامل خلال 7 أيام إن لم تناسبك الدورة</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Mobile Sticky Bottom Enrollment Bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-[#181515] border-t border-[#342f2f] px-4 py-2.5 shadow-[0_-8px_30px_rgba(0,0,0,0.85)] flex flex-col items-center">
        {/* Price in Bright Green */}
        <div className="text-center font-black text-base text-[#5aca26] tracking-tight leading-none mb-1.5" dir="ltr">
          {isFree ? "مجاناً" : `EGP ${finalPrice}`}
        </div>

        {/* Full-width Gradient Subscribe Button */}
        <button
          type="button"
          onClick={handleEnroll}
          className="w-full h-11 bg-gradient-to-r from-[#e50914] via-[#d1111a] to-[#b8050e] hover:opacity-95 text-white font-bold text-sm rounded-lg shadow-lg shadow-[#e50914]/30 flex items-center justify-center cursor-pointer transition-all active:scale-98"
        >
          {enrolled ? "ابدأ التعلم الآن" : isFree ? "سجل مجاناً الآن" : "إشترك الآن"}
        </button>

        {/* View Details Link */}
        <button
          type="button"
          onClick={() => {
            const el = document.getElementById("course-curriculum");
            if (el) {
              el.scrollIntoView({ behavior: "smooth" });
            } else {
              window.scrollBy({ top: 500, behavior: "smooth" });
            }
          }}
          className="text-white/80 hover:text-white text-[11px] font-semibold mt-1.5 flex items-center justify-center gap-1 cursor-pointer transition-colors"
        >
          <span>عرض كل التفاصيل</span>
          <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </div>

      {/* Preview Lesson Video Modal */}
      <Dialog open={!!previewLesson} onOpenChange={(open) => !open && setPreviewLesson(null)}>
        <DialogContent className="max-w-3xl bg-[#252121] border-[#443e3e] text-white p-4 sm:p-6">
          <DialogHeader className="text-right mb-3">
            <DialogTitle className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-[#e50914]" />
              <span>{previewLesson?.title}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-[#443e3e]">
            {previewLesson && (
              <CoursePreviewMedia url={previewLesson.url} title={previewLesson.title} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Screenshot Lightbox Modal */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setLightboxIndex(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[92vh] flex flex-col items-center justify-center px-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="absolute -top-12 left-0 sm:left-auto sm:-right-2 z-10 w-9 h-9 rounded-full bg-[#e50914] hover:bg-[#b8050e] text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 cursor-pointer"
              title="إغلاق (Esc)"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Prev Image (Right in RTL) */}
            <button
              type="button"
              onClick={() =>
                setLightboxIndex(
                  (prev) => (prev !== null ? (prev - 1 + whatsappImages.length) % whatsappImages.length : 0)
                )
              }
              className="absolute -right-2 sm:-right-14 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/80 hover:bg-[#25D366] hover:text-black border border-white/20 text-white flex items-center justify-center transition-all cursor-pointer shadow-xl"
              title="السابق"
            >
              <ChevronRight className="w-6 h-6 stroke-[2.5]" />
            </button>

            {/* Next Image (Left in RTL) */}
            <button
              type="button"
              onClick={() =>
                setLightboxIndex((prev) => (prev !== null ? (prev + 1) % whatsappImages.length : 0))
              }
              className="absolute -left-2 sm:-left-14 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/80 hover:bg-[#25D366] hover:text-black border border-white/20 text-white flex items-center justify-center transition-all cursor-pointer shadow-xl"
              title="التالي"
            >
              <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
            </button>

            {/* Screenshot Image Container */}
            <div className="relative w-full rounded-2xl overflow-hidden border border-[#393434] bg-[#121212] shadow-2xl max-h-[82vh] flex items-center justify-center p-2">
              <img
                src={whatsappImages[lightboxIndex]}
                alt={`محادثة ${lightboxIndex + 1}`}
                className="max-h-[80vh] w-auto max-w-full object-contain rounded-xl select-none"
              />
            </div>

            {/* Counter bar */}
            <div className="mt-3 px-4 py-1.5 rounded-full bg-black/80 border border-white/10 text-xs font-bold text-white/90 shadow-md flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#25D366]" />
              <span>محادثة واتساب رقم {lightboxIndex + 1} من {whatsappImages.length}</span>
            </div>
          </div>
        </div>
      )}
    </SiteShell>
  );
}

function CoursePreviewMedia({ url, poster, title }: { url: string; poster?: string | null; title: string }) {
  if (!url || !url.trim()) return null;
  return (
    <div className="relative w-full h-full min-h-[220px]">
      <SecurePlayer url={url} title={title} poster={poster} />
    </div>
  );
}
