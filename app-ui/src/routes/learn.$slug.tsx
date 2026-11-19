import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { resolveSessionForGuard } from "@/lib/auth-guard";
import { SiteShell } from "@/components/layout/SiteShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, PlayCircle, Lock, Unlock, ChevronRight, ChevronLeft, ListVideo, Ban, Award, FileText, BookOpen, ExternalLink, Calendar, Video, Clock, FileUp, FileVideo, Play, ClipboardList, AlertCircle, CheckCircle, RotateCcw, ChevronsUpDown, Sparkles, Download, Shield, Eye, MessageCircle, Loader2 } from "lucide-react";
import { parseResourceMetadata } from "@/lib/resources";
import { toast } from "sonner";
import { issueAndDownloadCertificate } from "@/lib/certificate";
import { SecurePlayer } from "@/components/common/SecurePlayer";
import { Star, Pencil, Trash2, X, Check } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { swr, invalidateCache } from "@/lib/cache";
import { StudentTasksPanel } from "@/components/learn/StudentTasksPanel";
import { SecureFileViewer } from "@/components/learn/SecureFileViewer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { recordSessionJoin } from "@/lib/attendance.functions";
import { resolveCourseForLearn, deductLessonView } from "@/lib/course-resolve.functions";
import {
  getDesktopBridge,
  getDesktopExeDownloadUrl,
  getMobileApkDownloadUrl,
  getNativeShortHwCode,
  isDirectDownloadableVideoUrl,
  isProtectedNativeApp,
} from "@/lib/desktop";


export const Route = createFileRoute("/learn/$slug")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { lesson?: string } => ({
    lesson: typeof s.lesson === "string" ? s.lesson : undefined,
  }),
  head: ({ params }) => ({
    meta: [
      { title: `تعلّم — ${params.slug} | Idea Courses` },
      { name: "description", content: "صفحة الدراسة للكورس — متاحة للطلاب المسجَّلين فقط على منصة Idea Courses." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  beforeLoad: async ({ location }) => {
    const session = await resolveSessionForGuard();
    if (!session) throw redirect({ to: "/login", search: { redirect: location.pathname } });
  },
  component: LearnPage,
});

type ProgressDebugEvent = {
  id: number;
  type: "start" | "pause" | "seek" | "complete" | "ready" | "progress" | "error";
  at: string;
  lessonTitle: string;
  source: string;
  position: number;
  duration: number;
  expected: number;
  ratio: number;
  threshold: number;
  completed: boolean;
  note?: string;
};

const toEnglishDigits = (value: string) =>
  value.replace(/[٠-٩۰-۹]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹".indexOf(digit) % 10));

const parseLessonDuration = (value?: string | number | null): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value * 60 : 0;
  if (!value) return 0;
  const raw = toEnglishDigits(String(value).trim().toLowerCase());
  const colonParts = raw.split(":").map((p) => parseInt(p, 10));
  if (colonParts.length > 1 && colonParts.every((n) => Number.isFinite(n))) {
    if (colonParts.length === 3) return colonParts[0] * 3600 + colonParts[1] * 60 + colonParts[2];
    if (colonParts.length === 2) return colonParts[0] * 60 + colonParts[1];
  }
  const hours = raw.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hour|hours|ساعة|ساعه)/)?.[1];
  const minutes = raw.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes|دقيقة|دقيقه|دق)/)?.[1];
  const seconds = raw.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds|ثانية|ثانيه|ث)/)?.[1];
  const total = (parseFloat(hours ?? "0") * 3600) + (parseFloat(minutes ?? "0") * 60) + parseFloat(seconds ?? "0");
  if (total > 0) return total;
  const justNumber = raw.match(/\d+(?:\.\d+)?/)?.[0];
  return justNumber ? parseFloat(justNumber) * 60 : 0;
};

const formatDebugTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
};

function LearnPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const { user, profile, isAdmin, isModerator } = useAuth();
  const { isEn, dir, t } = useI18n();
  const pick = (en: any, ar: any) => (isEn && typeof en === "string" && en.trim() ? en : ar);
  const nav = useNavigate();
  const resolveCourseForLearnFn = useServerFn(resolveCourseForLearn);
  const deductLessonViewFn = useServerFn(deductLessonView);
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [resources, setResources] = useState<Record<string, any[]>>({});
  const [sessions, setSessions] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, any>>({});
  const [eligibility, setEligibility] = useState<any>(null);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [activeLesson, setActiveLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [banned, setBanned] = useState(false);
  const [lessonProgress, setLessonProgress] = useState<Record<string, { last_position_seconds: number; completion_count: number; watched_seconds: number }>>({});
  const [lessonTaskStats, setLessonTaskStats] = useState<Record<string, { total: number; approved: number; pending: number; rejected: number; missing: number; overdue: number }>>({});
  const [progressDebugEvents, setProgressDebugEvents] = useState<ProgressDebugEvent[]>([]);
  const [latestProgressDebug, setLatestProgressDebug] = useState<ProgressDebugEvent | null>(null);
  const completedFiredRef = useRef<Set<string>>(new Set());
  const activeLessonRef = useRef<any>(null);
  const progressDebugIdRef = useRef(0);
  const sessionWatchedSecondsRef = useRef(0);
  const sessionDeductedLessonIdRef = useRef<string | null>(null);

  // Sync lesson if search query param changes dynamically
  useEffect(() => {
    if (search?.lesson && modules.length > 0) {
      const flat = modules.flatMap((m: any) => m.lessons).filter((l: any) => !l._blocked);
      const target = flat.find((l: any) => l.id === search.lesson);
      if (target && target.id !== activeLessonRef.current?.id) {
        setActiveLesson(target);
      }
    }
  }, [search?.lesson, modules]);

  // Reviews state
  const [myReview, setMyReview] = useState<any | null>(null);
  const [reviewChecked, setReviewChecked] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Attendance recording functions
  const recordJoinFn = useServerFn(recordSessionJoin);

  const handleJoinMeeting = (s: any) => {
    if (!s.meeting_url) return;
    // Optimistic local update
    setAttendance((prev) => ({
      ...prev,
      [s.id]: {
        ...(prev[s.id] || {}),
        session_id: s.id,
        status: prev[s.id]?.status === "late" ? "late" : "present",
        joined_at: prev[s.id]?.joined_at || new Date().toISOString(),
      },
    }));
    // Open meeting URL in new window/tab
    window.open(s.meeting_url, "_blank", "noopener,noreferrer");
    // Asynchronously record join on the server
    void recordJoinFn({ data: { sessionId: s.id } }).catch((e) => {
      console.warn("Failed to record session join:", e);
    });
  };

  const [editingReview, setEditingReview] = useState(false);
  const [editComment, setEditComment] = useState("");
  const [editRating, setEditRating] = useState(5);

  // Secure file viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerName, setViewerName] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState<string | null>(null);
  const [viewerAllowDownload, setViewerAllowDownload] = useState(false);

  // Controlled tabs so a toast action can jump to the review tab
  const [activeTab, setActiveTab] = useState<string>("review");
  // Centered review dialog (opened from the nudge toast)
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  // Open modules in accordion (default to all open for quick and easy access)
  const [openModules, setOpenModules] = useState<string[]>([]);

  const allLessons = useMemo(() => modules.flatMap((m) => (m.lessons ?? []).map((l: any) => ({ ...l, moduleTitle: pick(m.title_en, m.title) }))), [modules, isEn]);

  const currentLessonIndex = useMemo(() => {
    if (!activeLesson) return -1;
    return allLessons.findIndex((l: any) => l.id === activeLesson.id);
  }, [allLessons, activeLesson?.id]);

  const isLessonGatedByReview = (lessonId: string) => {
    if (isAdmin || isModerator || !reviewChecked || myReview) return false;
    const idx = allLessons.findIndex((x: any) => x.id === lessonId);
    return idx > 0;
  };

  const isReviewMandatory = useMemo(() => {
    if (isAdmin || isModerator || !reviewChecked || myReview) return false;
    const completedCount = (enrollment?.completed_lessons ?? []).length;
    return completedCount > 0 || currentLessonIndex > 0;
  }, [isAdmin, isModerator, reviewChecked, myReview, enrollment?.completed_lessons, currentLessonIndex]);

  const isReviewRequiredForActiveLesson = useMemo(() => {
    if (isAdmin || isModerator || !reviewChecked || myReview) return false;
    return currentLessonIndex > 0;
  }, [isAdmin, isModerator, reviewChecked, myReview, currentLessonIndex]);

  const pendingTargetLessonRef = useRef<any>(null);

  const goToLesson = (targetLesson: any) => {
    if (!targetLesson || targetLesson._blocked) return;

    const targetIdx = allLessons.findIndex((l: any) => l.id === targetLesson.id);
    if (!isAdmin && !isModerator && !myReview && targetIdx > 0) {
      pendingTargetLessonRef.current = targetLesson;
      setReviewDialogOpen(true);
      toast.info(isEn ? "Please share your review to continue the course ⭐" : "عشان تكمل الكورس لازم تقول رأيك في الكورس أولاً ⭐");
      return;
    }

    activeLessonRef.current = targetLesson;
    setActiveLesson(targetLesson);
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      nav({
        search: ((prev: any) => ({ ...prev, lesson: targetLesson.id })) as never,
        replace: false,
      });
    } catch {}
  };

  const prevLesson = currentLessonIndex > 0 ? allLessons[currentLessonIndex - 1] : null;
  const nextLesson = currentLessonIndex >= 0 && currentLessonIndex < allLessons.length - 1 ? allLessons[currentLessonIndex + 1] : null;

  const activeModuleId = useMemo(() => {
    if (!activeLesson) return null;
    return modules.find((m: any) => m.lessons?.some((l: any) => l.id === activeLesson.id))?.id ?? null;
  }, [modules, activeLesson?.id]);

  const activeModuleResources = activeModuleId ? (resources[activeModuleId] ?? []) : [];

  // Video watch limits (default 4 views, 0 = unlimited)
  const maxViews = useMemo(() => {
    if (!course?.certificate_config) return 4;
    const cfg = course.certificate_config as Record<string, any>;
    if (cfg.max_video_views !== undefined && cfg.max_video_views !== null) {
      const parsed = Number(cfg.max_video_views);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 4;
    }
    return 4;
  }, [course]);

  const [adminBypassLock, setAdminBypassLock] = useState(false);

  const getLessonViewStats = (lessonId: string) => {
    if (maxViews === 0) {
      return { maxViews: 0, viewsUsed: lessonProgress[lessonId]?.completion_count ?? 0, viewsRemaining: null, isLocked: false, isResuming: false, savedPos: 0 };
    }
    const viewsUsed = lessonProgress[lessonId]?.completion_count ?? 0;
    const viewsRemaining = Math.max(0, maxViews - viewsUsed);
    const dbPos = lessonProgress[lessonId]?.last_position_seconds ?? 0;
    const localPos = typeof window !== "undefined"
      ? Number(localStorage.getItem(`learn:${course?.id}:${lessonId}:pos`)) || 0
      : 0;
    const savedPos = Math.max(dbPos, localPos);

    // Is the student resuming an in-progress session they already started?
    const isCompleted = (enrollment?.completed_lessons ?? []).includes(lessonId);
    const hasUnfinishedWatch = viewsUsed > 0 && savedPos >= 10 && !isCompleted;

    // A lesson is locked if 0 views remain and they are NOT resuming an unfinished watch
    const lockedForStudent = viewsRemaining <= 0 && !hasUnfinishedWatch;
    const isLocked = lockedForStudent && (!isAdmin || !adminBypassLock);

    return { maxViews, viewsUsed, viewsRemaining, isLocked, isResuming: hasUnfinishedWatch, savedPos };
  };

  const activeViewStats = activeLesson ? getLessonViewStats(activeLesson.id) : null;

  // Capture start position ONCE per lesson so SecurePlayer receives a fixed start timestamp
  const initialLessonPos = useMemo(() => {
    if (!activeLesson) return 0;
    return getLessonViewStats(activeLesson.id).savedPos;
  }, [activeLesson?.id]);

  const getModuleLiveSession = (mIdx: number, m: any) => {
    return sessions.find((s) => {
      const sTitle = (pick(s.title_en, s.title) || "").toLowerCase().trim();
      const mTitle = (pick(m.title_en, m.title) || "").toLowerCase().trim();
      const num = mIdx + 1;
      return (
        sTitle.includes(`سيشن ${num}`) ||
        sTitle.includes(`session ${num}`) ||
        sTitle.includes(`السيشن ${num}`) ||
        sTitle === `${num}` ||
        (mTitle && (sTitle.includes(mTitle) || mTitle.includes(sTitle)))
      );
    });
  };

  // Sessions remain collapsed by default until the student clicks to expand them

  // Synchronous extraction of direct video URLs (Bunny Stream, iframe embeds, YouTube, Vimeo)
  // so that switching lessons updates the player's URL on the exact same render tick
  const directVideoUrl = useMemo(() => {
    const raw = activeLesson?.video_url as string | null | undefined;
    if (!raw) return null;
    const decoded = raw
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">");
    const iframeMatch = decoded.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
    const resolved = (iframeMatch ? iframeMatch[1] : decoded)
      .trim()
      .replace(/^https?:\/\/player\.mediadelivery\.net\//i, "https://iframe.mediadelivery.net/");
    return resolved.startsWith("http") ? resolved : null;
  }, [activeLesson?.id, activeLesson?.video_url]);

  const [signedStorageUrl, setSignedStorageUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const raw = activeLesson?.video_url as string | null | undefined;
    if (!raw) { setSignedStorageUrl(null); return; }
    const decoded = raw
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">");
    const iframeMatch = decoded.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
    const resolved = (iframeMatch ? iframeMatch[1] : decoded)
      .trim()
      .replace(/^https?:\/\/player\.mediadelivery\.net\//i, "https://iframe.mediadelivery.net/");
    if (resolved.startsWith("http")) {
      setSignedStorageUrl(null);
      return;
    }
    setSignedStorageUrl(null);
    (async () => {
      const { data, error } = await supabase.storage
        .from("course-videos")
        .createSignedUrl(resolved, 60 * 60 * 4);
      if (cancelled) return;
      if (error || !data?.signedUrl) { setSignedStorageUrl(null); return; }
      setSignedStorageUrl(data.signedUrl);
    })();
    return () => { cancelled = true; };
  }, [activeLesson?.id, activeLesson?.video_url]);

  const remoteVideoUrl = directVideoUrl || signedStorageUrl;
  const desktopBridge = getDesktopBridge();
  const [desktopOnlySetting, setDesktopOnlySetting] = useState(false);
  const [adminBypassDesktopOnly, setAdminBypassDesktopOnly] = useState(false);
  const [vaultVideoUrl, setVaultVideoUrl] = useState<string | null>(null);
  const [vaultDlPercent, setVaultDlPercent] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "desktop_only_playback")
      .maybeSingle()
      .then(({ data }) => {
        const enabled = Boolean(data?.value?.enabled ?? data?.value === true);
        setDesktopOnlySetting(enabled);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!desktopBridge || !activeLesson?.id) {
      setVaultVideoUrl(null);
      setVaultDlPercent(null);
      return;
    }
    let cancelled = false;
    desktopBridge
      .vaultHas(activeLesson.id)
      .then((res) => {
        if (!cancelled) setVaultVideoUrl(res?.exists && res.item?.vaultUrl ? res.item.vaultUrl : null);
      })
      .catch(() => {});

    const unsub = desktopBridge.onVaultProgress((prog) => {
      if (!prog || prog.lessonId !== activeLesson.id) return;
      if (prog.status === "starting" || prog.status === "downloading") {
        setVaultDlPercent(prog.percent ?? 0);
      } else if (prog.status === "completed") {
        setVaultDlPercent(null);
        if (prog.vaultUrl) setVaultVideoUrl(prog.vaultUrl);
        toast.success("تم تشفير وحفظ الدرس أوفلاين على جهازك بنجاح ✓");
      } else if (prog.status === "error") {
        setVaultDlPercent(null);
        toast.error(prog.error || "تعذّر حفظ الدرس أوفلاين");
      }
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [activeLesson?.id]);

  const handleDownloadOffline = async () => {
    if (!desktopBridge || !activeLesson || !remoteVideoUrl) return;
    try {
      setVaultDlPercent(1);
      const { data: sessData } = await supabase.auth.getSession();
      const wmText = `${profile?.name || user?.email || "Student"}${profile?.phone ? ` • ${profile.phone}` : ""} • HW:${desktopBridge.getDeviceInfo()?.shortCode || ""}`;
      await desktopBridge.vaultDownload({
        lessonId: activeLesson.id,
        url: remoteVideoUrl,
        lessonTitle: pick(activeLesson.title_en, activeLesson.title),
        courseTitle: pick(course?.title_en, course?.title),
        courseSlug: course?.slug || slug,
        duration: activeLesson.duration ? String(activeLesson.duration) : "",
        watermark: wmText,
        accessToken: sessData?.session?.access_token,
      });
    } catch (err: any) {
      setVaultDlPercent(null);
      toast.error(err?.message || "تعذّر تحميل الدرس أوفلاين");
    }
  };

  const videoUrl = vaultVideoUrl || remoteVideoUrl;
  const nativeHwShort = getNativeShortHwCode();
  const isBlockedByDesktopOnly = desktopOnlySetting && !isProtectedNativeApp() && (!isAdmin || !adminBypassDesktopOnly);

  useEffect(() => {
    activeLessonRef.current = activeLesson;
    if (typeof window !== "undefined" && activeLesson?.id) {
      window.sessionStorage.setItem(`learn:${slug}:activeLesson`, activeLesson.id);
    }
  }, [activeLesson]);

  useEffect(() => {
    setProgressDebugEvents([]);
    setLatestProgressDebug(null);
    sessionWatchedSecondsRef.current = 0;
    if (activeLesson?.id) {
      const stats = getLessonViewStats(activeLesson.id);
      if (stats.isResuming || (stats.savedPos && stats.savedPos >= 10)) {
        // Resuming an already-started view session! Do NOT deduct another view!
        sessionDeductedLessonIdRef.current = activeLesson.id;
      } else {
        sessionDeductedLessonIdRef.current = null;
      }
    } else {
      sessionDeductedLessonIdRef.current = null;
    }
  }, [activeLesson?.id]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const rawSlug = String(slug || "").trim();
      let decodedSlug = rawSlug;
      try {
        decodedSlug = decodeURIComponent(rawSlug).trim();
      } catch {}
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawSlug);

      let c: any = null;
      let e: any = null;
      let ms: any[] = [];

      // 1. Try fast SWR client query
      try {
        c = await swr(`course:slug:${rawSlug}`, 5 * 60_000, async () => {
          let q = supabase.from("courses").select("*");
          if (isUuid) {
            q = q.or(`id.eq.${rawSlug},slug.eq.${rawSlug}`);
          } else if (decodedSlug !== rawSlug) {
            q = q.or(`slug.eq.${rawSlug},slug.eq.${decodedSlug},slug.ilike.${rawSlug},slug.ilike.${decodedSlug}`);
          } else {
            q = q.or(`slug.eq.${rawSlug},slug.ilike.${rawSlug}`);
          }
          const { data } = await q.maybeSingle();
          return data;
        });
        if (!c) {
          invalidateCache(`course:slug:${rawSlug}`);
        }
      } catch {
        // ignore
      }

      // 2. Fetch user's enrollments to match enrollment (and course if needed)
      if (user && !e) {
        try {
          const { data: enrs } = await supabase
            .from("enrollments")
            .select("*, courses(*)")
            .eq("user_id", user.id)
            .neq("status", "banned");

          const match = (enrs ?? []).find((enr: any) => {
            const courseObj = Array.isArray(enr.courses) ? enr.courses[0] : enr.courses;
            return (
              (c && enr.course_id === c.id) ||
              enr.course_id === rawSlug ||
              courseObj?.id === rawSlug ||
              courseObj?.slug === rawSlug ||
              courseObj?.slug === decodedSlug ||
              (c?.slug && (courseObj?.slug === c.slug || enr.course_id === c.id))
            );
          });

          if (match) {
            e = match;
            if (!c) {
              c = Array.isArray(match.courses) ? match.courses[0] : match.courses;
            }
          }
        } catch {}
      }

      // 3. Server-side authoritative resolver (bypasses RLS with supabaseAdmin)
      if (!c || !e) {
        try {
          const res = await resolveCourseForLearnFn({
            data: { slug: rawSlug, userId: user?.id },
          });
          if (res?.ok && res.course) {
            c = res.course;
            if (res.enrollment) e = res.enrollment;
            if (res.modules && res.modules.length > 0) ms = res.modules;
            if (Array.isArray((res as any).lessonProgress)) {
              const map: Record<string, any> = {};
              (res as any).lessonProgress.forEach((p: any) => { map[p.lesson_id] = p; });
              setLessonProgress(map);
            }
          } else if (res && !res.ok && (res as any).error === "not_enrolled" && !e && !isAdmin && !isModerator) {
            const targetCourseId = (res as any).course?.id || c?.id;
            if (targetCourseId) {
              setLoading(false);
              toast.info(isEn ? "You need to enroll in this course first to access lessons" : "لازم تشترك في الكورس الأول عشان تقدر تشغّل الدروس");
              nav({ to: "/checkout/$courseId", params: { courseId: targetCourseId } });
              return;
            }
          }
        } catch (serverErr) {
          console.warn("[learn] Server resolveCourseForLearn error:", serverErr);
        }
      }

      // 4. Course check
      if (!c) {
        setLoading(false);
        toast.error(isEn ? "Course not found" : "لم يتم العثور على الكورس");
        nav({ to: "/courses" });
        return;
      }
      setCourse(c);

      // Fetch enrollment + modules in parallel if not already fetched
      if (!e || ms.length === 0) {
        const [enrollRes, msData] = await Promise.all([
          e
            ? Promise.resolve({ data: e })
            : supabase
                .from("enrollments")
                .select("*")
                .eq("course_id", c.id)
                .eq("user_id", user.id)
                .neq("status", "banned")
                .maybeSingle(),
          ms.length > 0
            ? Promise.resolve(ms)
            : swr(
                `course:modules:${c.id}`,
                15_000,
                async () => {
                  const { data } = await supabase.from("modules").select("*, lessons(*)").eq("course_id", c.id).order("order_index");
                  return data ?? [];
                },
              ),
        ]);
        if (!e) e = enrollRes.data;
        if (ms.length === 0) ms = msData ?? [];
      }

      if (!e) {
        if (isAdmin || isModerator) {
          e = {
            id: `admin-${user.id}`,
            course_id: c.id,
            user_id: user.id,
            status: "active",
            progress: 100,
            completed_lessons: [],
            created_at: new Date().toISOString(),
          };
        } else {
          setLoading(false);
          toast.info(isEn ? "You need to enroll in this course first to access lessons" : "لازم تشترك في الكورس الأول عشان تقدر تشغّل الدروس");
          nav({ to: "/checkout/$courseId", params: { courseId: c.id } });
          return;
        }
      }
      if (!e) return;
      if (e.status === "banned") { setBanned(true); setLoading(false); return; }
      if (e.status && e.status !== "active" && e.status !== "approved" && e.status !== "completed") {
        setLoading(false);
        toast.info(isEn ? "Your course enrollment is under review by administration" : "اشتراكك في الكورس قيد المراجعة من الإدارة");
        nav({ to: "/dashboard" });
        return;
      }
      setEnrollment(e);

      const sorted = (ms ?? [])
        .sort((a: any, b: any) => (Number(a.order_index ?? 0) - Number(b.order_index ?? 0)))
        .map((m: any) => ({
          ...m,
          lessons: (m.lessons ?? []).sort((a: any, b: any) => {
            const ordA = Number(a.order_index ?? 0);
            const ordB = Number(b.order_index ?? 0);
            if (ordA !== ordB) return ordA - ordB;
            return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
          }),
        }));

      // Mark lessons the admin has blocked for this student (keep visible, disabled).
      const { data: blocks } = await supabase
        .from("lesson_access_blocks")
        .select("lesson_id, reason")
        .eq("user_id", user.id);
      const blockedMap = new Map<string, string | null>((blocks ?? []).map((b: any) => [b.lesson_id, b.reason ?? null]));
      const filtered = blockedMap.size === 0
        ? sorted
        : sorted.map((m: any) => ({
            ...m,
            lessons: m.lessons.map((l: any) =>
              blockedMap.has(l.id) ? { ...l, _blocked: true, _blockReason: blockedMap.get(l.id) } : l
            ),
          }));
      setModules(filtered);

      const flat = filtered.flatMap((m: any) => m.lessons).filter((l: any) => !l._blocked);
      const completed = e.completed_lessons ?? [];
      const requestedLesson = search?.lesson ? flat.find((l: any) => l.id === search.lesson) : null;
      const savedLessonId = typeof window !== "undefined" ? window.sessionStorage.getItem(`learn:${slug}:activeLesson`) : null;
      const savedLesson = savedLessonId ? flat.find((l: any) => l.id === savedLessonId) : null;
      const next = requestedLesson ?? savedLesson ?? flat.find((l: any) => !completed.includes(l.id)) ?? flat[0];
      setActiveLesson(next ?? null);

      // Fetch user's review upfront to know if subsequent lessons are gated
      try {
        const { data: rv } = await supabase
          .from("reviews")
          .select("id,rating,comment,is_approved,created_at")
          .eq("course_id", c.id)
          .eq("user_id", user.id)
          .maybeSingle();
        setMyReview(rv ?? null);
      } catch {}
      setReviewChecked(true);

      // ✅ Show the player NOW — everything below is secondary metadata
      // (resources, sessions, progress, tasks) and shouldn't
      // block the user from watching the lesson.
      setLoading(false);

      const moduleIds = sorted.map((m: any) => m.id);

      // Fire all secondary requests in parallel in the background.
      const resourcesP = moduleIds.length > 0
        ? swr(
            `course:resources:${c.id}`,
            5 * 60_000,
            async () => {
              const { data } = await supabase.from("module_resources").select("*").in("module_id", moduleIds).order("order_index");
              return data ?? [];
            },
          ).then((rs: any) => {
            const grouped: Record<string, any[]> = {};
            (rs ?? []).forEach((r: any) => {
              if (!grouped[r.module_id]) grouped[r.module_id] = [];
              grouped[r.module_id].push(r);
            });
            setResources(grouped);
          })
        : Promise.resolve();

      const sessionsP = swr(
        `course:sessions:${c.id}:${user.id}`,
        2 * 60_000,
        async () => {
          const { data } = await supabase.from("live_sessions").select("*").eq("course_id", c.id).order("scheduled_at", { ascending: false });
          return data ?? [];
        },
        (cached) => setSessions(cached as any),
      ).then((sess) => setSessions(sess as any));

      // Attendance per past session + certificate eligibility
      const attendanceP = supabase
        .rpc("my_course_attendance", { _course_id: c.id })
        .then(({ data: att }) => {
          const map: Record<string, any> = {};
          (att ?? []).forEach((a: any) => { map[a.session_id] = a; });
          setAttendance(map);
        });
      const eligibilityP = supabase
        .rpc("my_certificate_eligibility", { _course_id: c.id })
        .then(({ data: el }) => setEligibility(el as any));
      void attendanceP; void eligibilityP;

      const progressP = supabase
        .from("lesson_progress")
        .select("lesson_id, last_position_seconds, completion_count, watched_seconds")
        .eq("course_id", c.id)
        .eq("user_id", user.id)
        .then(({ data: prog }) => {
          const map: Record<string, any> = {};
          (prog ?? []).forEach((p: any) => { map[p.lesson_id] = p; });
          setLessonProgress(map);
        });

      const tasksP = supabase
        .from("course_tasks")
        .select("id,lesson_id,due_at")
        .eq("course_id", c.id)
        .eq("is_published", true)
        .not("lesson_id", "is", null)
        .then(async ({ data: allTasks }) => {
          const taskIds = (allTasks ?? []).map((t: any) => t.id);
          const subsByTask: Record<string, any> = {};
          if (taskIds.length) {
            const { data: subs } = await supabase
              .from("task_submissions")
              .select("task_id,status,created_at")
              .eq("user_id", user.id)
              .in("task_id", taskIds)
              .order("created_at", { ascending: false });
            (subs ?? []).forEach((s: any) => { if (!subsByTask[s.task_id]) subsByTask[s.task_id] = s; });
          }
          const stats: Record<string, { total: number; approved: number; pending: number; rejected: number; missing: number; overdue: number }> = {};
          (allTasks ?? []).forEach((t: any) => {
            const lid = t.lesson_id as string;
            const s = stats[lid] ?? (stats[lid] = { total: 0, approved: 0, pending: 0, rejected: 0, missing: 0, overdue: 0 });
            s.total++;
            const sub = subsByTask[t.id];
            if (!sub) {
              s.missing++;
              if (t.due_at && new Date(t.due_at).getTime() < Date.now()) s.overdue++;
            } else if (sub.status === "approved") s.approved++;
            else if (sub.status === "rejected") s.rejected++;
            else s.pending++;
          });
          setLessonTaskStats(stats);
        });

      const reviewP = supabase
        .from("reviews")
        .select("id,rating,comment,is_approved,created_at")
        .eq("course_id", c.id)
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data: rv }) => setMyReview(rv ?? null));

      // Don't await — let them settle in the background.
      void Promise.allSettled([resourcesP, sessionsP, progressP, tasksP, reviewP]);
    })();
  }, [slug, user?.id]);

  // Gentle nudge: if the student hasn't left a review yet, remind them
  // once per course after ~90s of being on the learn page.
  useEffect(() => {
    if (loading || !course || myReview) return;
    const key = `reviewNudge:${course.id}`;
    if (typeof window !== "undefined" && window.sessionStorage.getItem(key)) return;
    const t = setTimeout(() => {
      if (typeof window !== "undefined") window.sessionStorage.setItem(key, "1");
      toast(isEn ? "We'd love your course review ⭐" : "عايزين رأيك في الكورس ⭐", {
        description: isEn ? "Take a second to share your review — helps other students and gives us feedback." : "خد ثانية وقولنا رأيك — بيساعد باقي الطلاب وبيوصلنا ملاحظاتك.",
        duration: 12000,
        action: {
          label: isEn ? "Write Review" : "اكتب رأيك",
          onClick: () => {
            setReviewDialogOpen(true);
          },
        },
      });
    }, 90_000);
    return () => clearTimeout(t);
  }, [loading, course?.id, myReview]);

  if (loading) {
    return (
      <SiteShell>
        <div className="container-page py-24 flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="w-9 h-9 animate-spin text-red-600" />
          <p className="text-xs text-slate-400 font-medium">
            {isEn ? "Loading course content..." : "جاري تحميل محتوى الكورس..."}
          </p>
        </div>
      </SiteShell>
    );
  }

  if (banned) {
    return (
      <SiteShell>
        <div className="container-page py-20 text-center">
          <Ban className="h-14 w-14 mx-auto text-destructive mb-4" />
          <h2 className="text-2xl font-bold mb-2">{isEn ? "Your access to this course has been suspended" : "تم تعليق وصولك لهذا الكورس"}</h2>
          <p className="text-muted-foreground">{isEn ? "Please contact administration." : "يرجى التواصل مع الإدارة."}</p>
        </div>
      </SiteShell>
    );
  }

  if (!course) {
    return <SiteShell><div className="container-page py-20 text-center">{isEn ? "Course not found" : "الكورس غير موجود"}</div></SiteShell>;
  }

  if (!enrollment) {
    return (
      <SiteShell>
        <div className="container-page py-20 text-center">
          <Lock className="h-14 w-14 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">{isEn ? "You are not enrolled in this course" : "لست مشتركاً في هذا الكورس"}</h2>
          <p className="text-muted-foreground mb-6">{isEn ? "Enroll first to access content." : "اشترك أولاً للوصول إلى المحتوى."}</p>
          <Button onClick={() => nav({ to: "/courses/$slug", params: { slug: course?.slug || slug } })} className="bg-gold text-gold-foreground hover:bg-gold/90">{isEn ? "Course Page" : "صفحة الكورس"}</Button>
        </div>
      </SiteShell>
    );
  }

  const completed: string[] = enrollment.completed_lessons ?? [];
  const totalLessons = allLessons.length;
  const progress = totalLessons > 0 ? Math.round((completed.length / totalLessons) * 100) : 0;
  const attendanceBlocked = eligibility ? eligibility.blocked === true : false;
  const attendanceLow = eligibility ? eligibility.eligible === false && !eligibility.blocked : false;
  const certificateAllowed = !eligibility || eligibility.eligible === true;
  const isCompleted = totalLessons > 0 && progress >= 100 && certificateAllowed;
  const certificateHint = attendanceBlocked
    ? (isEn ? "The certificate is on hold by the administration" : "الشهادة موقوفة من الإدارة")
    : attendanceLow
      ? (isEn
          ? `Attendance ${eligibility?.rate ?? 0}% — you need ${eligibility?.required_percent ?? 0}% (attend live or watch the recording)`
          : `نسبة حضورك ${eligibility?.rate ?? 0}% والمطلوب ${eligibility?.required_percent ?? 0}% — احضر اللايف أو شاهد التسجيل كامل`)
      : null;

  const downloadCertificate = async () => {
    if (certificateHint) { toast.error(certificateHint); return; }
    try {
      await issueAndDownloadCertificate({
        userId: user!.id,
        courseId: course.id,
        studentName: profile?.name || user?.email || "Student",
        courseTitle: course.title,
        courseSlug: course.slug,
        overrides: course.certificate_config,
      });
      toast.success(isEn ? "Certificate downloaded 🎉" : "تم تحميل الشهادة 🎉");
    } catch (e: any) {
      console.error(e);
      const msg = String(e?.message ?? "");
      if (msg.includes("certificate_blocked")) {
        toast.error(isEn ? "The certificate is on hold by the administration" : "الشهادة موقوفة من الإدارة");
      } else if (msg.includes("attendance_too_low")) {
        toast.error(isEn ? "Your attendance is below the required percentage" : "نسبة حضورك أقل من المطلوب للحصول على الشهادة");
      } else {
        toast.error(isEn ? "Failed to generate certificate" : "تعذّر إنشاء الشهادة");
      }
    }
  };

  const markComplete = async () => {
    if (!activeLesson || completed.includes(activeLesson.id)) return;
    const { data: rpcData, error } = await supabase.rpc("mark_lesson_complete", { _lesson_id: activeLesson.id });
    if (error) { toast.error(isEn ? "An error occurred" : "حدث خطأ"); return; }
    const result = (rpcData ?? {}) as { progress?: number; completed_lessons?: string[] };
    const newCompleted = result.completed_lessons ?? [...completed, activeLesson.id];
    const newProgress = result.progress ?? Math.round((newCompleted.length / totalLessons) * 100);
    // Also bump lesson_progress.completion_count so the admin "تقدم الطلاب"
    // page reflects the completion (especially for cross-origin players
    // where duration is unknown and the 95% heuristic can't fire).
    try {
      const lessonId = activeLesson.id;
      completedFiredRef.current.add(lessonId);
      if (typeof window !== "undefined" && course?.id) {
        localStorage.removeItem(`learn:${course.id}:${lessonId}:pos`);
      }
      setLessonProgress((prev) => ({
        ...prev,
        [lessonId]: {
          last_position_seconds: 0,
          watched_seconds: prev[lessonId]?.watched_seconds ?? 0,
          completion_count: prev[lessonId]?.completion_count ?? 0,
        },
      }));
    } catch {}
    setEnrollment({ ...enrollment, completed_lessons: newCompleted, progress: newProgress });
    toast.success(isEn ? "Well done! Lesson marked as completed" : "أحسنت! تم احتساب الدرس");
    const idx = allLessons.findIndex((l) => l.id === activeLesson.id);
    if (idx >= 0 && idx < allLessons.length - 1) goToLesson(allLessons[idx + 1]);
  };

  const addProgressDebugEvent = (event: Omit<ProgressDebugEvent, "id" | "at" | "lessonTitle">) => {
    const item: ProgressDebugEvent = {
      ...event,
      id: ++progressDebugIdRef.current,
      at: new Date().toLocaleTimeString(isEn ? "en-GB" : "ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      lessonTitle: activeLessonRef.current?.title ?? activeLesson?.title ?? (isEn ? "Current Session" : "السيشن الحالية"),
    };
    if (event.type === "progress" || event.type === "complete" || event.type === "error") setLatestProgressDebug(item);
    setProgressDebugEvents((prev) => [item, ...prev].slice(0, 18));
  };

  const blockContext = (e: React.MouseEvent | React.SyntheticEvent) => { e.preventDefault(); };

  const materialUrl = async (path: string) => {
    const { data, error } = await supabase.storage.from("course-materials").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) throw new Error(error?.message ?? "Failed to sign url");
    return data.signedUrl;
  };

  const submitReview = async () => {
    if (!user || !course) return;
    const text = newComment.trim();
    if (text.length < 3) { toast.error(isEn ? "Write your review first (at least 3 characters)" : "اكتب رأيك أولاً (3 أحرف على الأقل)"); return; }
    if (text.length > 1000) { toast.error(isEn ? "Maximum 1000 characters" : "الحد الأقصى 1000 حرف"); return; }
    setSubmittingReview(true);
    const { data, error } = await supabase
      .from("reviews")
      .insert({ user_id: user.id, course_id: course.id, rating: newRating, comment: text })
      .select("id,rating,comment,is_approved,created_at")
      .maybeSingle();
    setSubmittingReview(false);
    if (error) { toast.error(isEn ? "Failed to submit review" : "تعذر إرسال المراجعة"); return; }
    setMyReview(data);
    setReviewChecked(true);
    setNewComment(""); setNewRating(5);
    setReviewDialogOpen(false);
    toast.success(isEn ? "Review submitted! You can now continue watching the course ❤️" : "تم إرسال رأيك بنجاح، شكراً لك! تم فتح متابعة باقي دروس الكورس ❤️");

    if (pendingTargetLessonRef.current) {
      const target = pendingTargetLessonRef.current;
      pendingTargetLessonRef.current = null;
      activeLessonRef.current = target;
      setActiveLesson(target);
      window.scrollTo({ top: 0, behavior: "smooth" });
      try {
        nav({
          search: ((prev: any) => ({ ...prev, lesson: target.id })) as never,
          replace: false,
        });
      } catch {}
    }
  };

  const startEditReview = () => {
    if (!myReview) return;
    setEditComment(myReview.comment ?? "");
    setEditRating(myReview.rating);
    setEditingReview(true);
  };

  const saveEditReview = async () => {
    if (!myReview) return;
    const text = editComment.trim();
    if (text.length < 3) { toast.error(isEn ? "Comment is too short" : "الكومنت قصير جداً"); return; }
    if (text.length > 1000) { toast.error(isEn ? "Maximum 1000 characters" : "الحد الأقصى 1000 حرف"); return; }
    const { data, error } = await supabase
      .from("reviews")
      .update({ comment: text, rating: editRating, is_approved: false })
      .eq("id", myReview.id)
      .select("id,rating,comment,is_approved,created_at")
      .maybeSingle();
    if (error) { toast.error(isEn ? "Failed to update review" : "تعذر التعديل"); return; }
    setMyReview(data);
    setEditingReview(false);
    toast.success(isEn ? "Updated, will appear after approval" : "تم التحديث، هيظهر بعد موافقة الإدارة");
  };

  const deleteMyReview = async () => {
    if (!myReview) return;
    if (!confirm(isEn ? "Are you sure you want to delete your review?" : "متأكد من حذف رأيك؟")) return;
    const { error } = await supabase.from("reviews").delete().eq("id", myReview.id);
    if (error) { toast.error(isEn ? "Failed to delete" : "تعذر الحذف"); return; }
    setMyReview(null);
    toast.success(isEn ? "Deleted" : "تم الحذف");
  };

  const renderCoursePlaylist = () => (
    <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] flex flex-col bg-[#1c1818] border border-[#2d2828] rounded-3xl p-4 md:p-5 shadow-2xl">
      {/* Playlist Header */}
      <div className="pb-3 border-b border-[#2d2828] space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-600/10 border border-red-600/20 flex items-center justify-center text-red-500">
              <ListVideo className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">{isEn ? "Course Playlist" : "قائمة دروس الكورس"}</h3>
              <p className="text-[11px] text-slate-400">{modules.length} {isEn ? "Modules" : "سيشن"} • {totalLessons} {isEn ? "Lessons" : "درس"}</p>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              if (openModules.length > 0) {
                setOpenModules([]);
              } else {
                setOpenModules(modules.map((m: any) => m.id));
              }
            }}
            className="text-xs text-slate-400 hover:text-white h-8 px-2 rounded-lg"
          >
            <ChevronsUpDown className="h-3.5 w-3.5 ml-1 text-red-500" />
            {openModules.length > 0 ? (isEn ? "Collapse All" : "طي الكل") : (isEn ? "Expand All" : "فتح الكل")}
          </Button>
        </div>

        {/* Progress summary inside playlist */}
        <div className="space-y-1.5 bg-[#221e1e] p-2.5 rounded-xl border border-[#2d2828]">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-300">{isEn ? "Your Progress" : "مستوى تقدمك"}</span>
            <span className="text-amber-400 font-bold">{completed.length}/{totalLessons} ({progress}%)</span>
          </div>
          <div className="w-full h-1.5 bg-[#141111] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-600 to-amber-400 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Playlist Scrollable Items */}
      <div className="lg:overflow-y-auto pr-1 space-y-3 flex-1 custom-scrollbar mt-3">
        <Accordion
          type="multiple"
          value={openModules}
          onValueChange={setOpenModules}
          className="space-y-2.5"
        >
          {modules.map((m, mIdx) => {
            const isCurrent = m.lessons.some((l: any) => activeLesson?.id === l.id);
            const completedInModule = m.lessons.filter((l: any) => completed.includes(l.id)).length;
            const isModuleComplete = m.lessons.length > 0 && completedInModule === m.lessons.length;

            return (
              <AccordionItem
                key={m.id}
                value={m.id}
                className={`rounded-2xl overflow-hidden border transition-all ${
                  isCurrent
                    ? "border-red-500/40 bg-[#221a1a]"
                    : "border-[#2d2828] bg-[#1c1818] hover:border-[#3d3636]"
                }`}
              >
                <AccordionTrigger
                  className={`px-3.5 py-3 hover:no-underline font-bold text-xs gap-2 transition-colors ${
                    isCurrent ? "bg-red-500/10 text-red-300" : "bg-[#221e1e]/60 text-slate-200 hover:bg-[#221e1e]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-[10px] font-black ${
                        isCurrent
                          ? "bg-red-600 text-white"
                          : isModuleComplete
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-[#2d2828] text-slate-400"
                      }`}>
                        {mIdx + 1}
                      </span>
                      <span className="truncate text-xs font-bold text-right">
                        {pick(m.title_en, m.title)}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                      {completedInModule}/{m.lessons.length}
                    </span>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="pb-1 pt-1 px-1.5 space-y-1">
                  {/* Matching Live Session inside this session */}
                  {(() => {
                    const liveSess = getModuleLiveSession(mIdx, m);
                    if (!liveSess) return null;
                    const att = attendance[liveSess.id];
                    const isAttended = att?.status === "present" || att?.watched_recording;
                    return (
                      <div className="mb-2 p-2.5 rounded-xl bg-gradient-to-r from-red-950/40 via-[#251818] to-[#1c1818] border border-red-500/30 shadow-md space-y-1.5 text-right">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-6 h-6 rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
                              <Video className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <h6 className="font-bold text-xs text-white truncate">
                                {pick(liveSess.title_en, liveSess.title)}
                              </h6>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                <Clock className="w-3 h-3 text-slate-500" />
                                <span>
                                  {new Date(liveSess.scheduled_at).toLocaleDateString(isEn ? "en-GB" : "ar-EG", { month: "short", day: "numeric" })}
                                </span>
                                {liveSess.duration_minutes && <span>• {liveSess.duration_minutes} دقيقة</span>}
                              </div>
                            </div>
                          </div>

                          {isAttended ? (
                            <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              {isEn ? "Attended" : "حاضر"}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded shrink-0">
                              {isEn ? "Live" : "مباشر"}
                            </span>
                          )}
                        </div>

                        {liveSess.meeting_url && (
                          <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#332525]">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleJoinMeeting(liveSess);
                              }}
                              className="w-full inline-flex items-center justify-center gap-1.5 text-xs bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold py-1.5 px-3 rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>{isEn ? "Join Live Meeting" : "دخول الميتنج المباشر"}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {m.lessons.map((l: any, lIdx: number) => {
                    const isActive = activeLesson?.id === l.id;
                    const done = completed.includes(l.id);
                    const blocked = !!l._blocked;
                    const lStats = getLessonViewStats(l.id);
                    const isGated = isLessonGatedByReview(l.id);

                    return (
                      <div
                        key={l.id}
                        role="button"
                        tabIndex={blocked ? -1 : 0}
                        onClick={() => {
                          if (!blocked) {
                            goToLesson({ ...l, moduleTitle: pick(m.title_en, m.title) });
                          }
                        }}
                        className={`group relative flex items-center justify-between gap-2.5 p-2.5 rounded-xl transition-all select-none text-right ${
                          blocked
                            ? "opacity-50 cursor-not-allowed bg-red-950/10 border border-red-500/10"
                            : isActive
                            ? "bg-[#2c1b1b] border-2 border-red-600 text-white shadow-md shadow-red-950/30 ring-1 ring-red-500/30"
                            : "bg-[#221e1e]/40 hover:bg-[#252020] border border-transparent hover:border-[#332b2b] text-slate-300 hover:text-white cursor-pointer active:scale-[0.98]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {blocked || lStats.isLocked ? (
                            <div className="w-7 h-7 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                              <Lock className="w-3.5 h-3.5" />
                            </div>
                          ) : isGated ? (
                            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0" title={isEn ? "Review needed to continue" : "يتطلب رأيك أولاً للاستكمال"}>
                              <Star className="w-3.5 h-3.5 fill-amber-400" />
                            </div>
                          ) : isActive ? (
                            <div className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-red-600/30 animate-pulse">
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </div>
                          ) : done ? (
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-[#252020] border border-[#332b2b] text-slate-400 group-hover:text-white flex items-center justify-center shrink-0 text-xs font-bold">
                              {lIdx + 1}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <h5 className={`text-xs font-bold leading-snug break-words ${isActive ? "text-white" : "text-slate-200"}`}>
                              {pick(l.title_en, l.title)}
                            </h5>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                              {l.duration && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5 text-slate-500" />
                                  {l.duration}
                                </span>
                              )}
                              {isActive && (
                                <span className="text-red-400 font-bold">{isEn ? "Playing" : "قيد التشغيل"}</span>
                              )}
                              {!isActive && done && (
                                <span className="text-emerald-400 font-bold">{isEn ? "Done" : "مكتمل"}</span>
                              )}
                              {!isActive && !done && isGated && (
                                <span className="text-amber-400 font-medium">{isEn ? "Review needed" : "يتطلب رأيك أولاً"}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {lStats.isLocked ? (
                          <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                            {isEn ? "Locked" : "مقفل"}
                          </span>
                        ) : isGated ? (
                          <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/25 flex items-center gap-1 font-semibold shrink-0">
                            <Star className="w-2.5 h-2.5 fill-amber-400" />
                            {isEn ? "Review" : "رأيك"}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );

  return (
    <SiteShell>
      <div className="min-h-screen bg-[#141111] text-slate-100">
        {/* Sticky top course navigation and progress bar */}
        <div className="container-page pt-4 pb-2">
          <div className="sticky top-2 z-40 bg-[#1c1818]/90 backdrop-blur-xl border border-[#2d2828] rounded-2xl p-3 md:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 shadow-xl">
            <div className="flex flex-col gap-2 w-full md:w-auto md:flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Link to="/dashboard" className="hover:text-red-400 transition-colors font-medium">
                  {isEn ? "Dashboard" : "لوحة التحكم"}
                </Link>
                <ChevronRight className={`h-3 w-3 ${dir === "rtl" ? "rotate-180" : ""} opacity-50`} />
                <span className="text-slate-300 font-semibold truncate">{pick(course?.title_en, course?.title)}</span>
                {activeLesson && (
                  <>
                    <ChevronRight className={`h-3 w-3 ${dir === "rtl" ? "rotate-180" : ""} opacity-50`} />
                    <span className="text-red-400 font-medium truncate max-w-[200px] sm:max-w-xs">{pick(activeLesson.title_en, activeLesson.title)}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3 w-full">
                <div className="flex-1 h-2 bg-[#252020] rounded-full overflow-hidden border border-[#332b2b]">
                  <div
                    className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-400 shadow-[0_0_12px_rgba(229,9,20,0.5)] transition-all duration-500 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-amber-400 whitespace-nowrap">
                  {isEn ? `Progress: ${progress}%` : `التقدم: ${progress}%`}
                </span>
              </div>
            </div>

            {isCompleted && (
              <button
                onClick={downloadCertificate}
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 active:scale-95 group cursor-pointer"
              >
                <Award className="h-5 w-5 text-slate-950 group-hover:scale-110 transition-transform" />
                {isEn ? "Download Certificate" : "شهادة إتمام الكورس"}
              </button>
            )}
          </div>
        </div>

        {/* 2-Column Cinema Theater Layout */}
        <div className="container-page py-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Main Stage (Player & Lesson Content - 8 Columns on Desktop) */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Watch Limits Notification Banner */}
              {activeLesson && activeViewStats && !activeViewStats.isLocked && maxViews > 0 && (
                <div className={`border rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md ${
                  activeViewStats.isResuming
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                }`}>
                  <div className="flex items-center gap-2.5 text-xs md:text-sm font-semibold">
                    <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
                      activeViewStats.isResuming
                        ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                        : "bg-amber-500/20 border-amber-500/30 text-amber-400"
                    }`}>
                      {activeViewStats.isResuming ? <Sparkles className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </div>
                    <div>
                      <span>
                        {isEn
                          ? `You have ${activeViewStats.viewsRemaining} of ${activeViewStats.maxViews} views remaining for this video`
                          : `متبقي لك ${activeViewStats.viewsRemaining} من أصل ${activeViewStats.maxViews} مشاهدات متاحة لهذا الفيديو`}
                      </span>
                      {activeViewStats.isResuming && (
                        <p className="text-[11px] text-emerald-400 mt-0.5">
                          {isEn
                            ? `Resuming playback from ${Math.floor(activeViewStats.savedPos / 60)}:${String(Math.floor(activeViewStats.savedPos % 60)).padStart(2, '0')} — no extra view deducted for continuing this session!`
                            : `استئناف المشاهدة من الدقيقة ${Math.floor(activeViewStats.savedPos / 60)}:${String(Math.floor(activeViewStats.savedPos % 60)).padStart(2, '0')} — لن يتم احتساب مشاهدة إضافية لأنك تستكمل نفس الجلسة!`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeViewStats.isResuming && (
                      <span className="text-[11px] text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 rounded-full font-bold">
                        {isEn ? "Resuming Session" : "استكمال الجلسة"}
                      </span>
                    )}
                    <span className="text-[11px] text-amber-400 bg-amber-500/20 border border-amber-500/40 px-3 py-1 rounded-full font-bold">
                      {activeViewStats.viewsUsed} {isEn ? "used" : "مستخدمة"}
                    </span>
                  </div>
                </div>
              )}

              {/* Desktop App Security & Encrypted Offline Vault Bar */}
              {desktopBridge && activeLesson && (
                <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-950/35 via-[#1c1818] to-[#1c1818] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-emerald-300">
                    <Shield className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>تطبيق الديسكتوب المحمي نشط • بصمة الجهاز: <code className="text-amber-300 font-mono">{desktopBridge.getDeviceInfo()?.shortCode}</code></span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {vaultVideoUrl ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/35 px-3 py-1.5 rounded-xl">
                        <CheckCircle2 className="h-3.5 w-3.5 text-amber-400" />
                        يعمل من الخزنة الأوفلاين المشفّرة
                      </span>
                    ) : isDirectDownloadableVideoUrl(remoteVideoUrl) ? (
                      <button
                        type="button"
                        disabled={vaultDlPercent !== null}
                        onClick={handleDownloadOffline}
                        className="inline-flex items-center gap-1.5 text-xs font-bold bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white px-3.5 py-1.5 rounded-xl transition-all cursor-pointer"
                      >
                        {vaultDlPercent !== null ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>جاري التشفير والحفظ ({vaultDlPercent}%)</span>
                          </>
                        ) : (
                          <>
                            <Download className="h-3.5 w-3.5" />
                            <span>تحميل الدرس أوفلاين (مشفّر للجهاز)</span>
                          </>
                        )}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => desktopBridge.openOfflineVaultDrawer()}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                    >
                      <span>مكتبة الأوفلاين</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Cinema Theater Frame */}
              <div className="rounded-3xl overflow-hidden bg-black border border-[#2d2828] shadow-[0_12px_45px_rgba(0,0,0,0.85)] relative group">
                <div className={`relative ${isReviewRequiredForActiveLesson || isBlockedByDesktopOnly ? "min-h-[460px] py-6 px-4" : "aspect-video"} bg-black flex items-center justify-center select-none`} onContextMenu={blockContext}>
                  {isBlockedByDesktopOnly ? (
                    <div className="text-center p-6 md:p-10 max-w-lg mx-auto select-auto" onContextMenu={(e) => e.stopPropagation()}>
                      <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/35 flex items-center justify-center mx-auto mb-4 text-red-400">
                        <Shield className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg md:text-xl font-bold text-white mb-2">
                        {isEn ? "Desktop App Required for Protected Playback" : "مشاهدة الدروس متاحة عبر تطبيق الديسكتوب الرسمي فقط"}
                      </h3>
                      <p className="text-xs md:text-sm text-slate-300 mb-6 leading-relaxed">
                        {isEn
                          ? "To protect course intellectual property, video playback is enabled exclusively inside the official Idea Courses — Eng. Ehab El-Galaly Desktop Application."
                          : "حرصاً على حماية محتوى الكورس، تعمل الفيديوهات حصرياً من خلال تطبيق الديسكتوب الرسمي المحمي لمنصة Idea Courses — م. إيهاب الجلالي."}
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-3">
                        <a
                          href={getDesktopExeDownloadUrl()}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-all shadow-lg shadow-red-900/40 cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          <span>{isEn ? "Download Windows App (.exe)" : "تحميل تطبيق Windows (.exe)"}</span>
                        </a>
                        <a
                          href={getMobileApkDownloadUrl()}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-900/40 cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          <span>{isEn ? "Download Android App (.apk)" : "تحميل تطبيق الموبايل (.apk)"}</span>
                        </a>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setAdminBypassDesktopOnly(true)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-semibold text-xs border border-white/20 transition-all cursor-pointer"
                          >
                            <Unlock className="w-4 h-4 text-amber-400" />
                            <span>تجاوز كأدمن (معاينة بالمتصفح)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : activeViewStats?.isLocked ? (
                    <div className="text-center p-6 md:p-12 max-w-lg mx-auto select-auto" onContextMenu={(e) => e.stopPropagation()}>
                      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4 text-red-400 shadow-inner">
                        <Lock className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg md:text-xl font-bold text-white mb-2">
                        {isEn ? "Watch limit reached for this video" : "استنفدت عدد المشاهدات المتاحة لهذا الفيديو"}
                      </h3>
                      <p className="text-xs md:text-sm text-slate-300 mb-6 leading-relaxed">
                        {isEn
                          ? `You have watched this lesson ${activeViewStats.maxViews} times (the maximum allowed). If you need an additional watch session to review the content, please contact support.`
                          : `لقد شاهدت هذا الدرس ${activeViewStats.maxViews} مرات وهو الحد الأقصى المسموح به. إذا كنت بحاجة لمشاهدة إضافية لمراجعة الدرس، يرجى التواصل مع إدارة المنصة.`}
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-3">
                        <a
                          href="https://wa.me/201026533835"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold text-sm transition-all shadow-lg shadow-green-900/30 active:scale-95 cursor-pointer"
                        >
                          <MessageCircle className="w-4 h-4" />
                          {isEn ? "Contact Support on WhatsApp" : "تواصل مع الإدارة عبر واتساب"}
                        </a>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setAdminBypassLock(true)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white font-semibold text-xs border border-white/20 transition-all cursor-pointer"
                          >
                            <Unlock className="w-4 h-4 text-amber-400" />
                            <span>تجاوز القفل كأدمن (معاينة)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : isReviewRequiredForActiveLesson ? (
                    <div className="w-full max-w-lg mx-auto select-auto" onContextMenu={(e) => e.stopPropagation()}>
                      <CourseReviewPromptCard
                        badgeText={isEn ? "Course review required to continue" : "عشان تكمل الكورس لازم تقول رأيك في الكورس ⭐"}
                        title={isEn ? "Your Course Review" : "رأيك في الكورس"}
                        subtitle={isEn ? "Your review will be checked before being published publicly" : "سيتم مراجعة رأيك قبل النشر للعامة"}
                        rating={newRating}
                        setRating={setNewRating}
                        comment={newComment}
                        setComment={setNewComment}
                        submitting={submittingReview}
                        onSubmit={submitReview}
                        isEn={isEn}
                      />
                    </div>
                  ) : videoUrl ? (
                    <SecurePlayer
                      key={`${activeLesson.id}-${videoUrl}`}
                      url={videoUrl}
                      title={pick(activeLesson.title_en, activeLesson.title)}
                      onEnded={markComplete}
                      watermark={`${profile?.name || user?.email || "Student"}${profile?.phone ? ` • ${profile.phone}` : ""}${nativeHwShort ? ` • HW:${nativeHwShort}` : ""}`}
                      startAt={initialLessonPos}
                      onPlaybackEvent={({ type, position, duration, source, note }) => {
                        const expected = parseLessonDuration(activeLessonRef.current?.duration ?? activeLesson.duration);
                        const effectiveDur = duration > 0 ? duration : expected;
                        const threshold = duration > 0 ? 0.80 : 0.50;
                        addProgressDebugEvent({
                          type,
                          source,
                          position,
                          duration,
                          expected,
                          ratio: effectiveDur > 0 ? position / effectiveDur : 0,
                          threshold,
                          completed: type === "complete",
                          note,
                        });
                      }}
                      onProgress={async ({ position, duration, deltaWatched, source, isPlaying }) => {
                        try {
                          const lessonId = activeLessonRef.current?.id ?? activeLesson.id;
                          const expectedSec = parseLessonDuration(activeLessonRef.current?.duration ?? activeLesson.duration);
                          const effectiveDur = duration > 0 ? duration : expectedSec;

                          // Deduct view when 10 seconds of playback pass in this session
                          if (deltaWatched > 0) {
                            sessionWatchedSecondsRef.current += deltaWatched;
                          } else if (isPlaying !== false) {
                            sessionWatchedSecondsRef.current += 2.5;
                          }

                          const currentSessionWatch = sessionWatchedSecondsRef.current;
                          const isTenSecondsPassed = currentSessionWatch >= 10 || (position >= 10 && currentSessionWatch >= 4);

                          if (isTenSecondsPassed && sessionDeductedLessonIdRef.current !== lessonId && user && course) {
                            sessionDeductedLessonIdRef.current = lessonId;

                            void (async () => {
                              try {
                                const res = await deductLessonViewFn({
                                  data: { lessonId, userId: user.id, courseId: course.id },
                                });
                                const updatedViewsUsed = res?.ok && typeof res.viewsUsed === "number"
                                  ? res.viewsUsed
                                  : ((lessonProgress[lessonId]?.completion_count ?? 0) + 1);

                                setLessonProgress((prev) => ({
                                  ...prev,
                                  [lessonId]: {
                                    ...(prev[lessonId] || { last_position_seconds: 0, watched_seconds: 0 }),
                                    completion_count: updatedViewsUsed,
                                  },
                                }));

                                const remaining = maxViews > 0 ? Math.max(0, maxViews - updatedViewsUsed) : null;

                                if (remaining !== null) {
                                  if (remaining === 0) {
                                    toast.error(
                                      isEn
                                        ? "🚨 Final Watch Alert: This is your LAST remaining view for this session! Please complete it to the end and do not exit."
                                        : "🚨 تحذير هام: تم احتساب آخر مشاهدة متبقية لك في هذه السيشن! يرجى تكملتها للنهاية وعدم الخروج منها.",
                                      {
                                        duration: 10000,
                                        description: isEn
                                          ? "If you close or exit this session now, you will not be able to open it again."
                                          : "إذا خرجت من السيشن أو أغلقت الصفحة الآن فسيتم قفلها ولن تتمكن من فتحها مجدداً.",
                                      }
                                    );
                                  } else if (remaining === 1) {
                                    toast.warning(
                                      isEn
                                        ? "⚠️ Watch counted! Only 1 view remaining for this session."
                                        : "⚠️ تم احتساب مشاهدة! متبقي لك مشاهدة واحدة فقط لهذه السيشن.",
                                      {
                                        duration: 8500,
                                        description: isEn
                                          ? "Note: You can pause and resume without extra deductions, but this is your last available watch."
                                          : "ملاحظة: يمكنك إيقاف الفيديو والعودة لاستكماله لاحقاً دون خصم مشاهدة أخرى، لكن هذه آخر مشاهدة متاحة لك.",
                                      }
                                    );
                                  } else {
                                    toast.warning(
                                      isEn
                                        ? `👀 Watch counted! (${remaining} views remaining).`
                                        : `👀 تم احتساب مشاهدة! (متبقي لك ${remaining} مشاهدات).`,
                                      {
                                        duration: 8000,
                                        description: isEn
                                          ? "You can pause and resume anytime without extra deductions — your playback position is saved."
                                          : "يمكنك الخروج واستكمال المشاهدة لاحقاً دون خصم مشاهدة إضافية، حيث يتم حفظ مكان وقوفك تلقائياً.",
                                      }
                                    );
                                  }
                                } else {
                                  toast.info(
                                    isEn
                                      ? "Session watch started. Please complete the session and do not exit."
                                      : "تم بدء احتساب السيشن. يرجى تكملتها وعدم الخروج منها.",
                                    { duration: 6000 }
                                  );
                                }
                              } catch (err) {
                                console.error("Failed to deduct view:", err);
                              }
                            })();
                          }

                          let completed = false;
                          const ratio = effectiveDur > 0 ? position / effectiveDur : 0;
                          const threshold = 0.50;
                          const alreadyCompleted = (enrollment?.completed_lessons ?? []).includes(lessonId);
                          if (alreadyCompleted) completedFiredRef.current.add(lessonId);
                          if (effectiveDur > 0 && ratio >= threshold && !alreadyCompleted) {
                            if (!completedFiredRef.current.has(lessonId)) {
                              completedFiredRef.current.add(lessonId);
                              completed = true;
                            }
                          } else if (effectiveDur > 0 && ratio < 0.3) {
                            completedFiredRef.current.delete(lessonId);
                          }
                          if (typeof window !== "undefined" && course?.id && lessonId && position > 0) {
                            try {
                              localStorage.setItem(`learn:${course.id}:${lessonId}:pos`, String(Math.floor(position)));
                            } catch {}
                          }
                          await supabase.rpc("upsert_lesson_progress", {
                            _lesson_id: lessonId,
                            _position: Math.floor(position),
                            _duration: duration ? Math.floor(duration) : 0,
                            _delta_watched: Math.floor(deltaWatched ?? 0),
                            _completed: false,
                          });
                          addProgressDebugEvent({
                            type: completed ? "complete" : "progress",
                            source: source ?? (duration > 0 ? "known-duration-player" : "iframe-heartbeat-fallback"),
                            position,
                            duration,
                            expected: expectedSec,
                            ratio,
                            threshold,
                            completed,
                            note: effectiveDur > 0
                              ? `watched +${Math.floor(deltaWatched ?? 0)}s`
                              : (isEn ? "Session duration unknown" : "مدة السيشن غير مقروءة وغير مكتوبة في بيانات الدرس"),
                          });
                          if (completed) {
                            try {
                              const { data: rpcData, error: completeError } = await supabase.rpc("mark_lesson_complete", { _lesson_id: lessonId });
                              if (completeError) throw completeError;
                              const result = (rpcData ?? {}) as { progress?: number; completed_lessons?: string[] };
                              setEnrollment((prev: any) => {
                                if (!prev) return prev;
                                const prevCompleted: string[] = prev.completed_lessons ?? [];
                                const newCompleted = result.completed_lessons ?? (prevCompleted.includes(lessonId) ? prevCompleted : [...prevCompleted, lessonId]);
                                const newProgress = result.progress ?? (totalLessons > 0 ? Math.round((newCompleted.length / totalLessons) * 100) : prev.progress);
                                return { ...prev, completed_lessons: newCompleted, progress: newProgress };
                              });
                            } catch (completeError: any) {
                              addProgressDebugEvent({
                                type: "error",
                                source: source ?? "auto-complete",
                                position,
                                duration,
                                expected: expectedSec,
                                ratio,
                                threshold,
                                completed: false,
                                note: completeError?.message ?? (isEn ? "Failed to save completion" : "تعذر حفظ الإكمال"),
                              });
                            }
                          }
                        } catch (progressError: any) {
                          addProgressDebugEvent({
                            type: "error",
                            source: source ?? "progress-save",
                            position,
                            duration,
                            expected: parseLessonDuration(activeLessonRef.current?.duration ?? activeLesson.duration),
                            ratio: 0,
                            threshold: duration > 0 ? 0.80 : 0.50,
                            completed: false,
                            note: progressError?.message ?? (isEn ? "Failed to save progress" : "تعذر حفظ التقدم"),
                          });
                        }
                      }}
                    />
                  ) : (
                    <div className="text-slate-400 text-center p-8">
                      <PlayCircle className="h-14 w-14 mx-auto mb-2 opacity-40 text-red-500" />
                      <p className="text-sm font-medium">{isEn ? "No video has been uploaded for this lesson yet" : "لم يتم رفع فيديو لهذا الدرس بعد"}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Cinema Quick Controls (Previous, Complete Status, Next) */}
              {activeLesson && (
                <div className="bg-[#1c1818] border border-[#2d2828] rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-2 sm:gap-4 shadow-lg">
                  {/* Previous Lesson Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!prevLesson}
                    onClick={() => prevLesson && goToLesson(prevLesson)}
                    className="border-[#332b2b] bg-[#221e1e] hover:bg-[#2c2626] text-slate-200 hover:text-white rounded-xl h-10 px-3 sm:px-4 text-xs font-bold gap-1.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {dir === "rtl" ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    <span>{isEn ? "Previous Lesson" : "الدرس السابق"}</span>
                  </Button>

                  {/* Mark as Complete Status / Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isReviewRequiredForActiveLesson) {
                        setReviewDialogOpen(true);
                        return;
                      }
                      markComplete();
                    }}
                    disabled={completed.includes(activeLesson.id)}
                    className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                      completed.includes(activeLesson.id)
                        ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 cursor-default"
                        : isReviewRequiredForActiveLesson
                        ? "bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 active:scale-95 cursor-pointer shadow-lg shadow-amber-500/10"
                        : "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-600/30 active:scale-95 cursor-pointer"
                    }`}
                  >
                    <CheckCircle2 className={`w-4 h-4 ${completed.includes(activeLesson.id) ? "text-emerald-400" : isReviewRequiredForActiveLesson ? "text-amber-400" : "text-white"}`} />
                    <span>
                      {completed.includes(activeLesson.id)
                        ? (isEn ? "Lesson Completed ✓" : "تم إكمال الدرس ✓")
                        : isReviewRequiredForActiveLesson
                        ? (isEn ? "Review Required ⭐" : "عشان تكمل الكورس لازم تقول رأيك ⭐")
                        : (isEn ? "Mark as Completed" : "تحديد كدرس مكتمل")}
                    </span>
                  </button>

                  {/* Next Lesson Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!nextLesson}
                    onClick={() => nextLesson && goToLesson(nextLesson)}
                    className="border-[#332b2b] bg-[#221e1e] hover:bg-[#2c2626] text-slate-200 hover:text-white rounded-xl h-10 px-3 sm:px-4 text-xs font-bold gap-1.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <span>{isEn ? "Next Lesson" : "الدرس التالي"}</span>
                    {dir === "rtl" ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </Button>
                </div>
              )}

              {/* Active Lesson Header & Details Card */}
              {activeLesson && (
                <div className="bg-[#1c1818] border border-[#2d2828] rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full">
                        {activeLesson.moduleTitle}
                      </span>
                      {activeLesson.duration && (
                        <span className="text-xs text-slate-400 flex items-center gap-1.5 bg-[#252020] border border-[#332b2b] px-2.5 py-1 rounded-full">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          {activeLesson.duration}
                        </span>
                      )}
                      {activeViewStats && maxViews > 0 && (
                        <span className={`text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                          activeViewStats.isLocked
                            ? "bg-red-500/10 text-red-400 border-red-500/30"
                            : "bg-[#252020] text-amber-300 border-amber-500/30"
                        }`}>
                          <Eye className="w-3.5 h-3.5 text-amber-400" />
                          {isEn ? `${activeViewStats.viewsRemaining} views left` : `متبقي ${activeViewStats.viewsRemaining} مشاهدات`}
                        </span>
                      )}
                    </div>

                    {completed.includes(activeLesson.id) && (
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isEn ? "Completed" : "مكتمل"}
                      </span>
                    )}
                  </div>

                  <h1 className="text-xl md:text-2xl font-black text-white leading-tight">
                    {pick(activeLesson.title_en, activeLesson.title)}
                  </h1>

                  {activeLesson.content && (
                    <div className="pt-2 border-t border-[#2d2828]">
                      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                        {pick(activeLesson.content_en, activeLesson.content)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Mobile Only: Course Playlist first under active lesson */}
              <div className="block lg:hidden">
                {renderCoursePlaylist()}
              </div>

              {/* Quick Attachments & Materials for Active Module */}
              {activeModuleResources.length > 0 && (
                <div className="bg-[#1c1818] border border-[#2d2828] rounded-2xl p-5 shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                        <FileText className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-bold text-white">
                        {isEn ? "Session Materials & Downloads" : "مرفقات وتحميلات السيشن"}
                      </h3>
                    </div>
                    <span className="text-xs text-slate-400 bg-[#252020] border border-[#332b2b] px-2.5 py-0.5 rounded-full font-bold">
                      {activeModuleResources.length}
                    </span>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {activeModuleResources.map((r: any) => {
                      const meta = parseResourceMetadata(r.notes);
                      return (
                        <div key={r.id} className="bg-[#221e1e] hover:bg-[#292424] rounded-xl p-3 border border-[#332b2b] hover:border-red-500/40 transition-all flex flex-col justify-between gap-2.5">
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center shrink-0 mt-0.5">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-xs text-white line-clamp-1">{pick(r.title_en, r.title)}</h4>
                              {meta.notes && <p className="text-slate-400 text-[11px] mt-0.5 line-clamp-2">{meta.notes}</p>}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 pt-1 border-t border-[#332b2b]">
                            {r.file_path && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    setViewerName(r.file_name ?? r.title ?? (isEn ? "File" : "ملف"));
                                    setViewerTitle(r.title ?? r.file_name ?? (isEn ? "File Preview" : "معاينة الملف"));
                                    setViewerAllowDownload(meta.allowDownload);
                                    setViewerUrl(null);
                                    setViewerOpen(true);
                                    const url = await materialUrl(r.file_path);
                                    setViewerUrl(url);
                                  } catch {
                                    toast.error(isEn ? "Failed to open file" : "تعذر فتح الملف");
                                    setViewerOpen(false);
                                  }
                                }}
                                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all cursor-pointer ${
                                  meta.viewOnly
                                    ? "bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                                    : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                                }`}
                              >
                                {meta.viewOnly ? <Shield className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                                <span>{meta.viewOnly ? (isEn ? "Secure Preview" : "معاينة آمنة") : (isEn ? "Download" : "تحميل")}</span>
                              </button>
                            )}
                            {r.url && (
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 text-[11px] font-bold shadow-sm transition-all active:scale-95"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                <span>{isEn ? "Open Link" : "فتح الرابط"}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Student Tasks Panel */}
              {course && activeLesson && (
                <StudentTasksPanel courseId={course.id} lessonId={activeLesson.id} />
              )}

              {/* Additional Tabs (Course Review, Live Sessions, All Materials) */}
              {course && (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="w-full grid grid-cols-2 sm:grid-cols-3 bg-[#1c1818] border border-[#2d2828] rounded-2xl p-1 h-auto">
                    <TabsTrigger value="review" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-600 data-[state=active]:to-rose-600 data-[state=active]:text-white rounded-xl text-slate-300 font-bold py-2.5 gap-1.5">
                      <Star className="h-4 w-4" /> {isEn ? "Course Review" : "رأيك في الكورس"}
                    </TabsTrigger>
                    <TabsTrigger value="sessions" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-600 data-[state=active]:to-rose-600 data-[state=active]:text-white rounded-xl text-slate-300 font-bold py-2.5 gap-1.5">
                      <Calendar className="h-4 w-4" /> {isEn ? "Live Sessions" : "الجلسات المباشرة"} {sessions.length > 0 && <span className="text-[10px] opacity-80">({sessions.length})</span>}
                    </TabsTrigger>
                    <TabsTrigger value="materials" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-600 data-[state=active]:to-rose-600 data-[state=active]:text-white rounded-xl text-slate-300 font-bold py-2.5 gap-1.5 col-span-2 sm:col-span-1">
                      <FileText className="h-4 w-4" /> {isEn ? "All Materials" : "جميع المرفقات"}
                    </TabsTrigger>
                  </TabsList>

                  {/* Review Tab */}
                  <TabsContent value="review" className="mt-4">
                    <div id="review-panel" className="bg-[#1c1818] border border-[#2d2828] rounded-2xl p-6 space-y-4">
                      {!myReview ? (
                        <CourseReviewPromptCard
                          title={isEn ? "Your Course Review" : "رأيك في الكورس"}
                          subtitle={isEn ? "Your review will be checked before being published publicly" : "سيتم مراجعة رأيك قبل النشر للعامة"}
                          rating={newRating}
                          setRating={setNewRating}
                          comment={newComment}
                          setComment={setNewComment}
                          submitting={submittingReview}
                          onSubmit={submitReview}
                          isEn={isEn}
                          className="p-0 border-0 bg-transparent shadow-none"
                        />
                      ) : (
                        <div className="flex items-center gap-3 pb-3 border-b border-[#2d2828]">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                            <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
                          </div>
                          <div>
                            <h3 className="font-bold text-white">{isEn ? "Your Course Review" : "رأيك في الكورس"}</h3>
                            <p className="text-xs text-slate-400">{isEn ? "Your review will be checked before being published publicly" : "سيتم مراجعة رأيك قبل النشر للعامة"}</p>
                          </div>
                        </div>
                      )}

                      {myReview && !editingReview && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex gap-1 text-amber-400">
                              {Array.from({ length: myReview.rating }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
                            </div>
                            <div className="flex items-center gap-2">
                              {!myReview.is_approved && (
                                <span className="text-[10px] bg-[#252020] text-slate-300 border border-[#332b2b] px-2 py-0.5 rounded">{isEn ? "Under Review" : "قيد المراجعة"}</span>
                              )}
                              {myReview.is_approved && (
                                <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded">{isEn ? "Published" : "منشور"}</span>
                              )}
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-white" onClick={startEditReview} aria-label={isEn ? "Edit" : "تعديل"}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={deleteMyReview} aria-label={isEn ? "Delete" : "حذف"}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm whitespace-pre-line text-slate-200">{myReview.comment}</p>
                        </div>
                      )}

                      {myReview && editingReview && (
                        <>
                          <LearnStarPicker value={editRating} onChange={setEditRating} />
                          <Textarea
                            value={editComment}
                            onChange={(e) => setEditComment(e.target.value)}
                            className="mt-3 bg-[#141111] border-[#2d2828] text-slate-200 focus-visible:ring-red-500/20 focus-visible:border-red-500 rounded-xl"
                            maxLength={1000}
                          />
                          <div className="flex justify-end gap-2 mt-3">
                            <Button size="sm" variant="ghost" onClick={() => setEditingReview(false)}>
                              <X className="h-4 w-4 ml-1" /> {isEn ? "Cancel" : "إلغاء"}
                            </Button>
                            <Button size="sm" onClick={saveEditReview} className="bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl">
                              <Check className="h-4 w-4 ml-1" /> {isEn ? "Save" : "حفظ"}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </TabsContent>

                  {/* Sessions Tab */}
                  <TabsContent value="sessions" className="mt-4">
                    {eligibility && eligibility.total_sessions > 0 && (
                      <div className="mb-3 bg-[#1c1818] border border-[#2d2828] rounded-2xl p-4 flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-bold text-slate-100">
                          {isEn ? "Your attendance" : "نسبة حضورك"}
                        </span>
                        <span className={`text-sm font-extrabold ${eligibility.eligible ? "text-emerald-400" : "text-amber-400"}`}>
                          {eligibility.rate}% ({eligibility.attended_sessions}/{eligibility.total_sessions})
                        </span>
                        {eligibility.required_percent > 0 && (
                          <span className="text-xs text-slate-400">
                            {isEn ? `Required for certificate: ${eligibility.required_percent}%` : `المطلوب للشهادة: ${eligibility.required_percent}%`}
                          </span>
                        )}
                        {eligibility.blocked && (
                          <span className="text-[11px] px-2 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/30">
                            {isEn ? "Certificate on hold" : "الشهادة موقوفة من الإدارة"}
                          </span>
                        )}
                      </div>
                    )}

                    {sessions.length === 0 ? (
                      <div className="bg-[#1c1818] border border-[#2d2828] rounded-2xl p-8 text-center text-sm text-slate-400">
                        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40 text-red-500" />
                        {isEn ? "No live sessions scheduled at the moment." : "لا توجد جلسات مباشرة مجدولة حالياً."}
                      </div>
                    ) : (
                      <div className="bg-[#1c1818] border border-[#2d2828] rounded-2xl overflow-hidden">
                        <div className="divide-y divide-[#2d2828]">
                          {sessions.map((s) => {
                            const when = new Date(s.scheduled_at);
                            const isPast = when.getTime() < Date.now();
                            const niceDate = when.toLocaleString(isEn ? "en-GB" : "ar-EG", { dateStyle: "full", timeStyle: "short" });
                            const att = attendance[s.id];
                            const attStatus: string | null = isPast
                              ? (att?.watched_recording && att?.status === "absent" ? "recording" : att?.status ?? "absent")
                              : null;
                            const ATT_UI: Record<string, { label: string; labelEn: string; cls: string }> = {
                              present: { label: "حاضر", labelEn: "Present", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
                              late: { label: "متأخر", labelEn: "Late", cls: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
                              absent: { label: "غائب", labelEn: "Absent", cls: "bg-red-500/10 text-red-400 border-red-500/30" },
                              excused: { label: "بعذر", labelEn: "Excused", cls: "bg-sky-500/10 text-sky-400 border-sky-500/30" },
                              recording: { label: "شاهد التسجيل", labelEn: "Watched recording", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
                            };
                            const attUi = attStatus ? ATT_UI[attStatus] : null;
                            return (
                              <div key={s.id} className="p-4 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-bold flex-1 text-slate-100">{pick(s.title_en, s.title)}</h4>
                                  {attUi && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded border ${attUi.cls}`}>
                                      {isEn ? attUi.labelEn : attUi.label}
                                    </span>
                                  )}
                                  {isPast ? (
                                    <span className="text-[10px] bg-[#252020] text-slate-300 border border-[#332b2b] px-2 py-0.5 rounded">{isEn ? "Ended" : "منتهية"}</span>
                                  ) : (
                                    <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded">{isEn ? "Upcoming" : "قادمة"}</span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-400 flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" /> {niceDate} • {s.duration_minutes ?? 60} {isEn ? "mins" : "دقيقة"}
                                </div>
                                {s.description && <p className="text-sm whitespace-pre-line text-slate-300">{pick(s.description_en, s.description)}</p>}
                                {s.meeting_url && (
                                  <div className="flex items-center gap-2 flex-wrap pt-1">
                                    <button
                                      type="button"
                                      onClick={() => handleJoinMeeting(s)}
                                      className="inline-flex items-center gap-1.5 text-sm bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold px-4 py-2 rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
                                    >
                                      <Video className="h-4 w-4" /> {isEn ? "Join Meeting" : "دخول الميتنج"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* All Materials Tab */}
                  <TabsContent value="materials" className="mt-4 space-y-4">
                    {modules.map((m) => {
                      const mRes = resources[m.id] ?? [];
                      if (mRes.length === 0) return null;
                      return (
                        <div key={m.id} className="bg-[#1c1818] border border-[#2d2828] rounded-2xl p-4 space-y-3">
                          <h4 className="font-bold text-sm text-white flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center text-xs">
                              {modules.findIndex((x) => x.id === m.id) + 1}
                            </span>
                            {pick(m.title_en, m.title)}
                          </h4>
                          <div className="grid gap-2.5 sm:grid-cols-2">
                            {mRes.map((r: any) => {
                              const meta = parseResourceMetadata(r.notes);
                              return (
                                <div key={r.id} className="bg-[#221e1e] rounded-xl p-3 border border-[#332b2b] flex items-center justify-between gap-3 text-xs">
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <FileText className="w-4 h-4 text-red-400 shrink-0" />
                                    <span className="font-bold text-slate-100 truncate">{pick(r.title_en, r.title)}</span>
                                  </div>
                                  {r.file_path && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          setViewerName(r.file_name ?? r.title ?? (isEn ? "File" : "ملف"));
                                          setViewerTitle(r.title ?? r.file_name ?? (isEn ? "File Preview" : "معاينة الملف"));
                                          setViewerAllowDownload(meta.allowDownload);
                                          setViewerUrl(null);
                                          setViewerOpen(true);
                                          const url = await materialUrl(r.file_path);
                                          setViewerUrl(url);
                                        } catch {
                                          toast.error(isEn ? "Failed to open file" : "تعذر فتح الملف");
                                          setViewerOpen(false);
                                        }
                                      }}
                                      className="px-3 py-1.5 rounded-lg bg-red-600/10 border border-red-500/30 text-red-400 hover:bg-red-600/20 font-bold transition-all shrink-0 cursor-pointer"
                                    >
                                      {isEn ? "View" : "معاينة"}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </TabsContent>
                </Tabs>
              )}


            </div>

            {/* Sidebar Course Playlist (4 Columns on Desktop, Sticky) */}
            <div className="hidden lg:block lg:col-span-4">
              {renderCoursePlaylist()}
            </div>

          </div>
        </div>
      </div>

      <SecureFileViewer
        open={viewerOpen}
        onOpenChange={(o) => { setViewerOpen(o); if (!o) setViewerUrl(null); }}
        signedUrl={viewerUrl}
        fileName={viewerName}
        title={viewerTitle}
        watermark={[profile?.name, user?.email].filter(Boolean).join(" • ")}
        allowDownload={viewerAllowDownload}
      />

      {/* Centered review dialog — opened when student attempts to continue to lesson 2+ without reviewing */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-[#1c1818] border-[#2d2828] text-white p-6 rounded-2xl" dir={dir}>
          <DialogHeader className="sr-only">
            <DialogTitle>{isEn ? "Your Course Review" : "رأيك في الكورس"}</DialogTitle>
            <DialogDescription>{isEn ? "Please share your review to continue" : "يرجى كتابة رأيك لمتابعة الكورس"}</DialogDescription>
          </DialogHeader>

          <CourseReviewPromptCard
            badgeText={isEn ? "Course review required to continue" : "عشان تكمل الكورس لازم تقول رأيك في الكورس ⭐"}
            title={isEn ? "Your Course Review" : "رأيك في الكورس"}
            subtitle={isEn ? "Your review will be checked before being published publicly" : "سيتم مراجعة رأيك قبل النشر للعامة"}
            rating={newRating}
            setRating={setNewRating}
            comment={newComment}
            setComment={setNewComment}
            submitting={submittingReview}
            onSubmit={submitReview}
            isEn={isEn}
            className="p-0 border-0 bg-transparent shadow-none"
          />
        </DialogContent>
      </Dialog>
    </SiteShell>
  );
}

function LearnStarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { isEn } = useI18n();
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={isEn ? "Rating" : "التقييم"}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={isEn ? `${n} stars` : `${n} نجوم`}
          className="p-1 transition-transform hover:scale-110 cursor-pointer"
        >
          <Star className={`h-6 w-6 ${n <= value ? "fill-amber-400 text-amber-400" : "text-slate-600"}`} />
        </button>
      ))}
    </div>
  );
}

interface CourseReviewPromptCardProps {
  badgeText?: string;
  title?: string;
  subtitle?: string;
  rating: number;
  setRating: (v: number) => void;
  comment: string;
  setComment: (v: string) => void;
  submitting: boolean;
  onSubmit: () => void;
  isEn: boolean;
  className?: string;
}

function CourseReviewPromptCard({
  badgeText,
  title,
  subtitle,
  rating,
  setRating,
  comment,
  setComment,
  submitting,
  onSubmit,
  isEn,
  className = "",
}: CourseReviewPromptCardProps) {
  return (
    <div className={`bg-[#1c1818] border border-[#2d2828] rounded-2xl p-5 md:p-6 space-y-4 shadow-2xl text-right ${className}`}>
      {badgeText && (
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs sm:text-sm font-bold shadow-sm">
            <Star className="w-4 h-4 fill-amber-400 shrink-0" />
            <span>{badgeText}</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
          <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
        </div>
        <div className="text-right flex-1 min-w-0">
          <h3 className="font-bold text-white text-base">
            {title || (isEn ? "Your Course Review" : "رأيك في الكورس")}
          </h3>
          <p className="text-xs text-slate-400">
            {subtitle || (isEn ? "Your review will be checked before being published publicly" : "سيتم مراجعة رأيك قبل النشر للعامة")}
          </p>
        </div>
      </div>

      <div className="flex justify-start pt-1">
        <LearnStarPicker value={rating} onChange={setRating} />
      </div>

      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={isEn ? "Write your detailed review..." : "...اكتب رأيك بالتفصيل"}
        maxLength={1000}
        rows={4}
        className="bg-[#141111] border-[#2d2828] text-slate-100 placeholder:text-slate-500 rounded-xl resize-none focus-visible:ring-red-500/20 focus-visible:border-red-500 text-sm leading-relaxed"
        dir="rtl"
      />

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-xs text-slate-500 font-medium">
          {comment.length} / 1000 {isEn ? "chars" : "حرف"}
        </span>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || comment.trim().length < 3}
          className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 px-7 rounded-xl transition-all shadow-lg shadow-red-600/25 active:scale-95 cursor-pointer text-sm"
        >
          {submitting ? (isEn ? "Sending..." : "جاري الإرسال…") : (isEn ? "Post Review" : "نشر الرأي")}
        </button>
      </div>
    </div>
  );
}
