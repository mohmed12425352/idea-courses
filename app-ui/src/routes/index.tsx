import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SiteShell } from "@/components/layout/SiteShell";
import { CourseCard } from "@/components/common/CourseCard";
import { ReviewsShowcase } from "@/components/common/ReviewsShowcase";
import { CertificateSection } from "@/components/common/CertificateSection";
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Compass,
  Headphones,
  Layers,
  PlayCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { DEFAULT_SEO_SETTINGS, normalizeSeoSettings, SEO_SETTINGS_KEY } from "@/lib/seo";

export const Route = createFileRoute("/")({
  loader: async () => {
    try {
      const [coursesRes, worksRes, faqsRes, seoRes] = await Promise.all([
        supabase
          .from("courses")
          .select("*")
          .eq("status", "published")
          .eq("is_hidden", false)
          .order("created_at", { ascending: false }),
        supabase
          .from("student_works")
          .select("id,title,student_name,video_url,thumbnail_url,is_published,order_index")
          .eq("is_published", true)
          .order("order_index", { ascending: true })
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("faqs")
          .select("id,question,answer,order_index")
          .eq("is_published", true)
          .order("order_index", { ascending: true })
          .limit(12),
        supabase
          .from("app_settings")
          .select("value")
          .eq("key", SEO_SETTINGS_KEY)
          .maybeSingle(),
      ]);
      return {
        initialCourses: coursesRes.data ?? [],
        initialStudentWorks: worksRes.data ?? [],
        initialFaqs: faqsRes.data ?? [],
        seo: normalizeSeoSettings(seoRes?.data?.value),
      };
    } catch {
      return { initialCourses: [], initialStudentWorks: [], initialFaqs: [], seo: DEFAULT_SEO_SETTINGS };
    }
  },
  head: ({ loaderData }) => {
    const seo = (loaderData as any)?.seo || DEFAULT_SEO_SETTINGS;
    const title = seo.site_title || DEFAULT_SEO_SETTINGS.site_title;
    const description = seo.meta_description || DEFAULT_SEO_SETTINGS.meta_description;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: HomePage,
});

function HomePage() {
  const { user, isAdmin, isModerator } = useAuth();
  const nav = useNavigate();
  const loaderData = Route.useLoaderData();
  const [courses, setCourses] = useState<any[]>(() => loaderData?.initialCourses ?? []);
  const [faqs, setFaqs] = useState<any[]>(() => loaderData?.initialFaqs ?? []);
  const [loading, setLoading] = useState(() => !(loaderData?.initialCourses?.length));
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [heroSearch, setHeroSearch] = useState("");
  const [courseFilterText, setCourseFilterText] = useState("");

  useEffect(() => {
    if (!user) {
      setEnrolledIds(new Set());
      return;
    }
    if (isAdmin || isModerator) {
      setEnrolledIds(new Set(courses.map((c) => c.id)));
      return;
    }
    supabase
      .from("enrollments")
      .select("course_id, courses(id, slug)")
      .eq("user_id", user.id)
      .neq("status", "banned")
      .then(({ data }) => {
        const ids = new Set<string>();
        (data ?? []).forEach((e: any) => {
          if (e.course_id) ids.add(e.course_id);
          if (e.courses?.id) ids.add(e.courses.id);
        });
        setEnrolledIds(ids);
      });
  }, [user, isAdmin, isModerator, courses]);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: cData }, { data: fData }] = await Promise.all([
          supabase
            .from("courses")
            .select("*")
            .eq("status", "published")
            .eq("is_hidden", false)
            .order("created_at", { ascending: false }),
          supabase
            .from("faqs")
            .select("id,question,answer,order_index")
            .eq("is_published", true)
            .order("order_index", { ascending: true })
            .limit(12),
        ]);
        if (cData && cData.length > 0) setCourses(cData);
        if (fData && fData.length > 0) setFaqs(fData);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of courses) {
      const cat = String(c.category || "عام").trim();
      map.set(cat, (map.get(cat) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [courses]);

  const filteredCourses = useMemo(() => {
    const q = courseFilterText.trim().toLowerCase();
    return courses.filter((c) => {
      const catOk = selectedCategory === "all" || String(c.category || "عام").trim() === selectedCategory;
      if (!catOk) return false;
      if (!q) return true;
      return (
        String(c.title || "").toLowerCase().includes(q) ||
        String(c.short_description || "").toLowerCase().includes(q) ||
        String(c.category || "").toLowerCase().includes(q)
      );
    });
  }, [courses, selectedCategory, courseFilterText]);

  const latestCourses = useMemo(() => {
    const flagged = courses.filter((c) => c.is_latest);
    return (flagged.length >= 2 ? flagged : courses).slice(0, 4);
  }, [courses]);

  const onHeroSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = heroSearch.trim();
    if (!q) {
      document.getElementById("courses")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setCourseFilterText(q);
    document.getElementById("courses")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <SiteShell>
      {/* ================================================================
          1. CINEMATIC FLAGSHIP HERO SECTION
         ================================================================ */}
      <section className="relative overflow-hidden bg-[#111012] border-b border-white/[0.07]">
        {/* Ambient Glows */}
        <div className="pointer-events-none absolute -top-32 right-0 w-[520px] h-[520px] rounded-full bg-[#e50914]/15 blur-[130px]" />
        <div className="pointer-events-none absolute bottom-0 left-10 w-[420px] h-[420px] rounded-full bg-[#f5c518]/10 blur-[130px]" />

        <div className="container mx-auto px-4 pt-8 pb-10 md:pt-12 md:pb-14 relative z-10">
          <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)] bg-[#171519]">
            <img
              src="/hero-banner.jpg"
              alt="Idea Courses Hero Banner"
              className="absolute inset-0 w-full h-full object-cover object-center opacity-55"
              fetchPriority="high"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#111012] via-[#111012]/80 to-[#111012]/35 md:bg-gradient-to-l md:from-[#111012]/98 md:via-[#111012]/85 md:to-[#111012]/30" />

            <div className="relative z-10 p-6 sm:p-10 md:p-14 lg:p-16 max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#e50914]/15 border border-[#e50914]/40 px-4 py-1.5 text-xs font-extrabold text-[#ff5a62] mb-5 backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5 text-[#f5c518]" />
                <span>أكاديمية فكرة ديزاين — تعلم من الصفر حتى الاحتراف وسوق العمل</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[54px] font-black text-white leading-[1.2] tracking-tight mb-4">
                احترف <span className="text-[#f5c518]">الموشن جرافيك</span>، المونتاج، التصميم، و
                <span className="text-[#e50914]">الذكاء الاصطناعي</span>
              </h1>

              <p className="text-white/80 text-sm sm:text-base md:text-lg leading-relaxed mb-7 max-w-2xl">
                مسارات تدريبية عملية خطوة بخطوة على مشاريع حقيقية، مع متابعة مباشرة، ملفات عمل جاهزة للتحميل، وشهادة معتمدة بكود تحقق فوري.
              </p>

              {/* Instant Hero Search Bar */}
              <form
                onSubmit={onHeroSearch}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 max-w-xl mb-7 bg-black/55 backdrop-blur-xl p-2 rounded-2xl border border-white/15 focus-within:border-[#e50914]/70 transition-all"
              >
                <div className="relative flex-1 flex items-center">
                  <Search className="w-4 h-4 text-white/50 mr-3 shrink-0" />
                  <input
                    type="text"
                    value={heroSearch}
                    onChange={(e) => setHeroSearch(e.target.value)}
                    placeholder="ماذا تريد أن تتعلم اليوم؟ (CapCut، وايت بورد، ذكاء اصطناعي...)"
                    className="w-full h-10 bg-transparent text-sm text-white placeholder-white/45 outline-none px-2"
                  />
                </div>
                <button
                  type="submit"
                  className="h-11 px-6 rounded-xl bg-gradient-to-r from-[#e50914] to-[#b80710] hover:from-[#ff1f2a] hover:to-[#d10813] text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 shadow-lg shadow-[#e50914]/30 shrink-0 cursor-pointer"
                >
                  <span>استكشف الدورات</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </form>

              {/* Quick Action Buttons */}
              <div className="flex flex-wrap items-center gap-3" data-hero-cta>
                {user ? (
                  <Link
                    to="/dashboard"
                    className="h-11 px-6 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-sm font-bold inline-flex items-center gap-2 backdrop-blur-md"
                  >
                    <PlayCircle className="w-4 h-4 text-[#f5c518]" />
                    <span>الذهاب لمساحة التعلم</span>
                  </Link>
                ) : (
                  <Link
                    to="/register"
                    className="h-11 px-6 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-sm font-bold inline-flex items-center gap-2 backdrop-blur-md"
                  >
                    <span>إنشاء حساب مجاني</span>
                  </Link>
                )}
                <Link
                  to="/student-works"
                  className="h-11 px-5 rounded-xl text-white/80 hover:text-white hover:bg-white/5 text-sm font-semibold inline-flex items-center gap-2"
                >
                  <span>شاهد أعمال طلابنا</span>
                  <ArrowLeft className="w-3.5 h-3.5 text-[#f5c518]" />
                </Link>
              </div>
            </div>
          </div>

          {/* Live Trust Metrics Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6">
            {[
              { icon: Users, value: "+15,000", label: "طالب ومبدع عربي", accent: "text-[#f5c518] bg-[#f5c518]/10 border-[#f5c518]/25" },
              { icon: BookOpen, value: `${courses.length || 9} مسارات`, label: "دورات تطبيقية متكاملة", accent: "text-[#e50914] bg-[#e50914]/10 border-[#e50914]/25" },
              { icon: Award, value: "شهادة QR", label: "موثقة ومعتمدة فور الإتمام", accent: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" },
              { icon: Headphones, value: "دعم مباشر", label: "متابعة وتقييم لمشاريعك", accent: "text-sky-400 bg-sky-500/10 border-sky-500/25" },
            ].map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3.5 p-4 rounded-2xl bg-[#18161a] border border-white/[0.07] hover:border-white/15 transition-all"
                >
                  <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${stat.accent}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg sm:text-xl font-black text-white leading-tight">{stat.value}</div>
                    <div className="text-xs text-white/55 truncate">{stat.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================================================================
          2. LATEST / FEATURED SPOTLIGHT ("أحدث الدورات المضافة")
         ================================================================ */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#f5c518] mb-1.5">
              <Zap className="w-3.5 h-3.5" /> مختارات المنصة
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white">أحدث الدورات التدريبية</h2>
          </div>
          <Link
            to="/courses"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white/75 hover:text-[#f5c518] bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 px-4 py-2 rounded-full transition-all"
          >
            <span>عرض كل الكورسات</span>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>

        {loading && courses.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse p-4 bg-[#19171b] rounded-2xl border border-white/5 space-y-3">
                <div className="aspect-[16/10] bg-white/5 rounded-xl" />
                <div className="h-4 bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-white/5 rounded w-1/2" />
                <div className="h-9 bg-white/5 rounded-xl w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {latestCourses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                enrolled={enrolledIds.has(course.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ================================================================
          3. INTERACTIVE ALL-COURSES EXPLORER WITH LIVE FILTERS
         ================================================================ */}
      <section id="courses" className="bg-[#141216] border-y border-white/[0.06] py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#e50914] mb-1.5">
                <Compass className="w-3.5 h-3.5" /> مسارات التعلم المتكاملة
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white">استكشف جميع الدورات</h2>
              <p className="text-white/60 text-sm mt-1">اختر التخصص المناسب لك وابدأ التطبيق العملي فوراً</p>
            </div>

            {/* Instant Inline Filter Input */}
            <div className="relative w-full md:w-72">
              <input
                type="text"
                value={courseFilterText}
                onChange={(e) => setCourseFilterText(e.target.value)}
                placeholder="فلترة سريعة بالاسم أو المهارة..."
                className="w-full h-10 pr-9 pl-3 rounded-xl bg-[#1d1a20] border border-white/10 focus:border-[#e50914] text-xs text-white placeholder-white/45 outline-none"
              />
              <Search className="w-4 h-4 text-white/45 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Category Filter Chips */}
          {categories.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategory("all")}
                className={`shrink-0 h-9 px-4 rounded-full text-xs font-extrabold transition-all cursor-pointer ${
                  selectedCategory === "all"
                    ? "bg-[#e50914] text-white shadow-lg shadow-[#e50914]/25"
                    : "bg-white/[0.05] text-white/75 hover:bg-white/[0.1] border border-white/10"
                }`}
              >
                الكل ({courses.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`shrink-0 h-9 px-4 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    selectedCategory === cat.name
                      ? "bg-[#e50914] text-white shadow-lg shadow-[#e50914]/25"
                      : "bg-white/[0.05] text-white/75 hover:bg-white/[0.1] border border-white/10"
                  }`}
                >
                  {cat.name} ({cat.count})
                </button>
              ))}
            </div>
          )}

          {filteredCourses.length === 0 ? (
            <div className="rounded-2xl bg-[#19171b] border border-white/10 p-12 text-center">
              <p className="text-white/70 font-bold mb-3">لا توجد دورات مطابقة لبحثك الحالي</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory("all");
                  setCourseFilterText("");
                }}
                className="px-4 py-2 rounded-xl bg-[#e50914] text-white text-xs font-bold cursor-pointer"
              >
                إظهار جميع الدورات
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  enrolled={enrolledIds.has(course.id)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ================================================================
          4. WHY CHOOSE IDEA COURSES (4-CARD VALUE BENTO)
         ================================================================ */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-extrabold text-[#f5c518] uppercase tracking-wider">تجربة تعليمية متكاملة</span>
          <h2 className="text-2xl md:text-3xl font-black text-white mt-1.5">لماذا يتعلم الآلاف في منصة فكرة؟</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              icon: Layers,
              title: "تطبيق عملي من اليوم الأول",
              desc: "لا نعتمد على الشرح النظري الممل؛ كل درس مصمم لتنفيذ مشاريع حقيقية تبني بها معرض أعمالك (Portfolio).",
              color: "text-[#e50914] bg-[#e50914]/10 border-[#e50914]/25",
            },
            {
              icon: CheckCircle2,
              title: "وصول فوري وتحديثات مستمرة",
              desc: "بمجرد اشتراكك تفتح لك الدروس وملفات العمل بجودة عالية مع تحديثات مستمرة لأحدث أدوات الذكاء الاصطناعي.",
              color: "text-[#f5c518] bg-[#f5c518]/10 border-[#f5c518]/25",
            },
            {
              icon: Headphones,
              title: "متابعة وتقييم للتاسكات",
              desc: "ارفع تطبيقاتك العملية داخل المنصة ليقوم المدربون بمراجعتها وإعطائك ملاحظات دقيقة لتطوير مستواك.",
              color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
            },
            {
              icon: ShieldCheck,
              title: "شهادة معتمدة قابلة للتحقق",
              desc: "احصل فور إتمام الدورة على شهادة رسمية تحمل اسمك وكود QR فريد للتحقق الفوري لإضافتها في سيرتك الذاتية.",
              color: "text-sky-400 bg-sky-500/10 border-sky-500/25",
            },
          ].map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={i}
                className="p-6 rounded-2xl bg-[#19171b] border border-white/[0.07] hover:border-white/20 transition-all"
              >
                <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center mb-4 ${f.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-base font-extrabold text-white mb-2">{f.title}</h3>
                <p className="text-xs sm:text-sm text-white/60 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ================================================================
          5. STUDENT REVIEWS, WHATSAPP STORIES & STUDENT WORKS
         ================================================================ */}
      <ReviewsShowcase initialStudentWorks={loaderData?.initialStudentWorks} />

      {/* ================================================================
          6. CERTIFICATE & GUARANTEE SECTION
         ================================================================ */}
      <CertificateSection />

      {/* ================================================================
          7. FREQUENTLY ASKED QUESTIONS (FAQs)
         ================================================================ */}
      {faqs.length > 0 && (
        <section className="container mx-auto px-4 py-12 md:py-16 max-w-4xl">
          <div className="text-center mb-8">
            <span className="text-xs font-extrabold text-[#e50914]">كل ما تود معرفته</span>
            <h2 className="text-2xl md:text-3xl font-black text-white mt-1">الأسئلة الشائعة</h2>
          </div>
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((f) => (
              <AccordionItem
                key={f.id}
                value={f.id}
                className="rounded-2xl bg-[#19171b] border border-white/[0.08] px-5 overflow-hidden"
              >
                <AccordionTrigger className="text-right font-bold text-sm sm:text-base text-white hover:no-underline py-4">
                  {f.question}
                </AccordionTrigger>
                <AccordionContent className="text-white/70 text-xs sm:text-sm leading-relaxed pb-4">
                  {f.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )}
    </SiteShell>
  );
}
