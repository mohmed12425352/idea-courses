import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  Bell,
  UserCheck,
  PlayCircle,
  CheckCircle2,
  Lock,
  KeyRound,
  LogOut,
  Shield,
  MessageCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Award,
  Sparkles,
  Settings2,
  CreditCard,
  Wallet,
  Upload,
  Copy,
  X,
  Loader2,
  Hourglass,
  AlertCircle,
  FileText,
  Download,
  CheckSquare,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, compressAndUploadReceiptImage, getDeviceIdentity, resolveMediaUrl } from "./api";
import { ShieldedYouTubePlayer } from "./ShieldedYouTubePlayer";

interface Props {
  user: any;
  devices: any[];
  config: any;
  courses: any[];
  notifications: any[];
  paymentRequests?: any[];
  onRefresh: () => Promise<void>;
  onLogout: () => void;
  onSwitchToAdmin?: () => void;
}

export function StudentWorkspace({
  user,
  devices,
  config,
  courses,
  notifications,
  paymentRequests = [],
  onRefresh,
  onLogout,
  onSwitchToAdmin,
}: Props) {
  const [tab, setTab] = useState<"dashboard" | "explore" | "classroom" | "notifications" | "profile">("dashboard");
  const [classroomReturnTab, setClassroomReturnTab] = useState<"dashboard" | "explore">("dashboard");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  // Payment Modal State (InstaPay / E-Wallet + Receipt Screenshot Upload)
  const [payCourse, setPayCourse] = useState<any | null>(null);
  const [payMethod, setPayMethod] = useState<"instapay" | "wallet">("instapay");
  const [paySenderPhone, setPaySenderPhone] = useState(user?.phone || "");
  const [payReceiptUrl, setPayReceiptUrl] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const stateRef = useRef({ tab, classroomReturnTab, payCourse });
  stateRef.current = { tab, classroomReturnTab, payCourse };

  const navigateTab = (next: "dashboard" | "explore" | "classroom" | "notifications" | "profile", pushHist = true) => {
    setTab(next);
    if (pushHist && typeof window !== "undefined") {
      try {
        window.history.pushState({ edunovaTab: next }, "");
      } catch {}
    }
  };

  // Register Smart Back Navigation for Android Hardware Back Button & Browser Back
  useEffect(() => {
    const handleStepBack = (): boolean => {
      // 1. If video is in fullscreen, exit fullscreen first!
      if (typeof window.__edunovaExitFullscreen === "function" && window.__edunovaExitFullscreen()) {
        return true;
      }
      const cur = stateRef.current;
      // 2. If payment modal is open, close it
      if (cur.payCourse) {
        setPayCourse(null);
        return true;
      }
      // 3. If watching a lecture in classroom, return to the previous page (explore or dashboard)
      if (cur.tab === "classroom") {
        setTab(cur.classroomReturnTab || "dashboard");
        return true;
      }
      // 4. If on any secondary tab, return to student home dashboard
      if (cur.tab !== "dashboard") {
        setTab("dashboard");
        return true;
      }
      return false;
    };

    window.__edunovaHandleBack = handleStepBack;

    const onPopState = () => {
      handleStepBack();
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (window.__edunovaHandleBack === handleStepBack) {
        delete window.__edunovaHandleBack;
      }
    };
  }, []);

  const latestPaymentByCourse = useMemo(() => {
    const map: Record<string, any> = {};
    for (const pr of paymentRequests) {
      if (!map[pr.course_id]) {
        map[pr.course_id] = pr;
      }
    }
    return map;
  }, [paymentRequests]);

  const openPaymentModal = (course: any) => {
    setPayCourse(course);
    setPayMethod("instapay");
    setPaySenderPhone(user?.phone || "");
    setPayReceiptUrl("");
    setPayNotes("");
  };

  const handleUploadReceiptFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingReceipt(true);
    try {
      const url = await compressAndUploadReceiptImage(file);
      setPayReceiptUrl(url);
      toast.success("تم رفع صورة إيصال التحويل بنجاح ✓");
    } catch (err: any) {
      toast.error(err?.message || "تعذّر رفع صورة الإيصال");
    } finally {
      setUploadingReceipt(false);
      e.target.value = "";
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payCourse) return;
    if (!payReceiptUrl) {
      toast.error("يرجى رفع صورة إيصال التحويل أولاً");
      return;
    }
    setSubmittingPayment(true);
    try {
      await apiFetch("/api/student/payment-requests", {
        method: "POST",
        body: JSON.stringify({
          courseId: payCourse.id,
          method: payMethod,
          senderPhone: paySenderPhone,
          receiptUrl: payReceiptUrl,
          notes: payNotes,
        }),
      });
      toast.success("تم إرسال إيصال الدفع بنجاح! جاري مراجعته وتفعيل الكورس فوراً ✅");
      setPayCourse(null);
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || "تعذّر إرسال طلب الدفع");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const copyToClipboard = (val: string, label: string) => {
    if (!val) return;
    navigator.clipboard?.writeText(val).catch(() => {});
    toast.success(`تم نسخ ${label}: ${val}`);
  };

  const dev = getDeviceIdentity();

  const enrolledCourses = useMemo(() => courses.filter((c) => c.is_enrolled), [courses]);

  const stats = useMemo(() => {
    let totalLessons = 0;
    let completedLessons = 0;
    for (const c of enrolledCourses) {
      totalLessons += Number(c.total_lessons || 0);
      completedLessons += Number(c.completed_lessons || 0);
    }
    const overallPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    return {
      enrolledCount: enrolledCourses.length,
      completedLessons,
      totalLessons,
      overallPct,
    };
  }, [enrolledCourses]);

  // Find most recently watched unfinished lesson for "Continue Watching"
  const lastWatchedItem = useMemo(() => {
    let best: { course: any; lesson: any; updatedAt: number } | null = null;
    for (const c of enrolledCourses) {
      for (const s of c.sections || []) {
        for (const l of s.lessons || []) {
          if (l.progress?.updated_at && !l.progress?.is_completed) {
            const ts = new Date(l.progress.updated_at).getTime();
            if (!best || ts > best.updatedAt) {
              best = { course: c, lesson: l, updatedAt: ts };
            }
          }
        }
      }
    }
    return best;
  }, [enrolledCourses]);

  const activeCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId) || null,
    [courses, selectedCourseId],
  );

  const flatCourseLessons = useMemo(() => {
    if (!activeCourse) return [];
    return (activeCourse.sections || []).flatMap((s: any) =>
      (s.lessons || []).map((l: any) => ({ ...l, sectionTitle: s.title })),
    );
  }, [activeCourse]);

  const activeLesson = useMemo(() => {
    if (!flatCourseLessons.length) return null;
    return flatCourseLessons.find((l: any) => l.id === selectedLessonId) || flatCourseLessons[0];
  }, [flatCourseLessons, selectedLessonId]);

  const openCourseClassroom = (course: any, lessonId?: string) => {
    const allLessons = (course.sections || []).flatMap((s: any) => s.lessons || []);
    const firstPlayable = allLessons.find((l: any) => course.is_enrolled || l.is_free_preview) || allLessons[0];
    if (tab === "dashboard" || tab === "explore") {
      setClassroomReturnTab(tab);
    }
    setSelectedCourseId(course.id);
    setSelectedLessonId(lessonId || firstPlayable?.id || null);
    navigateTab("classroom");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeInput.trim()) return;
    setRedeeming(true);
    try {
      const res = await apiFetch("/api/student/redeem-code", {
        method: "POST",
        body: JSON.stringify({ code: codeInput.trim() }),
      });
      setCodeInput("");
      toast.success(`🎉 مبروك! تم تفعيل كورس "${res.courseTitle}" في حسابك بنجاح!`);
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || "كود التفعيل غير صالح");
    } finally {
      setRedeeming(false);
    }
  };

  const handleMarkLessonComplete = async () => {
    if (!activeCourse || !activeLesson) return;
    try {
      await apiFetch("/api/student/progress", {
        method: "POST",
        body: JSON.stringify({
          courseId: activeCourse.id,
          lessonId: activeLesson.id,
          positionSeconds: 0,
          markCompleted: true,
        }),
      });
      toast.success("أحسنت! تم تسجيل إتمام المحاضرة ✓");
      await onRefresh();
      const idx = flatCourseLessons.findIndex((x: any) => x.id === activeLesson.id);
      if (idx >= 0 && idx < flatCourseLessons.length - 1) {
        const nextL = flatCourseLessons[idx + 1];
        if (activeCourse.is_enrolled || nextL.is_free_preview) {
          setSelectedLessonId(nextL.id);
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "تعذّر حفظ التقدّم");
    }
  };

  const whatsappUrl = `https://wa.me/${String(config?.whatsapp_number || "201026533835").replace(/\D/g, "")}`;

  const navItems = [
    { id: "dashboard", label: "لوحة الطالب", icon: LayoutDashboard },
    { id: "explore", label: "الكورسات", icon: BookOpen },
    { id: "notifications", label: "الإشعارات", icon: Bell, badge: notifications.length },
    { id: "profile", label: "حسابي", icon: UserCheck },
  ] as const;

  return (
    <div className="min-h-screen bg-[#0b090d] text-slate-100 flex flex-col md:flex-row">
      {/* Desktop Right Sidebar */}
      <aside className="hidden md:flex md:w-64 lg:w-72 shrink-0 flex-col bg-[#131017] border-l border-white/10 p-4 justify-between sticky top-0 h-screen">
        <div className="space-y-6">
          {/* App Brand */}
          <div className="p-3 rounded-2xl bg-gradient-to-l from-rose-950/50 to-black/40 border border-rose-500/20">
            <div className="text-base font-black text-white">{config?.app_name || "Idea Courses"}</div>
            <div className="text-xs font-bold text-amber-400 mt-0.5">{config?.instructor_name || "بشمهندس ميدو شلبي"}</div>
          </div>

          {/* Nav Links */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id || (tab === "classroom" && item.id === "explore");
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTab(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    active
                      ? "bg-gradient-to-l from-rose-600 to-rose-500 text-white shadow-lg shadow-rose-950/50"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </span>
                  {"badge" in item && item.badge ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-black font-black">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}

            {user?.role === "admin" && onSwitchToAdmin && (
              <button
                type="button"
                onClick={onSwitchToAdmin}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-extrabold bg-amber-500/15 border border-amber-500/35 text-amber-300 hover:bg-amber-500/25 transition-all mt-4 cursor-pointer"
              >
                <Settings2 className="w-4 h-4" />
                <span>فتح لوحة تحكم الأدمن</span>
              </button>
            )}
          </nav>
        </div>

        {/* User Footer */}
        <div className="space-y-3 pt-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center font-black text-white">
              {user?.name?.[0] || "ط"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">{user?.name}</div>
              <div className="text-[11px] text-slate-400 truncate">{user?.email}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-rose-600/20 text-slate-300 hover:text-rose-300 text-xs font-bold border border-white/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-24 md:pb-8">
        {/* Top Native-Feel Mobile/App Header */}
        <header
          className="sticky top-0 z-30 bg-[#110d15]/95 backdrop-blur-xl border-b border-white/10 px-3.5 md:px-8 py-2.5 md:py-3.5 flex items-center justify-between gap-2"
          style={{ paddingTop: "calc(0.65rem + env(safe-area-inset-top))" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="md:hidden w-9 h-9 rounded-xl bg-gradient-to-br from-[#23131b] to-[#120e16] border border-rose-500/35 p-1.5 shrink-0 flex items-center justify-center">
              <img src="/logo.png" alt="" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[13px] sm:text-sm md:text-lg font-black text-white truncate">
                {tab === "dashboard" && `أهلاً يا ${user?.name?.split(" ")[0] || "بطل"} 👋`}
                {tab === "explore" && "جميع الكورسات التدريبية"}
                {tab === "classroom" && (activeCourse?.title || "غرفة المحاضرات المحمية")}
                {tab === "notifications" && "تنبيهات المحاضر"}
                {tab === "profile" && "ملف الطالب وأجهزته"}
              </h2>
              <p className="text-[10px] sm:text-[11px] text-amber-400 font-bold truncate">
                {config?.instructor_name || "بشمهندس ميدو شلبي"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {user?.role === "admin" && onSwitchToAdmin && (
              <button
                type="button"
                onClick={onSwitchToAdmin}
                className="md:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500 text-black font-black text-[11px] cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>الأدمن</span>
              </button>
            )}
            <div className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
              <Shield className="w-3.5 h-3.5 shrink-0" />
              <code className="font-mono text-amber-300">{dev.shortCode}</code>
            </div>
          </div>
        </header>

        <main className="p-3.5 sm:p-5 md:p-8 max-w-6xl w-full mx-auto space-y-4 md:space-y-6">
          {/* ==================== TAB 1: STUDENT DASHBOARD ==================== */}
          {tab === "dashboard" && (
            <>
              {/* Hero Welcome + Quick Code Redemption */}
              <div className="rounded-3xl bg-gradient-to-l from-[#24121b] via-[#17121b] to-[#121017] border border-rose-500/25 p-5 md:p-7 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div className="space-y-2 max-w-xl">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400">
                    <Sparkles className="w-4 h-4" />
                    <span>لوحة مذاكرتك الذكية</span>
                  </div>
                  <h3 className="text-xl md:text-2xl font-black text-white">
                    مرحباً {user?.name} — جاهز تكمل رحلة تعلّمك النهارده؟
                  </h3>
                  <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                    جميع دروسك ومستوى تقدّمك محفوظة سحابياً وتعمل معك في نفس اللحظة على الكمبيوتر والموبايل.
                  </p>
                </div>

                {/* Activation Code Box */}
                <form
                  onSubmit={handleRedeemCode}
                  className="w-full lg:w-80 bg-black/45 border border-white/10 rounded-2xl p-3.5 space-y-2.5 shrink-0"
                >
                  <div className="flex items-center gap-2 text-xs font-extrabold text-amber-300">
                    <KeyRound className="w-4 h-4" />
                    <span>تفعيل كورس بكود اشتراك</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      dir="ltr"
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                      placeholder="IDEA-XXXX-XXXX"
                      className="flex-1 min-w-0 rounded-xl bg-white/5 border border-white/15 px-3 py-2 text-xs font-mono text-center text-white outline-none focus:border-amber-400"
                    />
                    <button
                      type="submit"
                      disabled={redeeming || !codeInput.trim()}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black text-xs transition-all cursor-pointer"
                    >
                      {redeeming ? "..." : "تفعيل"}
                    </button>
                  </div>
                </form>
              </div>

              {/* 4 KPI Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {[
                  { label: "كورساتي المفعّلة", value: stats.enrolledCount, sub: "كورس متاح لك", accent: "text-rose-400" },
                  {
                    label: "المحاضرات المكتملة",
                    value: `${stats.completedLessons} / ${stats.totalLessons}`,
                    sub: "محاضرة فيديو",
                    accent: "text-emerald-400",
                  },
                  { label: "معدل الإنجاز العام", value: `${stats.overallPct}%`, sub: "مستوى تقدّمك", accent: "text-amber-400" },
                  {
                    label: "الأجهزة المرتبطة",
                    value: `${devices.length || 1} / ${config?.max_devices || 1}`,
                    sub: "مؤمّنة ببصمة الجهاز",
                    accent: "text-sky-400",
                  },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl bg-[#15121a] border border-white/10 p-4 md:p-5">
                    <div className={`text-2xl md:text-3xl font-black ${s.accent}`}>{s.value}</div>
                    <div className="text-xs font-extrabold text-white mt-1">{s.label}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Continue Watching Spotlight */}
              {lastWatchedItem && (
                <div className="rounded-2xl bg-[#17131d] border border-amber-500/30 p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/35 text-amber-400 flex items-center justify-center shrink-0">
                      <PlayCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-amber-400">استكمل المشاهدة من حيث توقفت</div>
                      <h4 className="text-sm md:text-base font-extrabold text-white">{lastWatchedItem.lesson.title}</h4>
                      <p className="text-xs text-slate-400">{lastWatchedItem.course.title}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openCourseClassroom(lastWatchedItem.course, lastWatchedItem.lesson.id)}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs cursor-pointer"
                  >
                    متابعة الدرس الآن ▶
                  </button>
                </div>
              )}

              {/* My Enrolled Courses Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base md:text-lg font-black text-white">كورساتي المشترك بها</h3>
                  <button
                    type="button"
                    onClick={() => setTab("explore")}
                    className="text-xs font-bold text-rose-400 hover:text-rose-300 cursor-pointer"
                  >
                    تصفّح كل الكورسات ←
                  </button>
                </div>

                {enrolledCourses.length === 0 ? (
                  <div className="rounded-3xl bg-[#15121a] border border-dashed border-white/15 p-8 md:p-12 text-center space-y-3">
                    <BookOpen className="w-10 h-10 text-slate-500 mx-auto" />
                    <h4 className="text-base font-extrabold text-white">لا توجد كورسات مفعّلة في حسابك بعد</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      يمكنك إدخال كود التفعيل بالأعلى أو تصفّح الكورسات المتاحة والتواصل مع الإدارة لتفعيل اشتراكك فوراً.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setTab("explore")}
                        className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer"
                      >
                        استعراض الكورسات المتاحة
                      </button>
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>تواصل مع الإدارة واتساب</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {enrolledCourses.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => openCourseClassroom(c)}
                        className="rounded-2xl bg-[#15121a] border border-white/10 hover:border-rose-500/50 overflow-hidden flex flex-col cursor-pointer transition-all group shadow-lg"
                      >
                        <div className="aspect-video bg-black relative overflow-hidden">
                          {c.thumbnail_url ? (
                            <img
                              src={resolveMediaUrl(c.thumbnail_url)}
                              alt={c.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-rose-950 to-slate-900 text-rose-300 font-black text-lg">
                              {c.title[0]}
                            </div>
                          )}
                          <span className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-emerald-500/90 text-black font-black text-[10px]">
                            مفعّل ✓
                          </span>
                        </div>
                        <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                          <div>
                            <div className="text-[11px] font-bold text-amber-400">{c.category}</div>
                            <h4 className="text-sm font-extrabold text-white mt-0.5 line-clamp-2">{c.title}</h4>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[11px] text-slate-400">
                              <span>
                                {c.completed_lessons} من {c.total_lessons} درس
                              </span>
                              <span className="font-bold text-amber-400">{c.progress_percent}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-l from-rose-500 to-amber-400 rounded-full"
                                style={{ width: `${c.progress_percent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ==================== TAB 2: EXPLORE ALL COURSES ==================== */}
          {tab === "explore" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="ابحث عن كورس أو تخصص..."
                  className="flex-1 rounded-2xl bg-[#15121a] border border-white/10 focus:border-rose-500 px-4 py-3 text-xs text-white outline-none"
                />
              </div>

              {courses.length === 0 ? (
                <div className="rounded-3xl bg-[#15121a] border border-white/10 p-12 text-center text-slate-400 text-sm">
                  سيتم إضافة الكورسات قريباً من قِبل المحاضر.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {courses
                    .filter((c) => !searchQ.trim() || c.title.toLowerCase().includes(searchQ.trim().toLowerCase()))
                    .map((c) => (
                      <div
                        key={c.id}
                        className="rounded-2xl bg-[#15121a] border border-white/10 overflow-hidden flex flex-col justify-between shadow-xl"
                      >
                        <div>
                          <div className="aspect-video bg-black relative">
                            {c.thumbnail_url ? (
                              <img src={resolveMediaUrl(c.thumbnail_url)} alt={c.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-rose-950 to-slate-900 text-white font-black text-xl">
                                {c.title[0]}
                              </div>
                            )}
                            <span className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/75 border border-white/15 text-amber-300 font-bold text-[10px]">
                              {c.total_lessons} محاضرة
                            </span>
                          </div>
                          <div className="p-4 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-rose-400 font-bold">{c.category}</span>
                              <span className="font-black text-amber-300">
                                {Number(c.price) > 0 ? `${c.price} ج.م` : "متاح للتفعيل"}
                              </span>
                            </div>
                            <h4 className="text-sm font-extrabold text-white">{c.title}</h4>
                            {c.subtitle && <p className="text-xs text-slate-400 line-clamp-2">{c.subtitle}</p>}
                          </div>
                        </div>

                        <div className="p-4 pt-0 flex gap-2">
                          {c.is_enrolled ? (
                            <button
                              type="button"
                              onClick={() => openCourseClassroom(c)}
                              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs cursor-pointer"
                            >
                              دخول المحاضرات ▶
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => openCourseClassroom(c)}
                                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs cursor-pointer"
                              >
                                معاينة الكورس
                              </button>
                              {latestPaymentByCourse[c.id]?.status === "pending" ? (
                                <button
                                  type="button"
                                  onClick={() => openPaymentModal(c)}
                                  className="flex-1 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/45 text-amber-300 font-extrabold text-xs inline-flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <Hourglass className="w-3.5 h-3.5" />
                                  <span>قيد المراجعة</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openPaymentModal(c)}
                                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-l from-rose-600 to-amber-500 hover:brightness-110 text-white font-extrabold text-xs inline-flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/50 cursor-pointer"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>
                                    {latestPaymentByCourse[c.id]?.status === "rejected" ? "أعد الدفع الآن" : "ادفع الآن"}
                                  </span>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                        {!c.is_enrolled && latestPaymentByCourse[c.id]?.status === "rejected" && (
                          <div className="px-4 pb-3">
                            <div className="rounded-xl bg-rose-500/15 border border-rose-500/35 px-3 py-2 text-[11px] text-rose-200 flex items-start gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                              <span>
                                <strong>تم رفض الإيصال السابق:</strong>{" "}
                                {latestPaymentByCourse[c.id]?.admin_note || "يرجى التأكد من الإيصال وإعادة المحاولة"}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* ==================== TAB 3: PROTECTED YOUTUBE CLASSROOM ==================== */}
          {tab === "classroom" && activeCourse && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => navigateTab(classroomReturnTab || "dashboard", false)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>{classroomReturnTab === "explore" ? "العودة لصفحة الكورسات" : "العودة للوحة الطالب"}</span>
                </button>
                <div className="text-xs font-bold text-amber-400">
                  تقدّمك في الكورس: {activeCourse.completed_lessons} / {activeCourse.total_lessons} (
                  {activeCourse.progress_percent}%)
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Cinema Stage (8 cols) */}
                <div className="lg:col-span-8 space-y-4">
                  {activeLesson ? (
                    activeLesson.youtube_video_id ? (
                      <ShieldedYouTubePlayer
                        key={activeLesson.id}
                        lessonId={activeLesson.id}
                        videoId={activeLesson.youtube_video_id}
                        title={activeLesson.title}
                        posterUrl={resolveMediaUrl(activeCourse.thumbnail_url)}
                        startAt={activeLesson.progress?.last_position_seconds || 0}
                        watermark={`${user?.name || "Student"} • ${user?.phone || user?.email || ""} • ${dev.shortCode}`}
                        onProgress={({ position, deltaWatched, firstPlay }) => {
                          void apiFetch("/api/student/progress", {
                            method: "POST",
                            body: JSON.stringify({
                              courseId: activeCourse.id,
                              lessonId: activeLesson.id,
                              positionSeconds: position,
                              deltaWatched,
                              incrementView: Boolean(firstPlay),
                            }),
                          }).catch(() => {});
                        }}
                        onEnded={handleMarkLessonComplete}
                      />
                    ) : (
                      <div className="aspect-video rounded-2xl bg-[#15121a] border border-rose-500/30 flex flex-col items-center justify-center p-6 text-center space-y-3">
                        <Lock className="w-10 h-10 text-rose-400" />
                        <h4 className="text-base font-black text-white">هذه المحاضرة للمشتركين في الكورس فقط</h4>
                        <p className="text-xs text-slate-400 max-w-md">
                          اشترك في كورس "{activeCourse.title}" عبر إنستا باي أو المحفظة الإلكترونية وارفع صورة التحويل لتفعيل حسابك فوراً.
                        </p>
                        {latestPaymentByCourse[activeCourse.id]?.status === "pending" ? (
                          <button
                            type="button"
                            onClick={() => openPaymentModal(activeCourse)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/45 text-amber-300 font-extrabold text-xs cursor-pointer"
                          >
                            <Hourglass className="w-4 h-4" />
                            <span>طلبك قيد المراجعة — عرض أو تحديث الإيصال</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openPaymentModal(activeCourse)}
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-l from-rose-600 to-amber-500 hover:brightness-110 text-white font-extrabold text-xs shadow-lg shadow-rose-950/50 cursor-pointer"
                          >
                            <CreditCard className="w-4 h-4" />
                            <span>
                              ادفع الآن {Number(activeCourse.price) > 0 ? `(${activeCourse.price} ج.م)` : ""}
                            </span>
                          </button>
                        )}
                      </div>
                    )
                  ) : (
                    <div className="aspect-video rounded-2xl bg-[#15121a] border border-white/10 flex items-center justify-center text-slate-400 text-sm">
                      لم يتم رفع محاضرات في هذا الكورس بعد.
                    </div>
                  )}

                  {/* Lesson Details & Actions */}
                  {activeLesson && (
                    <div className="rounded-2xl bg-[#15121a] border border-white/10 p-4 md:p-5 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-bold text-rose-400">{activeLesson.sectionTitle}</div>
                          <h3 className="text-base md:text-lg font-black text-white mt-0.5">{activeLesson.title}</h3>
                        </div>

                        {activeCourse.is_enrolled && (
                          <button
                            type="button"
                            onClick={handleMarkLessonComplete}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                              activeLesson.progress?.is_completed
                                ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                                : "bg-rose-600 hover:bg-rose-500 text-white"
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>
                              {activeLesson.progress?.is_completed ? "مكتمل ✓" : "تحديد المحاضرة كمكتملة"}
                            </span>
                          </button>
                        )}
                      </div>

                      {activeLesson.description && (
                        <p className="text-xs md:text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                          {activeLesson.description}
                        </p>
                      )}

                      {/* Attached Resources, PDFs, App Links & Tasks */}
                      <div className="flex flex-wrap gap-2.5 pt-2">
                        {activeLesson.pdf_url && (
                          <a
                            href={activeLesson.pdf_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-300 text-xs font-bold hover:bg-rose-500/25 transition-all shadow-sm"
                          >
                            <FileText className="w-4 h-4 text-rose-400" />
                            <span>📄 تحميل ملخص وملف الـ PDF</span>
                          </a>
                        )}

                        {activeLesson.app_download_url && (
                          <a
                            href={activeLesson.app_download_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition-all shadow-sm"
                          >
                            <Download className="w-4 h-4 text-emerald-400" />
                            <span>📱 رابط تثبيت وتحميل التطبيق / البرنامج</span>
                          </a>
                        )}

                        {activeLesson.resource_links && (
                          <a
                            href={activeLesson.resource_links}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/35 text-cyan-300 text-xs font-bold hover:bg-cyan-500/25 transition-all shadow-sm"
                          >
                            <ExternalLink className="w-4 h-4 text-cyan-400" />
                            <span>🔗 روابط ومراجع الدرس</span>
                          </a>
                        )}

                        {activeLesson.attachment_url && (
                          <a
                            href={activeLesson.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-300 text-xs font-bold hover:bg-amber-500/25 transition-all shadow-sm"
                          >
                            <ExternalLink className="w-4 h-4 text-amber-400" />
                            <span>ملحقات المحاضرة</span>
                          </a>
                        )}
                      </div>

                      {/* Practical Assignment / Task Box */}
                      {activeLesson.task_description && (
                        <div className="rounded-2xl p-4 md:p-5 bg-gradient-to-r from-purple-950/30 to-[#181324] border border-purple-500/35 space-y-2.5 mt-3 shadow-lg">
                          <div className="flex items-center gap-2 text-purple-300 font-black text-sm">
                            <CheckSquare className="w-4 h-4 text-purple-400" />
                            <span>📝 التكليف العملي / التاسك المطلوب من الطالب:</span>
                          </div>
                          <p className="text-xs md:text-sm text-slate-300 leading-relaxed whitespace-pre-line bg-black/30 p-3 rounded-xl border border-white/5">
                            {activeLesson.task_description}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Course Playlist (4 cols) */}
                <div className="lg:col-span-4 rounded-2xl bg-[#15121a] border border-white/10 p-4 space-y-4 max-h-[75vh] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h4 className="text-sm font-black text-white">محتوى الكورس</h4>
                    <span className="text-[11px] text-slate-400">{flatCourseLessons.length} درس</span>
                  </div>

                  {(activeCourse.sections || []).map((sec: any, sIdx: number) => (
                    <div key={sec.id} className="space-y-2">
                      <div className="text-xs font-extrabold text-amber-400 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px]">
                          {sIdx + 1}
                        </span>
                        <span>{sec.title}</span>
                      </div>

                      <div className="space-y-1.5">
                        {(sec.lessons || []).map((l: any) => {
                          const isCurrent = activeLesson?.id === l.id;
                          const unlocked = activeCourse.is_enrolled || l.is_free_preview;
                          const done = Boolean(l.progress?.is_completed);

                          return (
                            <button
                              key={l.id}
                              type="button"
                              onClick={() => setSelectedLessonId(l.id)}
                              className={`w-full text-right p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                isCurrent
                                  ? "bg-rose-600/20 border-rose-500 text-white"
                                  : "bg-black/30 border-white/5 hover:border-white/15 text-slate-300"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {done ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                ) : unlocked ? (
                                  <PlayCircle className="w-4 h-4 text-rose-400 shrink-0" />
                                ) : (
                                  <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <div className="text-xs font-bold truncate">{l.title}</div>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                    {l.duration_label && (
                                      <span className="inline-flex items-center gap-1">
                                        <Clock className="w-2.5 h-2.5" />
                                        {l.duration_label}
                                      </span>
                                    )}
                                    {l.is_free_preview && !activeCourse.is_enrolled && (
                                      <span className="text-emerald-400 font-bold">معاينة مجانية</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <ChevronLeft className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 4: NOTIFICATIONS ==================== */}
          {tab === "notifications" && (
            <div className="space-y-3 max-w-2xl">
              {notifications.length === 0 ? (
                <div className="rounded-3xl bg-[#15121a] border border-white/10 p-10 text-center text-slate-400 text-sm">
                  لا توجد إشعارات حالياً.
                </div>
              ) : (
                notifications.map((n: any) => (
                  <div key={n.id} className="rounded-2xl bg-[#15121a] border border-white/10 p-4 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-extrabold text-amber-300">{n.title}</h4>
                      <span className="text-[10px] text-slate-500">
                        {new Date(n.created_at).toLocaleString("ar-EG")}
                      </span>
                    </div>
                    <p className="text-xs md:text-sm text-slate-200 leading-relaxed">{n.body}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ==================== TAB 5: STUDENT PROFILE & DEVICES ==================== */}
          {tab === "profile" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
              <div className="rounded-2xl bg-[#15121a] border border-white/10 p-5 space-y-3">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>بيانات حساب الطالب</span>
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-slate-400">الاسم:</span>
                    <span className="font-bold text-white">{user?.name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-slate-400">البريد الإلكتروني:</span>
                    <span className="font-mono text-white">{user?.email}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-slate-400">رقم الهاتف:</span>
                    <span className="font-mono text-white">{user?.phone || "—"}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  تسجيل الخروج من الحساب
                </button>
              </div>

              <div className="rounded-2xl bg-[#15121a] border border-white/10 p-5 space-y-3">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>الأجهزة المرتبطة بحسابك ({devices.length} / {config?.max_devices || 1})</span>
                </h3>
                <div className="space-y-2">
                  {devices.map((d: any) => (
                    <div key={d.id} className="rounded-xl bg-black/40 border border-white/5 p-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-white">{d.device_label || d.platform}</div>
                        <div className="text-[10px] text-slate-400">
                          آخر ظهور: {new Date(d.last_seen_at).toLocaleString("ar-EG")}
                        </div>
                      </div>
                      {d.hw_short && (
                        <code className="text-[11px] font-mono text-amber-300 bg-white/5 px-2 py-0.5 rounded">
                          {d.hw_short}
                        </code>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Sleek Floating Glass Mobile Bottom Dock */}
      <div
        className="fixed bottom-0 inset-x-0 z-40 md:hidden px-3 pb-2 pt-1 pointer-events-none"
        style={{ paddingBottom: "calc(0.55rem + env(safe-area-inset-bottom))" }}
      >
        <nav className="pointer-events-auto rounded-2xl bg-[#15111c]/95 backdrop-blur-xl border border-white/12 shadow-[0_12px_35px_rgba(0,0,0,0.85)] flex items-center justify-around p-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id || (tab === "classroom" && item.id === "explore");
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTab(item.id)}
                className={`relative flex flex-col items-center justify-center flex-1 py-1.5 gap-0.5 rounded-xl text-[10.5px] font-extrabold transition-all cursor-pointer ${
                  active
                    ? "bg-gradient-to-l from-rose-600/25 to-amber-500/15 text-rose-400 border border-rose-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Icon className={`w-[18px] h-[18px] ${active ? "text-rose-400 scale-105" : ""} transition-transform`} />
                <span>{item.label}</span>
                {"badge" in item && item.badge ? (
                  <span className="absolute top-1 left-2 w-4 h-4 rounded-full bg-amber-500 text-black text-[9px] font-black flex items-center justify-center">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ==================== MODAL: PAY NOW (INSTAPAY / E-WALLET + RECEIPT UPLOAD) ==================== */}
      {payCourse && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <form
            onSubmit={handleSubmitPayment}
            className="w-full max-w-lg rounded-3xl bg-[#16121d] border border-white/15 p-4 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-amber-400" />
                  <span>ادفع الآن لتفعيل الكورس</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {payCourse.title} —{" "}
                  <strong className="text-amber-300">
                    {Number(payCourse.price) > 0 ? `${payCourse.price} ج.م` : "تواصل لتحديد السعر"}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayCourse(null)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Method Selector: InstaPay vs E-Wallet */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-200 block">1. اختر طريقة الدفع المناسبة:</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPayMethod("instapay")}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    payMethod === "instapay"
                      ? "bg-purple-600/20 border-purple-400 text-white shadow-lg shadow-purple-950/40"
                      : "bg-black/35 border-white/10 text-slate-400 hover:text-white"
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-purple-400" />
                  <span className="text-xs font-black">إنستا باي (InstaPay)</span>
                  <span className="text-[10px] opacity-75">تحويل لحظي بنكي</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPayMethod("wallet")}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    payMethod === "wallet"
                      ? "bg-rose-600/20 border-rose-400 text-white shadow-lg shadow-rose-950/40"
                      : "bg-black/35 border-white/10 text-slate-400 hover:text-white"
                  }`}
                >
                  <Wallet className="w-5 h-5 text-rose-400" />
                  <span className="text-xs font-black">محفظة إلكترونية</span>
                  <span className="text-[10px] opacity-75">فودافون / اتصالات / أورنج كاش</span>
                </button>
              </div>
            </div>

            {/* Transfer Destination Card with 1-Click Copy */}
            <div className="rounded-2xl bg-black/50 border border-amber-500/35 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-amber-300 font-bold">
                <span>
                  {payMethod === "instapay"
                    ? "بيانات التحويل عبر إنستا باي (InstaPay):"
                    : "رقم التحويل عبر المحفظة الإلكترونية:"}
                </span>
                <span>{config?.payment_holder_name || config?.instructor_name || "بشمهندس ميدو شلبي"}</span>
              </div>

              <div className="flex items-center justify-between gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                <code dir="ltr" className="text-sm sm:text-base font-black font-mono text-white tracking-wide truncate">
                  {payMethod === "instapay"
                    ? config?.instapay_address || "01026533835"
                    : config?.wallet_number || "01026533835"}
                </code>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      payMethod === "instapay"
                        ? config?.instapay_address || "01026533835"
                        : config?.wallet_number || "01026533835",
                      payMethod === "instapay" ? "حساب إنستا باي" : "رقم المحفظة",
                    )
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-[11px] shrink-0 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ</span>
                </button>
              </div>

              {Number(payCourse.price) > 0 && (
                <div className="text-[11px] text-slate-300">
                  المبلغ المطلوب تحويله: <strong className="text-emerald-400">{payCourse.price} ج.م</strong>
                </div>
              )}
            </div>

            {/* Sender Phone / Account */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                2. {payMethod === "instapay" ? "رقم الهاتف أو اسم حساب إنستا باي المحوّل منه" : "رقم المحفظة المحوّل منها"} *
              </label>
              <input
                required
                dir="ltr"
                value={paySenderPhone}
                onChange={(e) => setPaySenderPhone(e.target.value)}
                placeholder={payMethod === "instapay" ? "010xxxxxxxx أو user@instapay" : "010xxxxxxxx"}
                className="w-full rounded-xl bg-black/45 border border-white/15 focus:border-amber-400 px-3.5 py-2.5 text-xs text-right text-white outline-none"
              />
            </div>

            {/* Upload Transfer Receipt Screenshot */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">3. ارفع صورة إيصال التحويل (سكرين شوت) *</label>
              <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-500/40 hover:border-amber-400 bg-black/35 p-4 cursor-pointer transition-colors">
                {uploadingReceipt ? (
                  <>
                    <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
                    <span className="text-xs font-bold text-amber-300">جاري رفع صورة الإيصال...</span>
                  </>
                ) : payReceiptUrl ? (
                  <div className="w-full space-y-2 text-center">
                    <img
                      src={resolveMediaUrl(payReceiptUrl)}
                      alt="إيصال التحويل"
                      className="max-h-44 mx-auto rounded-xl border border-emerald-500/40 object-contain"
                    />
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      تم رفع الإيصال بنجاح — اضغط هنا لتغيير الصورة
                    </span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-7 h-7 text-amber-400" />
                    <span className="text-xs font-extrabold text-white">اضغط لاختيار صورة الإيصال من جهازك</span>
                    <span className="text-[10.5px] text-slate-400">يدعم صور الموبايل والكمبيوتر (JPG / PNG)</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadReceiptFile}
                  disabled={uploadingReceipt}
                  className="hidden"
                />
              </label>
            </div>

            {/* Optional Note */}
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">ملاحظة إضافية (اختياري)</label>
              <input
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="مثال: تم التحويل باسم ..."
                className="w-full rounded-xl bg-black/45 border border-white/15 px-3.5 py-2 text-xs text-white outline-none"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="submit"
                disabled={submittingPayment || uploadingReceipt || !payReceiptUrl}
                className="w-full py-3 rounded-xl bg-gradient-to-l from-emerald-600 to-emerald-500 hover:brightness-110 disabled:opacity-45 text-white font-black text-xs shadow-lg cursor-pointer"
              >
                {submittingPayment ? "جاري إرسال طلب الدفع..." : "تأكيد وإرسال إيصال الدفع ✓"}
              </button>
              <a
                href={`${whatsappUrl}?text=${encodeURIComponent(`مرحباً، لدي استفسار بخصوص الدفع لكورس: ${payCourse.title} — حسابي: ${user?.email}`)}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-[11px] inline-flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>هل لديك استفسار؟ تواصل معنا واتساب</span>
              </a>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
