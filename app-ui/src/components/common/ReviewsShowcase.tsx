import { useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  Star,
  Play,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Tv,
  MessageSquareText,
  Image as ImageIcon,
  ZoomIn,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { STATIC_REVIEWS, type StaticReview } from "@/lib/staticCoursesData";
import { allReviewImages } from "./reviewImages";
import { VideoModal } from "./VideoModal";
import { swr } from "@/lib/cache";

interface StudentWorkItem {
  id: string;
  title: string;
  student_name?: string | null;
  video_url: string;
  thumbnail_url: string;
}

export function ReviewsShowcase({
  initialStudentWorks,
}: {
  initialStudentWorks?: any[];
} = {}) {
  const [reviewsList, setReviewsList] = useState<StaticReview[]>(STATIC_REVIEWS);
  const [screenshotReviews, setScreenshotReviews] = useState<string[]>(allReviewImages);
  const [studentWorks, setStudentWorks] = useState<StudentWorkItem[]>(() => {
    if (initialStudentWorks && initialStudentWorks.length > 0) {
      return initialStudentWorks.map((w: any) => ({
        id: String(w.id),
        title: w.title || "عمل متدرب متميز",
        student_name: w.student_name,
        video_url: w.video_url,
        thumbnail_url:
          w.thumbnail_url ||
          "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
      }));
    }
    if (typeof window !== "undefined") {
      try {
        const cached = window.sessionStorage.getItem("platform_cached_student_works");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return [];
  });
  const [loadingWorks, setLoadingWorks] = useState(() => studentWorks.length === 0);
  const [activeVideo, setActiveVideo] = useState<{ title: string; video_url: string } | null>(null);

  // Review mode tab: "written" for student comment cards, "screenshots" for WhatsApp/chat screenshots
  const [activeTab, setActiveTab] = useState<"written" | "screenshots">("written");

  // Lightbox index for screenshot reviews modal
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const [reviewsPaused, setReviewsPaused] = useState(false);
  const [screenshotsPaused, setScreenshotsPaused] = useState(false);
  const [worksPaused, setWorksPaused] = useState(false);

  const [activeReviewIdx, setActiveReviewIdx] = useState(0);
  const [activeScreenshotIdx, setActiveScreenshotIdx] = useState(0);
  const [activeWorkIdx, setActiveWorkIdx] = useState(0);

  const reviewsTrackRef = useRef<HTMLDivElement | null>(null);
  const screenshotsTrackRef = useRef<HTMLDivElement | null>(null);
  const worksTrackRef = useRef<HTMLDivElement | null>(null);

  // Resume timers to guarantee auto-scroll never gets stuck on mobile touch
  const reviewsResumeTimer = useRef<NodeJS.Timeout | null>(null);
  const screenshotsResumeTimer = useRef<NodeJS.Timeout | null>(null);
  const worksResumeTimer = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = (
    setPaused: (p: boolean) => void,
    timerRef: React.MutableRefObject<NodeJS.Timeout | null>
  ) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPaused(true);
  };

  const handleTouchEnd = (
    setPaused: (p: boolean) => void,
    timerRef: React.MutableRefObject<NodeJS.Timeout | null>
  ) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setPaused(false);
    }, 1000);
  };

  const handleMouseEnter = (setPaused: (p: boolean) => void) => {
    // Only pause on hover if device has a physical mouse (prevents mobile touch from sticking)
    if (typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches) {
      setPaused(true);
    }
  };

  useEffect(() => {
    if (initialStudentWorks && initialStudentWorks.length > 0) {
      const formatted = initialStudentWorks.map((w: any) => ({
        id: String(w.id),
        title: w.title || "عمل متدرب متميز",
        student_name: w.student_name,
        video_url: w.video_url,
        thumbnail_url:
          w.thumbnail_url ||
          "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
      }));
      setStudentWorks(formatted);
      setLoadingWorks(false);
      try {
        window.sessionStorage.setItem("platform_cached_student_works", JSON.stringify(formatted));
      } catch {}
    }
  }, [initialStudentWorks]);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      // Execute all 3 data streams concurrently using Promise.allSettled + SWR caching
      await Promise.allSettled([
        // 1. Student works videos (fast load)
        (async () => {
          try {
            const cachedWorks = await swr("home:student_works", 5 * 60_000, async () => {
              const { data } = await (supabase as any)
                .from("student_works")
                .select("id,title,student_name,video_url,thumbnail_url,is_published,order_index")
                .eq("is_published", true)
                .order("order_index", { ascending: true })
                .order("created_at", { ascending: false })
                .limit(50);
              return data ?? [];
            });

            if (isMounted) {
              if (cachedWorks && cachedWorks.length > 0) {
                const formatted: StudentWorkItem[] = cachedWorks.map((w: any) => ({
                  id: String(w.id),
                  title: w.title || "عمل متدرب متميز",
                  student_name: w.student_name,
                  video_url: w.video_url,
                  thumbnail_url:
                    w.thumbnail_url ||
                    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
                }));
                setStudentWorks(formatted);
                try {
                  window.sessionStorage.setItem("platform_cached_student_works", JSON.stringify(formatted));
                } catch {}
              }
              setLoadingWorks(false);
            }
          } catch (e) {
            console.warn("[ReviewsShowcase] Failed to load student works:", e);
            if (isMounted) setLoadingWorks(false);
          }
        })(),

        // 2. Student written reviews
        (async () => {
          try {
            const cachedReviews = await swr("home:public_reviews", 5 * 60_000, async () => {
              const { data } = await supabase.rpc("get_public_reviews", { _limit: 100 });
              return data ?? [];
            });

            if (isMounted && cachedReviews && cachedReviews.length > 0) {
              const courseIds = (Array.from(new Set(cachedReviews.map((r: any) => r.course_id).filter(Boolean))) as string[]);
              let courseMap: Record<string, { title: string; slug: string }> = {};

              if (courseIds.length > 0) {
                const { data: coursesData } = await supabase
                  .from("courses")
                  .select("id,title,slug")
                  .in("id", courseIds);

                if (coursesData) {
                  for (const c of coursesData) {
                    courseMap[c.id] = { title: c.title, slug: c.slug || c.id };
                  }
                }
              }

              const formattedDbReviews: StaticReview[] = (cachedReviews as any[])
                .filter((r) => r.comment && r.comment.trim() !== "")
                .map((r) => ({
                  id: r.id,
                  user_name: r.author_name || "مشترك في المنصة",
                  avatar_url: r.author_avatar_url || null,
                  rating: r.rating || 5,
                  comment: r.comment,
                  course_title: courseMap[r.course_id]?.title || "كورس الذكاء الاصطناعي",
                  course_slug: courseMap[r.course_id]?.slug || "courses",
                }));

              if (formattedDbReviews.length > 0 && isMounted) {
                setReviewsList(formattedDbReviews);
              }
            }
          } catch (e) {
            console.warn("[ReviewsShowcase] Failed to load reviews:", e);
          }
        })(),

        // 3. Success stories / chat screenshots
        (async () => {
          try {
            const cachedStories = await swr("home:success_stories", 5 * 60_000, async () => {
              const { data } = await supabase
                .from("success_stories")
                .select("id,image_url,caption,order_index,is_published")
                .eq("is_published", true)
                .order("order_index", { ascending: true })
                .order("created_at", { ascending: false });
              return data ?? [];
            });

            if (isMounted && cachedStories && cachedStories.length > 0) {
              const urls = cachedStories.map((s: any) => s.image_url).filter(Boolean);
              if (urls.length > 0) {
                setScreenshotReviews(urls);
              }
            }
          } catch (e) {
            console.warn("[ReviewsShowcase] Failed to load success stories:", e);
          }
        })(),
      ]);
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft") {
        setLightboxIndex((prev) => (prev !== null ? (prev + 1) % screenshotReviews.length : 0));
      }
      if (e.key === "ArrowRight") {
        setLightboxIndex((prev) =>
          prev !== null ? (prev - 1 + screenshotReviews.length) % screenshotReviews.length : 0
        );
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, screenshotReviews.length]);

  // Auto-Play Animation for Written Reviews (Every 1.5 seconds)
  useEffect(() => {
    if (reviewsPaused || reviewsList.length === 0 || activeTab !== "written") return;

    const timer = setInterval(() => {
      const el = reviewsTrackRef.current;
      if (!el) return;
      const card = el.firstElementChild as HTMLElement | null;
      const cardWidth = card ? card.offsetWidth + 16 : 380;
      const maxScroll = el.scrollWidth - el.clientWidth;
      
      // In RTL, advance leftwards (negative delta). If near end, loop smoothly back to start
      if (Math.abs(el.scrollLeft) >= maxScroll - 30) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ left: -cardWidth, behavior: "smooth" });
      }
    }, 1500);

    return () => clearInterval(timer);
  }, [reviewsPaused, reviewsList.length, activeTab]);

  // Auto-Play Animation for Screenshot Reviews (Every 1.5 seconds)
  useEffect(() => {
    if (screenshotsPaused || screenshotReviews.length === 0 || activeTab !== "screenshots" || lightboxIndex !== null) return;

    const timer = setInterval(() => {
      const el = screenshotsTrackRef.current;
      if (!el) return;
      const card = el.firstElementChild as HTMLElement | null;
      const cardWidth = card ? card.offsetWidth + 16 : 400;
      const maxScroll = el.scrollWidth - el.clientWidth;
      
      if (Math.abs(el.scrollLeft) >= maxScroll - 30) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ left: -cardWidth, behavior: "smooth" });
      }
    }, 1500);

    return () => clearInterval(timer);
  }, [screenshotsPaused, screenshotReviews.length, activeTab, lightboxIndex]);

  // Auto-Play Animation for Student Works Videos (Every 1.5 seconds)
  useEffect(() => {
    if (worksPaused || !!activeVideo || studentWorks.length === 0) return;

    const timer = setInterval(() => {
      const el = worksTrackRef.current;
      if (!el) return;
      const card = el.firstElementChild as HTMLElement | null;
      const cardWidth = card ? card.offsetWidth + 16 : 320;
      const maxScroll = el.scrollWidth - el.clientWidth;

      if (Math.abs(el.scrollLeft) >= maxScroll - 30) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ left: -cardWidth, behavior: "smooth" });
      }
    }, 1500);

    return () => clearInterval(timer);
  }, [worksPaused, activeVideo, studentWorks.length]);

  const scrollTrack = (ref: React.RefObject<HTMLDivElement | null>, direction: "left" | "right") => {
    const el = ref.current;
    if (!el) return;
    const cardWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 16 : 380;
    // In RTL: direction 'left' advances to the next items; 'right' goes back to previous
    const delta = direction === "left" ? -cardWidth : cardWidth;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  const handleReviewsScroll = () => {
    const el = reviewsTrackRef.current;
    if (!el) return;
    const cardWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 16 : 380;
    const idx = Math.round(Math.abs(el.scrollLeft) / cardWidth);
    setActiveReviewIdx(idx);
  };

  const handleScreenshotsScroll = () => {
    const el = screenshotsTrackRef.current;
    if (!el) return;
    const cardWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 16 : 400;
    const idx = Math.round(Math.abs(el.scrollLeft) / cardWidth);
    setActiveScreenshotIdx(idx);
  };

  const handleWorksScroll = () => {
    const el = worksTrackRef.current;
    if (!el) return;
    const cardWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 16 : 320;
    const idx = Math.round(Math.abs(el.scrollLeft) / cardWidth);
    setActiveWorkIdx(idx);
  };

  return (
    <section className="container mx-auto px-4 py-12 md:py-16 overflow-hidden">
      {/* ========================================================
          1. REVIEWS SECTION (تقييمات وأراء المشتركين)
         ======================================================== */}
      <div className="mb-14">
        {/* Header with Title and Mode Switcher Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="text-white text-xl md:text-2xl font-bold text-right flex items-center justify-start gap-2">
            <span>تقييمات وأراء المشتركين :</span>
          </h3>

          {/* Toggle between Written reviews & WhatsApp screenshots */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#1e1b1b] border border-[#393434] self-start sm:self-auto shadow-md">
            <button
              type="button"
              onClick={() => setActiveTab("written")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "written"
                  ? "bg-[#e50914] text-white shadow-md shadow-[#e50914]/30"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <MessageSquareText className="w-3.5 h-3.5" />
              <span>آراء الطلاب ({reviewsList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("screenshots")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "screenshots"
                  ? "bg-[#e50914] text-white shadow-md shadow-[#e50914]/30"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>محادثات الواتساب ({screenshotReviews.length})</span>
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------
            TAB 1: WRITTEN STUDENT REVIEWS CAROUSEL
           ---------------------------------------------------- */}
        {activeTab === "written" && (
          <div
            className="relative group/reviews"
            onMouseEnter={() => handleMouseEnter(setReviewsPaused)}
            onMouseLeave={() => setReviewsPaused(false)}
            onTouchStart={() => handleTouchStart(setReviewsPaused, reviewsResumeTimer)}
            onTouchEnd={() => handleTouchEnd(setReviewsPaused, reviewsResumeTimer)}
            onTouchCancel={() => handleTouchEnd(setReviewsPaused, reviewsResumeTimer)}
          >
            {/* Right Navigation Arrow Button */}
            <button
              type="button"
              onClick={() => scrollTrack(reviewsTrackRef, "right")}
              aria-label="السابق"
              className="absolute -right-3 sm:-right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[#e50914] hover:bg-[#b8050e] text-white flex items-center justify-center shadow-xl shadow-[#e50914]/40 hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <ChevronRight className="w-6 h-6 stroke-[2.5]" />
            </button>

            {/* Left Navigation Arrow Button */}
            <button
              type="button"
              onClick={() => scrollTrack(reviewsTrackRef, "left")}
              aria-label="التالي"
              className="absolute -left-3 sm:-left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[#e50914] hover:bg-[#b8050e] text-white flex items-center justify-center shadow-xl shadow-[#e50914]/40 hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
            </button>

            {/* Horizontal Sliding Track for Written Reviews */}
            <div
              ref={reviewsTrackRef}
              onScroll={handleReviewsScroll}
              className="flex gap-4 overflow-x-auto scroll-smooth py-3 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-proximity"
            >
              {reviewsList.map((rev) => (
                <div
                  key={rev.id}
                  className="w-[300px] sm:w-[380px] md:w-[460px] shrink-0 bg-[#1e1b1b] border border-[#393434] hover:border-[#e50914]/60 hover:shadow-2xl hover:shadow-[#e50914]/10 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all duration-300 snap-start select-none group/card"
                >
                  <div>
                    {/* User header with Avatar on right in RTL */}
                    <div className="flex items-start justify-end gap-3 mb-3 text-right">
                      <div>
                        <h4 className="text-white font-bold text-base leading-snug group-hover/card:text-[#e50914] transition-colors">
                          {rev.user_name}
                        </h4>
                        {/* 5 Stars directly below name */}
                        <div className="flex items-center justify-end gap-1 mt-1 text-[#f5c518]">
                          {Array.from({ length: rev.rating }).map((_, i) => (
                            <Star key={i} className="w-4 h-4 fill-[#f5c518] stroke-none" />
                          ))}
                        </div>
                      </div>

                      {rev.avatar_url ? (
                        <img
                          src={rev.avatar_url}
                          alt={rev.user_name}
                          className="w-12 h-12 rounded-full object-cover bg-[#2b2727] border-2 border-white/10 shrink-0 shadow-md"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#e50914] to-[#f5c518] text-white flex items-center justify-center font-bold text-sm shadow-md shrink-0 border border-white/10">
                          {rev.user_name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Comment text in center */}
                    <p className="text-white/85 text-xs sm:text-sm leading-relaxed mb-4 text-right min-h-[54px] line-clamp-3">
                      {rev.comment}
                    </p>
                  </div>

                  {/* Divider and Course Tag at bottom */}
                  <div>
                    <div className="w-full h-[1px] bg-[#332e2e] mb-3" />
                    <Link
                      to="/courses/$slug"
                      params={{ slug: rev.course_slug }}
                      className="flex items-center justify-end gap-2 text-white/80 hover:text-white transition-colors text-xs font-semibold group/course"
                    >
                      <span className="truncate max-w-[300px]">{rev.course_title}</span>
                      <div className="w-6 h-6 rounded-md bg-[#2d2828] border border-[#e50914]/30 text-[#e50914] flex items-center justify-center shrink-0 group-hover/course:bg-[#e50914] group-hover/course:text-white transition-colors">
                        <Tv className="w-3.5 h-3.5" />
                      </div>
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Animated Pagination Dots */}
            <div className="flex items-center justify-center gap-1.5 mt-4">
              {Array.from({ length: Math.min(reviewsList.length, 12) }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    const el = reviewsTrackRef.current;
                    if (!el) return;
                    const cardWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 16 : 380;
                    el.scrollTo({ left: -i * cardWidth, behavior: "smooth" });
                  }}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    activeReviewIdx === i ? "w-7 bg-[#e50914]" : "w-2 bg-[#393434] hover:bg-white/40"
                  }`}
                  aria-label={`شريحة رأي ${i + 1}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            TAB 2: WHATSAPP / CHAT SCREENSHOTS SLIDER
           ---------------------------------------------------- */}
        {activeTab === "screenshots" && (
          <div
            className="relative group/screens"
            onMouseEnter={() => handleMouseEnter(setScreenshotsPaused)}
            onMouseLeave={() => setScreenshotsPaused(false)}
            onTouchStart={() => handleTouchStart(setScreenshotsPaused, screenshotsResumeTimer)}
            onTouchEnd={() => handleTouchEnd(setScreenshotsPaused, screenshotsResumeTimer)}
            onTouchCancel={() => handleTouchEnd(setScreenshotsPaused, screenshotsResumeTimer)}
          >
            {/* Right Navigation Arrow Button */}
            <button
              type="button"
              onClick={() => scrollTrack(screenshotsTrackRef, "right")}
              aria-label="السابق"
              className="absolute -right-3 sm:-right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[#e50914] hover:bg-[#b8050e] text-white flex items-center justify-center shadow-xl shadow-[#e50914]/40 hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <ChevronRight className="w-6 h-6 stroke-[2.5]" />
            </button>

            {/* Left Navigation Arrow Button */}
            <button
              type="button"
              onClick={() => scrollTrack(screenshotsTrackRef, "left")}
              aria-label="التالي"
              className="absolute -left-3 sm:-left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[#e50914] hover:bg-[#b8050e] text-white flex items-center justify-center shadow-xl shadow-[#e50914]/40 hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
            </button>

            {/* Horizontal Sliding Track for Screenshots */}
            <div
              ref={screenshotsTrackRef}
              onScroll={handleScreenshotsScroll}
              className="flex gap-4 overflow-x-auto scroll-smooth py-3 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-proximity"
            >
              {screenshotReviews.map((imgUrl, i) => (
                <div
                  key={i}
                  onClick={() => setLightboxIndex(i)}
                  className="w-[290px] sm:w-[370px] md:w-[440px] aspect-[16/11] shrink-0 bg-[#1e1b1b] border border-[#393434] hover:border-[#e50914] hover:shadow-2xl hover:shadow-[#e50914]/20 rounded-2xl overflow-hidden shadow-lg cursor-pointer transition-all duration-300 snap-start select-none group/screen relative flex flex-col justify-between"
                  title="انقر لتكبير وقراءة الرسالة كاملة"
                >
                  {/* Full image display with object-contain on clean dark background so NO text is cropped */}
                  <div className="relative w-full flex-1 bg-[#131111] flex items-center justify-center p-2 overflow-hidden">
                    <img
                      src={imgUrl}
                      alt={`تجربة طالب ${i + 1}`}
                      loading="lazy"
                      className="w-full h-full object-contain rounded-lg transition-transform duration-300 group-hover/screen:scale-[1.02]"
                    />

                    {/* Hover Overlay with Zoom Icon */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/screen:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                      <div className="w-11 h-11 rounded-full bg-[#e50914] text-white flex items-center justify-center shadow-lg shadow-[#e50914]/50 scale-90 group-hover/screen:scale-100 transition-transform duration-200">
                        <ZoomIn className="w-5 h-5" />
                      </div>
                    </div>

                    {/* Badge at top right */}
                    <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md border border-white/10 text-[11px] text-white/95 font-medium flex items-center gap-1.5 shadow-md">
                      <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                      <span>محادثة واتساب #{i + 1}</span>
                    </div>
                  </div>

                  {/* Bottom Bar: Action prompt */}
                  <div className="h-8 px-3.5 bg-[#1b1818] border-t border-[#2e2929] flex items-center justify-between text-[11px] text-white/70 group-hover/screen:text-[#e50914] transition-colors shrink-0">
                    <span className="font-semibold">انقر للتكبير والقراءة بالكامل</span>
                    <ZoomIn className="w-3.5 h-3.5" />
                  </div>
                </div>
              ))}
            </div>

            {/* Animated Pagination Dots */}
            <div className="flex items-center justify-center gap-1.5 mt-4">
              {Array.from({ length: Math.min(screenshotReviews.length, 10) }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    const el = screenshotsTrackRef.current;
                    if (!el) return;
                    const cardWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 16 : 380;
                    el.scrollTo({ left: -i * cardWidth, behavior: "smooth" });
                  }}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    activeScreenshotIdx === i ? "w-7 bg-[#e50914]" : "w-2 bg-[#393434] hover:bg-white/40"
                  }`}
                  aria-label={`شريحة محادثة ${i + 1}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          2. STUDENT WORKS VIDEOS ANIMATED CAROUSEL (فيديوهات أعمال طلابنا)
         ======================================================== */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-white font-bold text-xl md:text-2xl flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-[#e50914]" />
            <span>فيديوهات أعمال طلابنا</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#e50914] animate-ping ml-1" />
          </h4>

          <Link
            to="/student-works"
            className="text-xs sm:text-sm text-white/70 hover:text-[#e50914] font-semibold transition-colors flex items-center gap-1"
          >
            عرض كافة الأعمال ←
          </Link>
        </div>

        {loadingWorks && studentWorks.length === 0 ? (
          <div className="flex gap-4 overflow-hidden py-3 px-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="w-[260px] sm:w-[300px] md:w-[330px] aspect-video shrink-0 rounded-2xl bg-[#252121] border border-white/5 animate-pulse relative overflow-hidden flex items-center justify-center"
              >
                <div className="w-12 h-12 rounded-full bg-white/10" />
                <div className="absolute bottom-3 inset-x-3 h-4 bg-white/10 rounded" />
              </div>
            ))}
          </div>
        ) : studentWorks.length > 0 ? (
          <div
            className="relative group/works"
            onMouseEnter={() => handleMouseEnter(setWorksPaused)}
            onMouseLeave={() => setWorksPaused(false)}
            onTouchStart={() => handleTouchStart(setWorksPaused, worksResumeTimer)}
            onTouchEnd={() => handleTouchEnd(setWorksPaused, worksResumeTimer)}
            onTouchCancel={() => handleTouchEnd(setWorksPaused, worksResumeTimer)}
          >
            {/* Right Navigation Arrow Button */}
            <button
              type="button"
              onClick={() => scrollTrack(worksTrackRef, "right")}
              aria-label="السابق"
              className="absolute -right-3 sm:-right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[#e50914] hover:bg-[#b8050e] text-white flex items-center justify-center shadow-xl shadow-[#e50914]/40 hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <ChevronRight className="w-6 h-6 stroke-[2.5]" />
            </button>

            {/* Left Navigation Arrow Button */}
            <button
              type="button"
              onClick={() => scrollTrack(worksTrackRef, "left")}
              aria-label="التالي"
              className="absolute -left-3 sm:-left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[#e50914] hover:bg-[#b8050e] text-white flex items-center justify-center shadow-xl shadow-[#e50914]/40 hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
            </button>

            {/* Horizontal Sliding Track for Videos */}
            <div
              ref={worksTrackRef}
              onScroll={handleWorksScroll}
              className="flex gap-4 overflow-x-auto scroll-smooth py-3 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-proximity"
            >
              {studentWorks.map((work) => (
                <div
                  key={work.id}
                  onClick={() => setActiveVideo({ title: work.title, video_url: work.video_url })}
                  className="w-[260px] sm:w-[300px] md:w-[330px] shrink-0 platform-video-frame group cursor-pointer snap-start rounded-2xl overflow-hidden border border-[#393434] hover:border-[#e50914]/80 hover:shadow-2xl hover:shadow-[#e50914]/20 transition-all duration-300 select-none"
                  title={work.title}
                >
                  <img
                    src={work.thumbnail_url}
                    alt={work.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  {/* Play button overlay */}
                  <div className="platform-play-button">
                    <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-[#e50914] to-[#ff0066] text-white flex items-center justify-center shadow-xl shadow-[#e50914]/50 group-hover:scale-115 transition-transform duration-300 ring-4 ring-white/20">
                      <Play className="w-6 h-6 fill-white translate-x-0.5" />
                    </div>
                  </div>

                  {/* Bottom Gradient overlay with Title & Student Name */}
                  <div className="absolute bottom-0 inset-x-0 p-3.5 bg-gradient-to-t from-black/95 via-black/70 to-transparent text-right">
                    <span className="text-white text-xs sm:text-sm font-bold line-clamp-1 block">
                      {work.title}
                    </span>
                    {work.student_name && (
                      <span className="text-white/75 text-[11px] font-medium block mt-0.5">
                        بواسطة: {work.student_name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Animated Pagination Dots */}
            <div className="flex items-center justify-center gap-1.5 mt-4">
              {Array.from({ length: Math.min(studentWorks.length, 8) }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    const el = worksTrackRef.current;
                    if (!el) return;
                    const cardWidth = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 16 : 320;
                    el.scrollTo({ left: -i * cardWidth, behavior: "smooth" });
                  }}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    activeWorkIdx === i ? "w-7 bg-[#e50914]" : "w-2 bg-[#393434] hover:bg-white/40"
                  }`}
                  aria-label={`شريحة عمل ${i + 1}`}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Video Modal Player */}
      {activeVideo && (
        <VideoModal
          isOpen={!!activeVideo}
          onClose={() => setActiveVideo(null)}
          videoUrl={activeVideo.video_url}
          title={activeVideo.title}
        />
      )}

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
                  (prev) => (prev !== null ? (prev - 1 + screenshotReviews.length) % screenshotReviews.length : 0)
                )
              }
              className="absolute -right-2 sm:-right-14 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/80 hover:bg-[#e50914] border border-white/20 text-white flex items-center justify-center transition-all cursor-pointer shadow-xl"
              title="السابق"
            >
              <ChevronRight className="w-6 h-6 stroke-[2.5]" />
            </button>

            {/* Next Image (Left in RTL) */}
            <button
              type="button"
              onClick={() =>
                setLightboxIndex((prev) => (prev !== null ? (prev + 1) % screenshotReviews.length : 0))
              }
              className="absolute -left-2 sm:-left-14 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/80 hover:bg-[#e50914] border border-white/20 text-white flex items-center justify-center transition-all cursor-pointer shadow-xl"
              title="التالي"
            >
              <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
            </button>

            {/* Screenshot Image Container */}
            <div className="relative w-full rounded-2xl overflow-hidden border border-[#393434] bg-[#121212] shadow-2xl max-h-[82vh] flex items-center justify-center p-2">
              <img
                src={screenshotReviews[lightboxIndex]}
                alt={`محادثة ${lightboxIndex + 1}`}
                className="max-h-[80vh] w-auto max-w-full object-contain rounded-xl select-none"
              />
            </div>

            {/* Counter bar */}
            <div className="mt-3 px-4 py-1.5 rounded-full bg-black/80 border border-white/10 text-xs font-bold text-white/90 shadow-md flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#25D366]" />
              <span>محادثة واتساب رقم {lightboxIndex + 1} من {screenshotReviews.length}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
