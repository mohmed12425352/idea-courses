import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SiteShell } from "@/components/layout/SiteShell";
import { CourseCard } from "@/components/common/CourseCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, RefreshCw, Search } from "lucide-react";
import { swr } from "@/lib/cache";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/courses")({
  loader: async () => {
    try {
      const { data } = await supabase
        .from("courses")
        .select("*")
        .eq("status", "published")
        .eq("is_hidden", false)
        .order("created_at", { ascending: false });
      return { initialCourses: data ?? [] };
    } catch {
      return { initialCourses: [] };
    }
  },
  head: () => ({
    meta: [
      { title: "الدورات التعليمية — Idea Courses" },
      { name: "description", content: "تصفّح دورات Idea Courses الاحترافية في التسويق الرقمي، المونتاج، التصميم، والذكاء الاصطناعي." },
      { property: "og:title", content: "الدورات التعليمية — Idea Courses" },
      { property: "og:description", content: "تصفّح دورات Idea Courses الاحترافية في التسويق الرقمي، المونتاج، التصميم، والذكاء الاصطناعي." },
      { property: "og:url", content: "https://fekradesign.shalaby3.online/courses" },
      { property: "og:image", content: "/logo.png" },
    ],
    links: [{ rel: "canonical", href: "https://fekradesign.shalaby3.online/courses" }],
  }),
  component: CoursesPage,
});

function CoursesPage() {
  const { t, isEn, dir } = useI18n();
  const { user, isAdmin, isModerator, loading: authLoading } = useAuth();
  const searchParams = useSearch({ from: "/courses" });
  const initialCategory = (searchParams as { category?: string }).category ?? "all";
  const initialQuery = (searchParams as { q?: string }).q ?? "";
  const loaderData = Route.useLoaderData();

  const [all, setAll] = useState<any[]>(() => (loaderData?.initialCourses?.length ? (loaderData.initialCourses as any) : []));
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(() => !(loaderData?.initialCourses?.length));
  const [error, setError] = useState(false);
  const [search, setSearch] = useState(initialQuery);
  const [category, setCategory] = useState<string>(initialCategory);
  const [sort, setSort] = useState<string>("popular");

  useEffect(() => {
    const sp = searchParams as { category?: string; q?: string };
    if (sp.category && sp.category !== category) setCategory(sp.category);
    if (typeof sp.q === "string" && sp.q !== search) setSearch(sp.q);
  }, [searchParams]);

  const loadCourses = async () => {
    setLoading(true);
    setError(false);
    let usedCache = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const data = await swr(
          "courses:list:published:v2",
          5 * 60_000,
          async () => {
            const { data, error } = await supabase
              .from("courses")
              .select("*")
              .eq("status", "published")
              .eq("is_hidden", false)
              .order("created_at", { ascending: false });
            if (error) throw error;
            const courses = data ?? [];
            const { data: stats } = await supabase.rpc("get_courses_lesson_stats");
            const sm = new Map<string, { lessons_count: number; total_seconds: number }>();
            for (const r of (stats ?? []) as any[]) {
              sm.set(r.course_id, { lessons_count: r.lessons_count, total_seconds: Number(r.total_seconds) || 0 });
            }
            const { data: ratings } = await supabase.rpc("get_courses_ratings");
            const rm = new Map<string, number>();
            const rcmap = new Map<string, number>();
            for (const r of (ratings ?? []) as any[]) {
              rm.set(r.course_id, Number(r.avg_rating));
              rcmap.set(r.course_id, Number(r.ratings_count));
            }
            return courses.map((c: any) => ({
              ...c,
              rating: rm.has(c.id) ? rm.get(c.id) : c.rating,
              reviews_count: rcmap.has(c.id) ? rcmap.get(c.id) : c.reviews_count,
              lessons_count: sm.get(c.id)?.lessons_count ?? 0,
              total_seconds: sm.get(c.id)?.total_seconds ?? 0,
            }));
          },
          (cached) => {
            usedCache = true;
            setAll(cached as any);
            setLoading(false);
          },
        );
        setAll(data as any);
        setLoading(false);
        return;
      } catch {
        if (attempt < 2) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
    if (!usedCache) setError(true);
    setLoading(false);
  };

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    (async () => {
      if (!user) { setEnrolledIds(new Set()); return; }
      if (isAdmin || isModerator) {
        setEnrolledIds(new Set(all.map((c: any) => c.id)));
        return;
      }
      const { data } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("user_id", user.id)
        .neq("status", "banned");
      setEnrolledIds(new Set((data ?? []).map((e: any) => e.course_id)));
    })();
  }, [user, isAdmin, isModerator, all]);

  const combinedCourses = all;

  const categories = useMemo(
    () => Array.from(new Set(combinedCourses.map((c: any) => c.category).filter((c): c is string => !!c && c.trim() !== ""))),
    [combinedCourses]
  );

  const filtered = useMemo(() => {
    let arr = [...combinedCourses];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter(
        (c: any) =>
          String(c.title || "").toLowerCase().includes(q) ||
          String(c.short_description || "").toLowerCase().includes(q) ||
          String(c.category || "").toLowerCase().includes(q),
      );
    }
    if (category !== "all") arr = arr.filter((c: any) => c.category?.trim().toLowerCase() === category.trim().toLowerCase());
    if (sort === "newest") arr.sort((a: any, b: any) => ((b.created_at || "")).localeCompare(a.created_at || ""));
    else if (sort === "price_low") arr.sort((a: any, b: any) => (a.discount_price ?? a.price) - (b.discount_price ?? b.price));
    else if (sort === "price_high") arr.sort((a: any, b: any) => (b.discount_price ?? b.price) - (a.discount_price ?? a.price));
    else arr.sort((a: any, b: any) => (b.students_count ?? 0) - (a.students_count ?? 0));
    return arr;
  }, [combinedCourses, search, category, sort]);

  return (
    <SiteShell>
      {/* Hero */}
      <div className="bg-[#252121] text-white pt-8 pb-4 md:pt-12 md:pb-6 relative overflow-hidden">
        <div className="container-page text-center relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#2f2b2b] border border-[#443e3e] px-3.5 py-1.5 text-xs font-bold text-white/90 mb-4 shadow-sm">
            <BookOpen className="h-3.5 w-3.5 text-[#e50914]" />
            <span>{t("courses.allProfessional")}</span>
          </div>
          <h1 className="text-2xl md:text-5xl font-black mb-3 text-white tracking-tight">{t("courses.title")}</h1>
          <p className="text-white/70 text-sm md:text-base max-w-xl mx-auto mb-8 leading-relaxed">{t("courses.subtitle")}</p>

          {/* Integrated search bar */}
          <div className="max-w-xl mx-auto">
            <div className="relative flex items-center">
              <Search className={`absolute ${dir === "rtl" ? "right-4" : "left-4"} top-1/2 -translate-y-1/2 h-5 w-5 text-white/40 pointer-events-none`} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("courses.searchPh")}
                className={`w-full rounded-2xl bg-[#2f2b2b] border border-[#443e3e] text-white placeholder:text-white/40 ${dir === "rtl" ? "pr-12 pl-4" : "pl-12 pr-4"} py-3.5 text-sm focus:outline-none focus:border-[#e50914]/70 focus:ring-2 focus:ring-[#e50914]/20 transition-all shadow-md`}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container-page py-10">
        <h2 className="sr-only">{t("courses.available")}</h2>

        {/* Filter bar */}
        <div className="flex items-center gap-2 md:gap-3 mb-6 md:mb-8 overflow-x-auto scroll-snap-x pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
          <div className={`flex items-center gap-2 text-sm text-muted-foreground font-medium ${dir === "rtl" ? "ml-auto" : "mr-auto"}`}>
            <span>{t("courses.filter")}</span>
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[140px] md:w-[160px] h-9 md:h-10 rounded-xl bg-secondary border-border/60 shrink-0 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("courses.allCategories")}</SelectItem>
              {categories.map((c) => {
                const label = isEn
                  ? (c === "ذكاء اصطناعي" ? "AI" : c === "كانفا" ? "Canva" : c === "مونتاج" ? "Video Editing" : c === "تسويق" || c === "marketing" ? "Marketing" : c === "تصميم" ? "Design" : c)
                  : c;
                return <SelectItem key={c} value={c}>{label}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[130px] md:w-[150px] h-9 md:h-10 rounded-xl bg-secondary border-border/60 shrink-0 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">{t("courses.sortPopular")}</SelectItem>
              <SelectItem value="newest">{t("courses.sortNewest")}</SelectItem>
              <SelectItem value="price_low">{t("courses.sortPriceLow")}</SelectItem>
              <SelectItem value="price_high">{t("courses.sortPriceHigh")}</SelectItem>
            </SelectContent>
          </Select>
          {filtered.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {filtered.length} كورس
            </span>
          )}
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-video rounded-none" />
                <div className="p-5 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="p-14 text-center border-dashed">
            <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground mb-5 font-medium">{t("courses.errorLoad")}</p>
            <Button onClick={loadCourses} className="btn-gold-gradient text-gold-foreground px-8">
              {t("common.retry")}
            </Button>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="p-14 text-center border-dashed">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground font-medium">{t("courses.noMatch")}</p>
            {search && (
              <Button variant="ghost" onClick={() => setSearch("")} className="mt-4 text-sm text-muted-foreground hover:text-gold">
                مسح البحث
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filtered.map((c) => (
              <CourseCard key={c.id} course={c} enrolled={enrolledIds.has(c.id)} />
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  );
}
