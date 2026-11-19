import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { resolveSessionForGuard } from "@/lib/auth-guard";
import { checkKashierOrderStatus } from "@/lib/kashier.functions";
import { SiteShell } from "@/components/layout/SiteShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BookOpen, Award, Receipt, Settings as SettingsIcon, PlayCircle, Play,
  Camera, Loader2, CheckCircle2, Clock, X, GraduationCap, TrendingUp,
  HelpCircle, Search, ArrowLeft, Sparkles, Tag, ChevronLeft,
  Gift, KeyRound, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { issueAndDownloadCertificate } from "@/lib/certificate";
import { useI18n } from "@/lib/i18n";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MascotLoader } from "@/components/common/MascotLoader";
import { getEnrolledCoursesByIds } from "@/lib/course-resolve.functions";
import { getDesktopExeDownloadUrl, getMobileApkDownloadUrl, isProtectedNativeApp } from "@/lib/desktop";

type LastWatchedLessonInfo = {
  lessonId: string;
  title: string;
  titleEn?: string;
  lastPos: number;
  duration: number;
  lastWatchedAt: string;
};

function formatProgressTime(seconds?: number | null) {
  if (!seconds || seconds <= 0 || !Number.isFinite(seconds)) return "00:00";
  const s = Math.floor(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const session = await resolveSessionForGuard();
    if (!session) throw redirect({ to: "/login", search: { redirect: location.pathname } });
  },
  validateSearch: (s: Record<string, unknown>): { paid?: "1"; ref?: string; slug?: string } => ({
    paid: s.paid === "1" || s.paid === 1 ? "1" as const : undefined,
    ref: typeof s.ref === "string" ? s.ref : undefined,
    slug: typeof s.slug === "string" ? s.slug : undefined,
  }),
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "لوحة الطالب — فكرة ديزاين" },
      { name: "description", content: "تابع كورساتك المسجّلة، حمّل شهاداتك، راجع طلباتك وحدّث بياناتك." },
      { property: "og:title", content: "لوحة الطالب — فكرة ديزاين" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function DashboardPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const { t, isEn } = useI18n();
  const nav = useNavigate();
  const search = Route.useSearch();
  const getEnrolledCoursesByIdsFn = useServerFn(getEnrolledCoursesByIds);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [lastWatched, setLastWatched] = useState<Record<string, string>>({});
  const [lastLessonMap, setLastLessonMap] = useState<Record<string, LastWatchedLessonInfo>>({});
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [courseFilter, setCourseFilter] = useState<"all" | "inprogress" | "done">("all");

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login", search: { redirect: "/dashboard" } });
  }, [loading, user, nav]);

  const loadProgress = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("lesson_progress")
      .select("course_id, lesson_id, last_position_seconds, duration_seconds, last_watched_at, lessons(id, title, title_en, duration)")
      .eq("user_id", userId)
      .order("last_watched_at", { ascending: false });

    const lastWatchedObj: Record<string, string> = {};
    const lessonMap: Record<string, LastWatchedLessonInfo> = {};
    (data ?? []).forEach((r: any) => {
      if (r.course_id && !lastWatchedObj[r.course_id] && r.last_watched_at) {
        lastWatchedObj[r.course_id] = r.last_watched_at;
      }
      if (r.course_id && !lessonMap[r.course_id] && r.lesson_id) {
        const les = r.lessons;
        lessonMap[r.course_id] = {
          lessonId: r.lesson_id,
          title: les?.title || (isEn ? "Lesson" : "درس"),
          titleEn: les?.title_en,
          lastPos: r.last_position_seconds ?? 0,
          duration: r.duration_seconds ?? les?.duration ?? 0,
          lastWatchedAt: r.last_watched_at,
        };
      }
    });
    setLastWatched(lastWatchedObj);
    setLastLessonMap(lessonMap);
  }, [isEn]);

  const loadDashboardData = useCallback(async (userId: string) => {
    try {
      // 1. Fetch published courses
      const { data: coursesData } = await supabase
        .from("courses")
        .select("id,slug,title,title_en,short_description,short_description_en,image_url,price,discount_price,level,status")
        .order("created_at", { ascending: false });

      const coursesList = coursesData ?? [];
      setAllCourses(coursesList.filter((c) => c.status === "published"));

      // 2. Fetch enrollments
      const { data: enrData } = await supabase
        .from("enrollments")
        .select("*, courses(*)")
        .eq("user_id", userId);

      const rawEnrollments = enrData ?? [];

      // 3. Resolve course if courses(*) was null or returned as an array
      const enriched = rawEnrollments.map((e) => {
        let course: any = e.courses;
        if (Array.isArray(course) && course.length > 0) {
          course = course[0];
        }
        if (!course && e.course_id) {
          course = coursesList.find((c) => c.id === e.course_id);
        }
        return { ...e, courses: course };
      });

      // 4. If any enrollment still missing course info, attempt direct fetch by id
      const missingCourseIds = enriched
        .filter((e) => !e.courses && e.course_id)
        .map((e) => e.course_id);

      if (missingCourseIds.length > 0) {
        const { data: directCourses } = await supabase
          .from("courses")
          .select("id,slug,title,title_en,short_description,short_description_en,image_url,price,discount_price,level,status")
          .in("id", missingCourseIds);

        if (directCourses && directCourses.length > 0) {
          enriched.forEach((e) => {
            if (!e.courses) {
              const matched = directCourses.find((dc) => dc.id === e.course_id);
              if (matched) e.courses = matched;
            }
          });
        }

        // If any courses are STILL missing (e.g. status='draft' or hidden, blocked by public RLS),
        // fallback to server function that uses supabaseAdmin
        const stillMissing = enriched
          .filter((e) => !e.courses && e.course_id)
          .map((e) => e.course_id);

        if (stillMissing.length > 0) {
          try {
            const res = await getEnrolledCoursesByIdsFn({ data: { courseIds: stillMissing, userId } });
            const adminCourses = (res && Array.isArray((res as any).courses)) ? (res as any).courses : [];
            if (adminCourses.length > 0) {
              enriched.forEach((e) => {
                if (!e.courses) {
                  const matched = adminCourses.find((ac: any) => ac.id === e.course_id);
                  if (matched) e.courses = matched;
                }
              });
            }
          } catch (err) {
            console.error("Error fetching stillMissing courses via admin:", err);
          }
        }
      }

      setEnrollments(enriched);

      // 5. Fetch orders
      const { data: ordData } = await supabase
        .from("orders")
        .select("*, courses(title, title_en, price, discount_price)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      setOrders(ordData ?? []);

      // 6. Load progress
      loadProgress(userId);
    } catch (err) {
      console.error("Dashboard data load error:", err);
    }
  }, [loadProgress]);

  useEffect(() => {
    if (!user) return;
    loadDashboardData(user.id);
  }, [user, loadDashboardData]);

  const refreshDashboardData = useCallback(() => {
    if (!user) return;
    loadDashboardData(user.id);
  }, [user, loadDashboardData]);

  useEffect(() => { if (profile) { setName(profile.name); setPhone(profile.phone ?? ""); } }, [profile]);

  if (!user) return null;

  const saveProfile = async () => {
    const { error } = await supabase.from("profiles").update({ name, phone }).eq("id", user.id);
    if (error) toast.error(error.message);
    else { toast.success(t("dashboard.settings.saved")); refreshProfile(); }
  };

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) { toast.error(t("dashboard.settings.errImgOnly")); return; }
    if (file.size > 3 * 1024 * 1024) { toast.error(t("dashboard.settings.errSize")); return; }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: updErr } = await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", user.id);
      if (updErr) throw updErr;
      toast.success(t("dashboard.settings.avatarUpdated"));
      refreshProfile();
    } catch (err: any) {
      toast.error(err?.message ?? t("dashboard.settings.errUpload"));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const downloadCert = async (courseId: string, courseTitle: string, courseSlug?: string, overrides?: any) => {
    try {
      const studentName = profile?.name || user.email || "Student";
      let completionDate: Date | undefined;
      try {
        const { data: lp } = await supabase.from("lesson_progress").select("last_watched_at")
          .eq("user_id", user.id).eq("course_id", courseId)
          .order("last_watched_at", { ascending: false }).limit(1).maybeSingle();
        if (lp?.last_watched_at) completionDate = new Date(lp.last_watched_at);
      } catch { /* fallback */ }
      await issueAndDownloadCertificate({ userId: user.id, courseId, studentName, courseTitle, courseSlug, overrides, date: completionDate });
      toast.success(t("dashboard.cert.done"));
    } catch { toast.error(t("dashboard.cert.err")); }
  };

  const downloadReceipt = (o: any) => {
    const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const methodMapAr: Record<string, string> = {
      kashier: "بطاقة بنكية / محفظة إلكترونية (Kashier)",
      instapay: "إنستاباي (InstaPay)",
      vodafone_cash: "فودافون كاش (Vodafone Cash)",
      bank_transfer: "تحويل بنكي مباشر (Bank Transfer)",
      card: "بطاقة بنكية (Credit / Debit Card)",
      paddle: "Paddle Global",
    };
    const methodMapEn: Record<string, string> = {
      kashier: "Card / Wallet (Kashier)",
      instapay: "InstaPay",
      vodafone_cash: "Vodafone Cash",
      bank_transfer: "Bank Transfer",
      card: "Credit / Debit Card",
      paddle: "Paddle Global",
    };
    const method = (isEn ? methodMapEn[o.payment_method] : methodMapAr[o.payment_method]) || o.payment_method || "—";
    const rawRef = o.transaction_ref || o.id.slice(0, 8).toUpperCase();
    const orderRef = rawRef.startsWith("ORD-") ? rawRef : `ORD-${rawRef}`;
    const createdDate = new Date(o.created_at);
    const approvedDate = o.reviewed_at ? new Date(o.reviewed_at) : createdDate;
    const formattedCreated = createdDate.toLocaleString(isEn ? "en-GB" : "ar-EG", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    const formattedApproved = approvedDate.toLocaleString(isEn ? "en-GB" : "ar-EG", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    const stampDate = approvedDate.toLocaleDateString(isEn ? "en-GB" : "ar-EG", { year: "numeric", month: "2-digit", day: "2-digit" });
    const studentName = profile?.name || user.email?.split("@")[0] || "الطالب";
    const studentEmail = user.email || profile?.email || "—";
    const studentPhone = profile?.phone || "";
    const courseTitle = (isEn && o.courses?.title_en) || o.courses?.title || (isEn ? "Educational Course" : "دورة تدريبية متقدمة");
    const amountNum = Number(o.amount || 0);
    const courseOriginalPrice = Number(o.courses?.price || 0);
    const subtotal = courseOriginalPrice > amountNum ? courseOriginalPrice : amountNum;
    const discountAmount = Math.max(0, subtotal - amountNum);
    const hasDiscount = discountAmount > 0 || !!o.coupon_code;

    const html = `<!doctype html>
<html dir="${isEn ? "ltr" : "rtl"}" lang="${isEn ? "en" : "ar"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${isEn ? `Invoice ${esc(orderRef)} - Fekra Design` : `فاتورة ${esc(orderRef)} - فكرة ديزاين`}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #0b0f17;
      color: #1e293b;
      min-height: 100vh;
      padding: 30px 16px 50px;
      -webkit-font-smoothing: antialiased;
    }
    .no-print-bar {
      max-width: 820px;
      margin: 0 auto 20px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: rgba(23, 29, 44, 0.9);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 14px 20px;
      border-radius: 14px;
      color: #e2e8f0;
    }
    .no-print-bar .tip {
      font-size: 13px;
      color: #94a3b8;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .no-print-bar .actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .btn-print {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(135deg, #e50914 0%, #b80710 100%);
      color: #ffffff;
      border: none;
      padding: 10px 22px;
      border-radius: 10px;
      font-family: inherit;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(229, 9, 20, 0.4);
      transition: all 0.2s ease;
    }
    .btn-print:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(229, 9, 20, 0.6);
    }
    .btn-close {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 255, 255, 0.08);
      color: #cbd5e1;
      border: 1px solid rgba(255, 255, 255, 0.15);
      padding: 10px 18px;
      border-radius: 10px;
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-close:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
    }
    .invoice-card {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.5), 0 0 1px 1px rgba(255, 255, 255, 0.1);
      position: relative;
    }
    .accent-stripe {
      height: 6px;
      background: linear-gradient(90deg, #e50914 0%, #ff5722 50%, #f5c518 100%);
      width: 100%;
    }
    .invoice-body {
      padding: 40px 48px;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      padding-bottom: 28px;
      border-bottom: 1.5px solid #edf2f7;
    }
    .brand-col {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .brand-logo {
      height: 58px;
      width: auto;
      object-fit: contain;
      border-radius: 8px;
    }
    .brand-fallback {
      width: 58px;
      height: 58px;
      border-radius: 12px;
      background: #0f172a;
      color: #e50914;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: 900;
      border: 1.5px solid #e50914;
    }
    .brand-name {
      font-size: 22px;
      font-weight: 900;
      color: #0f172a;
      line-height: 1.2;
    }
    .brand-sub {
      font-size: 13px;
      color: #64748b;
      margin-top: 3px;
      font-weight: 500;
    }
    .brand-tag {
      display: inline-block;
      margin-top: 4px;
      font-size: 11px;
      font-weight: 600;
      color: #e50914;
      background: #fef2f2;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .invoice-title-col {
      text-align: ${isEn ? "right" : "left"};
    }
    .doc-type {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .doc-title {
      font-size: 24px;
      font-weight: 900;
      color: #0f172a;
      margin: 2px 0 6px;
      line-height: 1.2;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #ecfdf5;
      color: #047857;
      border: 1.5px solid #10b981;
      padding: 5px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
    }
    .ref-chip {
      margin-top: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 700;
      color: #1e293b;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      padding: 4px 10px;
      border-radius: 6px;
      display: inline-block;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 26px;
    }
    .info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 18px 20px;
    }
    .info-card-header {
      font-size: 11px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .info-card-header .icon {
      color: #e50914;
    }
    .info-card .item-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 7px;
      font-size: 13px;
    }
    .info-card .item-row:last-child {
      margin-bottom: 0;
    }
    .info-card .item-label {
      color: #64748b;
      font-weight: 500;
    }
    .info-card .item-value {
      color: #0f172a;
      font-weight: 700;
      text-align: ${isEn ? "right" : "left"};
    }
    .items-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin-top: 28px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
    }
    .items-table th {
      background: #f8fafc;
      color: #475569;
      font-size: 12px;
      font-weight: 800;
      padding: 12px 18px;
      text-align: ${isEn ? "left" : "right"};
      border-bottom: 1px solid #e2e8f0;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .items-table td {
      padding: 18px;
      font-size: 14px;
      color: #1e293b;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: top;
    }
    .course-name {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .course-desc {
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }
    .summary-section {
      margin-top: 24px;
      display: flex;
      justify-content: flex-end;
    }
    .summary-card {
      width: 100%;
      max-width: 360px;
    }
    .sum-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 4px;
      font-size: 13px;
      color: #64748b;
    }
    .sum-row.discount {
      color: #e50914;
      font-weight: 700;
    }
    .sum-total-box {
      margin-top: 10px;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      border: 1px solid #334155;
      color: #ffffff;
      padding: 16px 20px;
      border-radius: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.2);
    }
    .sum-total-label {
      font-size: 14px;
      font-weight: 700;
      color: #e2e8f0;
    }
    .sum-total-val {
      font-size: 24px;
      font-weight: 900;
      color: #f5c518;
      letter-spacing: -0.5px;
    }
    .sum-total-cur {
      font-size: 14px;
      color: #cbd5e1;
      font-weight: 700;
      margin-${isEn ? "left" : "right"}: 4px;
    }
    .trust-row {
      margin-top: 36px;
      padding-top: 24px;
      border-top: 1.5px dashed #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }
    .stamp-wrap {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .official-stamp {
      width: 120px;
      height: 120px;
      border: 3px double #059669;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      color: #059669;
      padding: 8px;
      transform: rotate(-6deg);
      background: rgba(16, 185, 129, 0.03);
      user-select: none;
      box-shadow: 0 0 0 1px rgba(5, 150, 105, 0.15) inset;
    }
    .stamp-title {
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .stamp-sub {
      font-size: 8px;
      font-weight: 700;
      margin: 2px 0;
      border-top: 1px dashed #059669;
      border-bottom: 1px dashed #059669;
      padding: 2px 0;
      width: 100%;
    }
    .stamp-date {
      font-size: 8px;
      font-weight: 600;
    }
    .stamp-check {
      font-size: 14px;
      line-height: 1;
    }
    .trust-notice {
      flex: 1;
      font-size: 12px;
      color: #64748b;
      line-height: 1.7;
    }
    .trust-notice strong {
      color: #0f172a;
    }
    .footer-bar {
      margin-top: 28px;
      background: #f8fafc;
      border: 1px solid #edf2f7;
      border-radius: 10px;
      padding: 12px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: #64748b;
    }
    .footer-bar a {
      color: #e50914;
      text-decoration: none;
      font-weight: 700;
    }
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
      }
      .no-print-bar {
        display: none !important;
      }
      .invoice-card {
        box-shadow: none !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 0 !important;
        max-width: 100% !important;
        margin: 0 !important;
      }
      .invoice-body {
        padding: 24px 28px !important;
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      @page {
        size: A4 portrait;
        margin: 10mm;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div class="tip">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
      <span>${isEn ? "Tip: You can save this invoice as a high-quality PDF by selecting 'Save as PDF' in the print dialog." : "نصيحة: يمكنك حفظ الفاتورة كملف PDF عالي الجودة باختيار (Save as PDF) من نافذة الطباعة."}</span>
    </div>
    <div class="actions">
      <button class="btn-print" onclick="window.print()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        <span>${isEn ? "Print / Save PDF" : "طباعة الفاتورة / حفظ PDF"}</span>
      </button>
      <button class="btn-close" onclick="window.close()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        <span>${isEn ? "Close" : "إغلاق"}</span>
      </button>
    </div>
  </div>

  <div class="invoice-card">
    <div class="accent-stripe"></div>
    <div class="invoice-body">
      <!-- Header -->
      <div class="header-row">
        <div class="brand-col">
          <img src="/logo.png" onerror="this.onerror=null;this.src='https://fekradesign.shalaby3.online/__l5e/assets-v1/08f2d0a0-8d7b-4d97-926f-26f8dd624208/email-logo-fekra-design.png'" alt="فكرة ديزاين" class="brand-logo" />
          <div>
            <div class="brand-name">فكرة ديزاين · Fekra Design</div>
            <div class="brand-sub">${isEn ? "Certified Creative & AI Training Academy" : "أكاديمية التدريب والذكاء الاصطناعي المعتمدة"}</div>
            <span class="brand-tag">${isEn ? "Verified Digital Learning Platform" : "منصة تعليم وتدريب رقمية معتمدة"}</span>
          </div>
        </div>

        <div class="invoice-title-col">
          <div class="doc-type">${isEn ? "Official Tax & Payment Receipt" : "إيصال سداد إلكتروني معتمد"}</div>
          <div class="doc-title">${isEn ? "Electronic Invoice" : "فاتورة سداد إلكترونية"}</div>
          <div class="status-badge">
            <span>✓</span>
            <span>${isEn ? "PAID IN FULL" : "مدفوع بالكامل"}</span>
          </div>
          <div>
            <span class="ref-chip">${esc(orderRef)}</span>
          </div>
        </div>
      </div>

      <!-- Customer & Payment Grid -->
      <div class="meta-grid">
        <div class="info-card">
          <div class="info-card-header">
            <span class="icon">●</span>
            <span>${isEn ? "Billed To / Student Details" : "بيانات المشترك / الطالب"}</span>
          </div>
          <div class="item-row">
            <span class="item-label">${isEn ? "Student Name" : "اسم الطالب"}:</span>
            <span class="item-value">${esc(studentName)}</span>
          </div>
          <div class="item-row">
            <span class="item-label">${isEn ? "Email Account" : "البريد الإلكتروني"}:</span>
            <span class="item-value" style="font-family: 'JetBrains Mono', monospace; font-size: 12px;">${esc(studentEmail)}</span>
          </div>
          ${studentPhone ? `
          <div class="item-row">
            <span class="item-label">${isEn ? "Phone Number" : "رقم الهاتف"}:</span>
            <span class="item-value" style="font-family: 'JetBrains Mono', monospace; font-size: 12px;">${esc(studentPhone)}</span>
          </div>` : ""}
          <div class="item-row">
            <span class="item-label">${isEn ? "Enrollment Status" : "حالة الاشتراك"}:</span>
            <span class="item-value" style="color: #059669;">${isEn ? "Active — Lifetime Access" : "مفعل ومسجل — وصول دائم"}</span>
          </div>
        </div>

        <div class="info-card">
          <div class="info-card-header">
            <span class="icon">●</span>
            <span>${isEn ? "Transaction & Payment Info" : "تفاصيل العملية والسداد"}</span>
          </div>
          <div class="item-row">
            <span class="item-label">${isEn ? "Order Date" : "تاريخ الطلب"}:</span>
            <span class="item-value">${formattedCreated}</span>
          </div>
          <div class="item-row">
            <span class="item-label">${isEn ? "Approval Date" : "تاريخ التفعيل والاعتماد"}:</span>
            <span class="item-value">${formattedApproved}</span>
          </div>
          <div class="item-row">
            <span class="item-label">${isEn ? "Payment Method" : "طريقة الدفع"}:</span>
            <span class="item-value" style="color: #4f46e5;">${esc(method)}</span>
          </div>
          <div class="item-row">
            <span class="item-label">${isEn ? "Transaction Ref" : "رقم العملية المرجعي"}:</span>
            <span class="item-value" style="font-family: 'JetBrains Mono', monospace; font-size: 12px;">${esc(rawRef)}</span>
          </div>
        </div>
      </div>

      <!-- Items Table -->
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 55%;">${isEn ? "Item & Description" : "البند والوصف"}</th>
            <th style="width: 20%; text-align: center;">${isEn ? "Type" : "نوع الخدمة"}</th>
            <th style="width: 10%; text-align: center;">${isEn ? "Qty" : "الكمية"}</th>
            <th style="width: 15%; text-align: ${isEn ? "right" : "left"};">${isEn ? "Price" : "السعر"}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div class="course-name">${esc(courseTitle)}</div>
              <div class="course-desc">${isEn ? "Full lifetime access to course curriculum, interactive live sessions, downloadable assets, future updates, and certified completion credential." : "وصول كامل ودائم لمحتوى الدورة التعليمية، الجلسات التفاعلية المباشرة، بنك الملفات، والتحديثات المستقبلية مع شهادة إتمام معتمدة."}</div>
            </td>
            <td style="text-align: center; font-size: 13px; color: #475569; font-weight: 600;">
              ${isEn ? "Certified Program" : "برنامج تدريبي معتمد"}
            </td>
            <td style="text-align: center; font-weight: 700; color: #0f172a;">
              1
            </td>
            <td style="text-align: ${isEn ? "right" : "left"}; font-weight: 800; font-size: 15px; color: #0f172a;">
              ${subtotal.toFixed(2)} ${isEn ? "EGP" : "ج.م"}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Summary & Total -->
      <div class="summary-section">
        <div class="summary-card">
          ${hasDiscount ? `
          <div class="sum-row">
            <span>${isEn ? "Subtotal" : "المجموع الفرعي"}:</span>
            <span>${subtotal.toFixed(2)} ${isEn ? "EGP" : "ج.م"}</span>
          </div>
          <div class="sum-row discount">
            <span>${isEn ? "Discount / Coupon" : "الخصم"}${o.coupon_code ? ` (${esc(o.coupon_code)})` : ""}:</span>
            <span>- ${discountAmount.toFixed(2)} ${isEn ? "EGP" : "ج.م"}</span>
          </div>` : ""}
          <div class="sum-total-box">
            <span class="sum-total-label">${isEn ? "Total Paid (EGP)" : "المبلغ الإجمالي المسدد"}</span>
            <div>
              <span class="sum-total-val">${amountNum.toFixed(2)}</span>
              <span class="sum-total-cur">${isEn ? "EGP" : "ج.م"}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Official Stamp & Legal Trust Notice -->
      <div class="trust-row">
        <div class="stamp-wrap">
          <div class="official-stamp">
            <div class="stamp-check">✓</div>
            <div class="stamp-title">فكرة ديزاين</div>
            <div class="stamp-sub">معتمد وموثق رقمياً</div>
            <div class="stamp-date">${stampDate}</div>
          </div>
        </div>
        <div class="trust-notice">
          <strong>${isEn ? "Authentic Certified Document:" : "مستند رسمي معتمد وموثق:"}</strong><br>
          ${isEn ? "This invoice represents an official certified payment confirmation issued by Fekra Design Academy. The transaction has been verified and settled in full. This document is recognized without requiring a manual signature or physical seal." : "يمثل هذا المستند إيصال سداد رسمي معتمد ومسجل إلكترونياً لدى منصة فكرة ديزاين للتدريب. تم التحقق من سلامة المعاملة وسداد الرسوم بالكامل وتفعيل حساب الطالب بنجاح. يُعتد بهذه الفاتورة إلكترونياً دون الحاجة إلى توقيع خطي أو ختم يدوي."}
        </div>
      </div>

      <!-- Footer Bar -->
      <div class="footer-bar">
        <div>${isEn ? "Support & Inquiries" : "الدعم الفني واستفسارات الطلاب"}: <a href="https://wa.me/201000000000" target="_blank">واتساب الدعم</a> · support@fekradesign.com</div>
        <div><a href="https://fekradesign.shalaby3.online" target="_blank">www.fekradesign.com</a></div>
      </div>
    </div>
  </div>

  <script>
    // Trigger print dialog smoothly after fonts and styles render
    window.addEventListener('load', () => {
      setTimeout(() => {
        try { window.print(); } catch (e) {}
      }, 500);
    });
  </script>
</body>
</html>`;

    const w = window.open("", "_blank", "width=880,height=960");
    if (!w) { toast.error(t("dashboard.popupBlocked")); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const activeEnrollments = enrollments
    .map((e) => {
      let c = e.courses;
      if (Array.isArray(c) && c.length > 0) c = c[0];
      if (!c && e.course_id) {
        c = allCourses.find((item) => item.id === e.course_id);
      }
      return { ...e, courses: c };
    })
    .filter((e) => e.courses && e.status !== "banned");

  const pendingOrders = orders.filter((o) => o.status === "pending");
  const completedEnrollments = activeEnrollments.filter((e) => (e.progress ?? 0) >= 100);
  const inProgressEnrollments = activeEnrollments.filter((e) => (e.progress ?? 0) > 0 && (e.progress ?? 0) < 100);
  const sortedEnrollments = [...activeEnrollments].sort((a, b) => {
    const ta = lastWatched[a.course_id] ? new Date(lastWatched[a.course_id]).getTime() : new Date(a.created_at || 0).getTime();
    const tb = lastWatched[b.course_id] ? new Date(lastWatched[b.course_id]).getTime() : new Date(b.created_at || 0).getTime();
    return tb - ta;
  });
  const continueCourse = sortedEnrollments.find((e) => (e.progress ?? 0) < 100) ?? sortedEnrollments[0];
  const enrolledIds = new Set(activeEnrollments.map((e) => e.course_id));
  const newCourses = allCourses.filter((c) => !enrolledIds.has(c.id));
  const filteredEnrollments = courseFilter === "done" ? completedEnrollments : courseFilter === "inprogress" ? inProgressEnrollments : sortedEnrollments;
  const avgProgress = activeEnrollments.length > 0
    ? Math.round(activeEnrollments.reduce((s, e) => s + (e.progress ?? 0), 0) / activeEnrollments.length) : 0;

  if (loading || !user) {
    return (
      <SiteShell>
        <div className="container-page py-24 flex items-center justify-center min-h-[60vh]">
          <MascotLoader size="md" />
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="container-page py-8 md:py-10 space-y-6">
        {search.paid === "1" && user && (
          <PaymentStatusBanner userId={user.id} orderRef={search.ref} preferSlug={search.slug}
            onApproved={refreshDashboardData}
            onOpenCourse={(slug) => nav({ to: "/learn/$slug", params: { slug }, replace: true })}
            onDismiss={() => nav({ to: "/dashboard", search: {} as any, replace: true })} />
        )}

        {/* Pending Orders Notice */}
        {pendingOrders.length > 0 && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 flex items-start gap-3 shadow-lg">
            <Clock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
            <div className="flex-1 text-xs sm:text-sm">
              <span className="font-bold block text-white mb-1">لديك طلب اشتراك قيد المراجعة</span>
              طلبك لدورة <strong className="text-amber-300">"{pendingOrders[0].courses?.title || "الدورة"}"</strong> تم استلامه وهو قيد المراجعة حالياً من قبل الإدارة، وسيتم فتح الكورس تلقائياً في حسابك فور تأكيد التحويل.
            </div>
          </div>
        )}

        {/* Official Desktop + Mobile Apps Download Banner (shown only on web browsers) */}
        {!isProtectedNativeApp() && (
          <div className="rounded-2xl border border-rose-500/30 bg-gradient-to-r from-[#281519] via-[#1f181a] to-[#1a1617] p-4 md:p-5 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-400">
                <span>⚡ منصة التطبيقات المستقلة</span>
                <span>•</span>
                <span>نسخة الويندوز + نسخة الموبايل المحمية ضد التصوير</span>
              </div>
              <h3 className="text-sm md:text-base font-extrabold text-white">
                تطبيقات Idea Courses الرسمية — م. إيهاب الجلالي (Windows + Android)
              </h3>
              <p className="text-xs text-white/70">
                حمّل تطبيق الويندوز أو تطبيق الموبايل المحمي لمشاهدة المحاضرات بأعلى سرعة وحماية مع مزامنة فورية ودعم الأوفلاين.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <a
                href={getDesktopExeDownloadUrl()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#e50914] hover:bg-[#f40612] text-white font-bold text-xs px-4 py-2.5 shadow-lg shadow-[#e50914]/30 transition-all"
              >
                <span>تحميل للكمبيوتر (.exe)</span>
              </a>
              <a
                href={getMobileApkDownloadUrl()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 shadow-lg shadow-emerald-900/30 transition-all"
              >
                <span>تحميل للموبايل (.apk)</span>
              </a>
            </div>
          </div>
        )}

        {/* Profile Header */}
        <div className="relative overflow-hidden rounded-2xl bg-[#2f2b2b] border border-[#443e3e] text-white p-5 md:p-8 shadow-xl">
          <div className="pointer-events-none absolute top-0 left-0 h-48 w-48 rounded-full bg-[#e50914]/10 blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-32 w-32 rounded-full bg-[#5aca26]/10 blur-2xl" />
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.name} className="h-16 w-16 md:h-20 md:w-20 rounded-2xl object-cover ring-2 ring-[#e50914]/60 ring-offset-2 ring-offset-[#252121]" />
              ) : (
                <div className="h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-[#e50914] grid place-items-center shadow-lg shadow-[#e50914]/30">
                  <span className="text-2xl md:text-3xl font-black text-white">{profile?.name?.[0] ?? user.email?.[0]?.toUpperCase() ?? "I"}</span>
                </div>
              )}
              <div className="absolute -bottom-1 -left-1 h-5 w-5 rounded-full bg-[#5aca26] border-2 border-[#252121]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-[#e50914] mb-0.5 uppercase tracking-wider">لوحة تحكم الطالب</div>
              <h1 className="text-xl md:text-3xl font-black leading-tight text-white">
                أهلاً بك، {profile?.name?.split(" ")[0] || user.email?.split("@")[0]} 👋
              </h1>
              <p className="text-white/60 text-xs sm:text-sm mt-0.5 truncate">{user.email}</p>
            </div>
            {activeEnrollments.length > 0 && (
              <div className="hidden sm:flex flex-col items-center bg-[#383333] rounded-2xl px-5 py-3 border border-[#484242] shrink-0">
                <div className="text-3xl font-black text-[#5aca26] leading-none">{avgProgress}%</div>
                <div className="text-[11px] text-white/60 mt-1">متوسط الإنجاز</div>
              </div>
            )}
          </div>
          <div className="relative z-10 grid grid-cols-3 gap-3 mt-5">
            {[
              { value: activeEnrollments.length, label: "الدورات المشترك بها", color: "text-[#e50914]" },
              { value: inProgressEnrollments.length, label: "قيد المتابعة", color: "text-[#3073df]" },
              { value: completedEnrollments.length, label: "الدورات المكتملة", color: "text-[#5aca26]" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-[#383333] border border-[#484242] p-3 text-center">
                <div className={`text-2xl font-black leading-none ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-white/60 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Continue Learning */}
        {continueCourse && continueCourse.courses?.slug && (() => {
          const courseLast = lastLessonMap[continueCourse.course_id];
          const courseLessonTitle = (isEn && courseLast?.titleEn) || courseLast?.title;
          const isFinished = (continueCourse.progress ?? 0) >= 100;
          return (
            <div>
              <div className="text-xs font-bold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
                <PlayCircle className="h-4 w-4 text-[#e50914]" />
                {courseLast ? "واصل من حيث توقفت" : "ابدأ رحلتك التعليمية"}
              </div>
              <Card className="overflow-hidden border border-[#443e3e] bg-[#2f2b2b] hover:border-[#e50914]/50 transition-colors">
                <div className="flex flex-col sm:flex-row gap-0">
                  {continueCourse.courses.image_url && (
                    <div className="relative sm:w-52 shrink-0">
                      <img src={continueCourse.courses.image_url} alt="" className="w-full h-40 sm:h-full object-cover" />
                      <div className="absolute top-3 right-3">
                        <Badge className="bg-[#e50914] text-white text-[10px] font-bold">▶ استمر</Badge>
                      </div>
                    </div>
                  )}
                  <div className="flex-1 p-5 flex flex-col">
                    <h2 className="text-lg md:text-xl font-black text-white line-clamp-2 mb-2">
                      {(isEn && continueCourse.courses.title_en) || continueCourse.courses.title}
                    </h2>

                    {courseLast && !isFinished && (
                      <div className="mb-3 p-3 rounded-xl bg-[#383333] border border-[#484242] flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-semibold text-[#e50914] flex items-center gap-1.5 mb-0.5">
                            <Play className="h-3 w-3 fill-[#e50914]" />
                            آخر درس شاهدته:
                          </div>
                          <div className="font-bold text-white truncate text-sm">
                            {courseLessonTitle}
                          </div>
                        </div>
                        <div className="shrink-0 font-mono text-xs font-bold text-white bg-[#e50914] px-2.5 py-1 rounded-md shadow-sm">
                          {formatProgressTime(courseLast.lastPos)} {courseLast.duration > 0 ? ` / ${formatProgressTime(courseLast.duration)}` : ""}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5 mb-4">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/60">التقدم</span>
                        <span className="font-bold text-[#5aca26]">{continueCourse.progress ?? 0}%</span>
                      </div>
                      <div className="relative h-2.5 rounded-full bg-[#383333] overflow-hidden">
                        <div className="absolute inset-y-0 right-0 rounded-full bg-[#5aca26] transition-all duration-700"
                          style={{ width: `${continueCourse.progress ?? 0}%` }} />
                      </div>
                    </div>
                    <Button asChild size="lg" className="bg-gradient-to-r from-[#e50914] to-[#b8050e] hover:from-[#f0131e] hover:to-[#9e040c] text-white font-bold rounded-xl w-full sm:w-auto self-start shadow-md hover:shadow-lg transition-all">
                      <Link
                        to="/learn/$slug"
                        params={{ slug: continueCourse.courses.slug || continueCourse.courses.id }}
                        search={courseLast && !isFinished ? { lesson: courseLast.lessonId } : undefined}
                      >
                        <PlayCircle className="ml-2 h-5 w-5" />
                        {isFinished
                          ? "مراجعة الدورة"
                          : courseLast
                            ? `واصل من دقيقة ${formatProgressTime(courseLast.lastPos)}`
                            : (continueCourse.progress ?? 0) > 0
                              ? "واصل التعلم"
                              : "ابدأ الآن"}
                      </Link>
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          );
        })()}

        {/* Tabs */}
        <Tabs defaultValue="courses" className="space-y-5">
          <TabsList className="flex w-full h-auto p-1.5 gap-1.5 overflow-x-auto bg-[#2f2b2b] border border-[#443e3e] rounded-xl">
            {[
              { value: "courses", icon: <BookOpen className="h-4 w-4" />, label: "دوراتي التعليمية", count: activeEnrollments.length },
              { value: "explore", icon: <Sparkles className="h-4 w-4" />, label: "تصفح الدورات", count: newCourses.length },
              { value: "certs", icon: <Award className="h-4 w-4" />, label: "الشهادات", count: completedEnrollments.length },
              { value: "orders", icon: <Receipt className="h-4 w-4" />, label: "الطلبات والمعاملات", count: orders.length },
              { value: "settings", icon: <SettingsIcon className="h-4 w-4" />, label: "الإعدادات", count: 0 },
            ].map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}
                className="shrink-0 snap-start flex items-center gap-1.5 py-2.5 px-4 font-bold text-xs sm:text-sm rounded-lg whitespace-nowrap text-white/70 data-[state=active]:bg-[#e50914] data-[state=active]:text-white transition-all">
                {tab.icon} {tab.label}
                {tab.count > 0 && <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">{tab.count}</span>}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* My Courses */}
          <TabsContent value="courses" className="space-y-6">
            <RedeemCodeCard onRedeemed={refreshDashboardData} />

            {activeEnrollments.length === 0 ? (
              <div className="space-y-6">
                <Card className="p-8 sm:p-10 text-center bg-[#2f2b2b] border border-[#443e3e] rounded-2xl">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-[#e50914]/15 text-[#e50914] flex items-center justify-center mb-4">
                    <BookOpen className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-black text-white mb-2">
                    {enrollments.length > 0
                      ? "جاري مراجعة وتأكيد تسجيلك في الدورة"
                      : "لا توجد دورات مشتركة في حسابك بعد"}
                  </h3>
                  <p className="text-white/60 mb-6 text-xs sm:text-sm max-w-md mx-auto">
                    {enrollments.length > 0
                      ? "إذا قمت بالتحويل أو استلام كود تفعيل مؤخراً، سيتم تفعيل حسابك فور مراجعة الإيصال. ويمكنك تصفح باقي الدورات المتاحة أدناه."
                      : "ابدأ رحلتك التعليمية الآن واكتشف مسارات الموشن جرافيك والمونتاج والذكاء الاصطناعي مع أفضل المدربين."}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button asChild size="lg" className="bg-gradient-to-r from-[#e50914] to-[#b8050e] hover:from-[#f0131e] hover:to-[#9e040c] text-white font-bold rounded-xl px-7">
                      <Link to="/courses"><Search className="ml-2 h-4 w-4" /> تصفح جميع الدورات</Link>
                    </Button>
                  </div>
                </Card>

                {/* Always display all available courses right below for easy access! */}
                {allCourses.length > 0 && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-[#e50914]" />
                        الدورات المتاحة للبدء الآن ({allCourses.length})
                      </h2>
                      <Button asChild variant="ghost" size="sm" className="text-white/70 hover:text-white">
                        <Link to="/courses">عرض الجميع <ArrowLeft className="mr-1 h-4 w-4" /></Link>
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {allCourses.map((c) => (
                        <ExploreCourseCard key={c.id} c={c} isEn={isEn} t={t} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
                  {([
                    { key: "all", label: `الكل (${activeEnrollments.length})` },
                    { key: "inprogress", label: `قيد التعلم (${inProgressEnrollments.length})` },
                    { key: "done", label: `مكتمل (${completedEnrollments.length})` },
                  ] as const).map((f) => (
                    <button key={f.key} type="button" onClick={() => setCourseFilter(f.key)}
                      className={`shrink-0 rounded-full px-4 py-1.5 text-xs sm:text-sm font-bold border transition-all whitespace-nowrap ${courseFilter === f.key ? "bg-[#e50914] text-white border-[#e50914]" : "bg-[#383333] text-white/80 border-[#484242] hover:border-white/40"}`}>
                      {f.label}
                    </button>
                  ))}
                  <Button asChild variant="ghost" size="sm" className="shrink-0 mr-auto text-white/70 hover:text-white">
                    <Link to="/courses">المزيد من الدورات <ArrowLeft className="mr-1 h-4 w-4" /></Link>
                  </Button>
                </div>
                {filteredEnrollments.length === 0 ? (
                  <Card className="p-8 text-center bg-[#2f2b2b] border border-[#443e3e] rounded-xl">
                    <p className="text-white/60 text-sm">لا توجد دورات في هذه الفئة</p>
                  </Card>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {filteredEnrollments.map((e) => {
                      const course = e.courses;
                      const courseTitle = ((isEn && course?.title_en) || course?.title) ?? "دورة تعليمية";
                      const progress = e.progress ?? 0;
                      const isDone = progress >= 100;
                      const isStarted = progress > 0;
                      const courseLast = lastLessonMap[e.course_id];
                      const courseLessonTitle = (isEn && courseLast?.titleEn) || courseLast?.title;
                      return (
                        <Card key={e.id} className="overflow-hidden hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 group bg-[#2f2b2b] border border-[#443e3e] hover:border-[#e50914]/50 rounded-2xl">
                          <div className="flex flex-col sm:flex-row">
                            <div className="relative sm:w-44 shrink-0">
                              {course?.image_url ? (
                                <img src={course.image_url} alt={courseTitle} className="w-full h-36 sm:h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              ) : (
                                <div className="w-full h-36 sm:h-full bg-[#383333] grid place-items-center"><BookOpen className="h-8 w-8 text-white/40" /></div>
                              )}
                              {isDone && (
                                <div className="absolute inset-0 bg-[#5aca26]/30 flex items-center justify-center">
                                  <div className="rounded-full bg-[#5aca26] p-2.5 shadow-lg"><CheckCircle2 className="h-6 w-6 text-white" /></div>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 p-4 flex flex-col">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h3 className="font-bold text-white text-[15px] line-clamp-2 group-hover:text-[#e50914] transition-colors flex-1">{courseTitle}</h3>
                                <Badge className={`shrink-0 text-[10px] border ${isDone ? "bg-[#5aca26]/20 text-[#5aca26] border-[#5aca26]/40" : isStarted ? "bg-[#e50914]/20 text-[#e50914] border-[#e50914]/40" : "bg-[#383333] text-white/60 border-[#484242]"}`}>
                                  {isDone ? "✅ مكتمل" : isStarted ? "جاري" : "جديد"}
                                </Badge>
                              </div>

                              {courseLast && !isDone && (
                                <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-[#383333] border border-[#484242] flex items-center justify-between gap-2 text-[11px]">
                                  <span className="truncate text-white/90 font-semibold flex items-center gap-1 min-w-0">
                                    <Play className="h-2.5 w-2.5 text-[#e50914] shrink-0 fill-[#e50914]" />
                                    <span className="truncate">{courseLessonTitle}</span>
                                  </span>
                                  <span className="font-mono font-bold text-[#e50914] shrink-0">
                                    {formatProgressTime(courseLast.lastPos)}
                                  </span>
                                </div>
                              )}

                              <div className="space-y-1 mb-3">
                                <div className="relative h-2 rounded-full bg-[#383333] overflow-hidden">
                                  <div className={`absolute inset-y-0 right-0 rounded-full transition-all duration-700 ${isDone ? "bg-[#5aca26]" : isStarted ? "bg-[#e50914]" : "bg-white/30"}`}
                                    style={{ width: `${progress}%` }} />
                                </div>
                                <div className="flex justify-between text-[11px] text-white/60">
                                  <span>نسبة الإنجاز: {progress}%</span>
                                  {isDone && <span className="text-[#5aca26] font-bold">🎉 تهانينا! أتممت الدورة</span>}
                                </div>
                              </div>
                              {(course?.slug || course?.id) ? (
                                <Button asChild size="sm" className={`mt-auto rounded-xl font-bold ${isDone ? "bg-[#383333] text-white hover:bg-[#484242]" : "bg-gradient-to-r from-[#e50914] to-[#b8050e] hover:from-[#d6004c] text-white"}`}>
                                  <Link
                                    to="/learn/$slug"
                                    params={{ slug: course.slug || course.id }}
                                    search={courseLast && !isDone ? { lesson: courseLast.lessonId } : undefined}
                                  >
                                    <PlayCircle className="ml-1.5 h-4 w-4" />
                                    {isDone
                                      ? "مراجعة الدورة"
                                      : courseLast
                                        ? `متابعة (${formatProgressTime(courseLast.lastPos)})`
                                        : isStarted
                                          ? "متابعة التعلم"
                                          : "ابدأ الآن"}
                                  </Link>
                                </Button>
                              ) : (
                                <Button disabled size="sm" className="mt-auto rounded-xl">غير متوفر</Button>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {/* Also show other available courses below the student's active enrollments */}
                {newCourses.length > 0 && (
                  <div className="mt-10 pt-8 border-t border-[#443e3e]/60 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-[#e50914]" />
                        استكشف دورات أخرى لتطوير مهاراتك ({newCourses.length})
                      </h2>
                      <Button asChild variant="ghost" size="sm" className="text-white/70 hover:text-white">
                        <Link to="/courses">كل الدورات <ArrowLeft className="mr-1 h-4 w-4" /></Link>
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {newCourses.slice(0, 3).map((c) => (
                        <ExploreCourseCard key={c.id} c={c} isEn={isEn} t={t} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Explore */}
          <TabsContent value="explore" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><Sparkles className="h-5 w-5 text-[#e50914]" /> تصفح الدورات المتاحة</h2>
              <Button asChild variant="ghost" size="sm" className="text-white/70 hover:text-white"><Link to="/courses">جميع الدورات <ArrowLeft className="mr-1 h-4 w-4" /></Link></Button>
            </div>
            {newCourses.length === 0 ? (
              <Card className="p-8 sm:p-12 text-center bg-[#2f2b2b] border border-[#443e3e] rounded-2xl">
                <Sparkles className="h-12 w-12 mx-auto mb-4 text-[#e50914]" />
                <p className="text-white/60">أنت مشترك في جميع الدورات المتاحة حالياً!</p>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {newCourses.map((c) => <ExploreCourseCard key={c.id} c={c} isEn={isEn} t={t} />)}
                </div>
              </>
            )}
          </TabsContent>

          {/* Certs */}
          <TabsContent value="certs" className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Award className="h-5 w-5 text-[#5aca26]" /> شهادات إتمام الدورات</h2>
            {completedEnrollments.length === 0 ? (
              <Card className="p-8 sm:p-12 text-center bg-[#2f2b2b] border border-[#443e3e] rounded-2xl">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-[#5aca26]/15 text-[#5aca26] flex items-center justify-center mb-4"><Award className="h-8 w-8" /></div>
                <h3 className="text-lg font-black text-white mb-2">لا توجد شهادات صادرة بعد</h3>
                <p className="text-white/60 text-xs sm:text-sm max-w-sm mx-auto">عند إتمام مشاهدة وتطبيق 100% من دروس أي دورة، سيتم إصدار شهادة معتمدة تلقائياً هنا.</p>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {completedEnrollments.map((e) => (
                  <Card key={e.id} className="overflow-hidden bg-[#2f2b2b] border border-[#443e3e] hover:border-[#5aca26]/50 rounded-2xl shadow-lg transition-all duration-200">
                    <div className="flex items-center gap-4 p-5">
                      <div className="relative shrink-0">
                        <div className="w-14 h-14 rounded-2xl bg-[#5aca26]/20 text-[#5aca26] grid place-items-center"><Award className="h-7 w-7" /></div>
                        <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-[#5aca26] border-2 border-[#2f2b2b] grid place-items-center"><CheckCircle2 className="h-3 w-3 text-white" /></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white line-clamp-2 leading-snug">{(isEn && e.courses.title_en) || e.courses.title}</div>
                        <div className="text-xs text-[#5aca26] font-semibold mt-1">✅ الشهادة جاهزة للتحميل</div>
                      </div>
                      <Button size="sm" onClick={() => downloadCert(e.courses.id, e.courses.title, e.courses.slug, e.courses.certificate_config)}
                        className="bg-[#5aca26] hover:bg-[#4eb320] text-white font-bold rounded-xl shrink-0">
                        تحميل PDF
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Orders */}
          <TabsContent value="orders" className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Receipt className="h-5 w-5 text-[#e50914]" /> سجل الطلبات والمدفوعات</h2>
            {orders.length === 0 ? (
              <Card className="p-8 sm:p-12 text-center bg-[#2f2b2b] border border-[#443e3e] rounded-2xl">
                <Receipt className="h-10 w-10 mx-auto mb-3 text-white/30" />
                <p className="text-white/60 text-sm">لا توجد عمليات شراء مسجلة بعد</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {orders.map((o) => {
                  const st: Record<string, string> = { approved: "bg-[#5aca26]/20 text-[#5aca26] border-[#5aca26]/40", rejected: "bg-red-500/20 text-red-400 border-red-500/40", pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" };
                  const sl: Record<string, string> = { approved: "مدفوع ✓", rejected: "مرفوض", pending: "قيد المراجعة" };
                  return (
                    <Card key={o.id} className="p-4 flex flex-wrap justify-between gap-3 items-start bg-[#2f2b2b] border border-[#443e3e] rounded-xl hover:border-white/20 transition-all">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white line-clamp-1">{o.courses?.title ?? "دورة تعليمية"}</div>
                        <div className="text-xs text-white/60 mt-0.5">{new Date(o.created_at).toLocaleDateString("ar-EG")} • <span className="font-bold text-[#5aca26]">{o.amount} ج.م</span></div>
                        <div className="text-xs text-white/60 mt-1">رقم الطلب: <code className="font-mono text-[#e50914] bg-[#383333] px-1.5 py-0.5 rounded">{o.transaction_ref || o.id.slice(0, 8).toUpperCase()}</code></div>
                        {o.status === "rejected" && o.rejection_reason && <div className="text-xs text-red-400 mt-1">السبب: {o.rejection_reason}</div>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {o.status === "approved" && (
                          <Button size="sm" variant="outline" onClick={() => downloadReceipt(o)} className="rounded-xl border-[#484242] bg-[#383333] text-white hover:bg-[#443e3e] text-xs gap-1.5">
                            <Receipt className="h-3.5 w-3.5" /> طباعة الإيصال
                          </Button>
                        )}
                        <Badge className={`rounded-xl text-[11px] font-bold border ${st[o.status] || st.pending}`}>{sl[o.status] || sl.pending}</Badge>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings">
            <div className="max-w-lg space-y-5">
              <Card className="p-6 bg-[#2f2b2b] border border-[#443e3e] rounded-2xl text-white">
                <div className="text-xs font-bold text-[#e50914] uppercase tracking-wider mb-4">الصورة الشخصية</div>
                <div className="flex items-center gap-5">
                  <div className="relative shrink-0">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="h-20 w-20 rounded-2xl object-cover ring-2 ring-[#e50914]/50 ring-offset-2 ring-offset-[#252121]" />
                    ) : (
                      <div className="h-20 w-20 rounded-2xl bg-[#e50914] grid place-items-center text-3xl font-black text-white">{profile?.name?.[0] ?? "S"}</div>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="avatar-upload" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#e50914] to-[#b8050e] hover:from-[#d6004c] text-white text-xs sm:text-sm font-bold shadow-md transition-all">
                      {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                      {uploadingAvatar ? "جاري الرفع…" : "تغيير الصورة الشخصية"}
                    </Label>
                    <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={onPickAvatar} disabled={uploadingAvatar} />
                    <p className="text-xs text-white/50 mt-2">JPG أو PNG بحجم أقصى 3 ميجابايت</p>
                  </div>
                </div>
              </Card>
              <Card className="p-6 space-y-4 bg-[#2f2b2b] border border-[#443e3e] rounded-2xl text-white">
                <div className="text-xs font-bold text-[#e50914] uppercase tracking-wider">المعلومات الشخصية</div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-white/80">الاسم الكامل</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl bg-[#635d5d] text-white border-transparent focus:border-[#e50914]" placeholder="اسمك الكامل" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-white/80">البريد الإلكتروني</Label>
                  <Input value={profile?.email ?? ""} disabled className="h-11 rounded-xl bg-[#383333] text-white/40 cursor-not-allowed border-transparent" dir="ltr" />
                  <p className="text-[11px] text-white/40">لا يمكن تغيير البريد الإلكتروني المرتبط بالحساب</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-white/80">رقم الهاتف / الواتساب</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 rounded-xl bg-[#635d5d] text-white border-transparent focus:border-[#e50914]" placeholder="+20 1xxxxxxxxx" dir="ltr" />
                </div>
                <Button onClick={saveProfile} className="bg-gradient-to-r from-[#e50914] to-[#b8050e] hover:from-[#d6004c] text-white font-bold rounded-xl px-8 w-full sm:w-auto">
                  <CheckCircle2 className="ml-2 h-4 w-4" /> حفظ التغييرات
                </Button>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </SiteShell>
  );
}

function ExploreCourseCard({ c, isEn, t }: { c: any; isEn: boolean; t: any }) {
  const hasDiscount = c.discount_price && c.discount_price < c.price;
  const cTitle = (isEn && c.title_en) || c.title;
  const cShort = (isEn && c.short_description_en) || c.short_description;
  return (
    <Card className="overflow-hidden hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 group flex flex-col h-full bg-[#2f2b2b] border border-[#443e3e] hover:border-[#e50914]/50 rounded-2xl">
      <div className="relative aspect-video">
        {c.image_url ? (
          <img src={c.image_url} alt={cTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full bg-[#383333] grid place-items-center"><BookOpen className="h-8 w-8 text-white/40" /></div>
        )}
        {hasDiscount && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-[#e50914] text-white text-[10px] font-bold gap-1"><Tag className="h-2.5 w-2.5" /> خصم</Badge>
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-white text-[14px] line-clamp-2 group-hover:text-[#e50914] transition-colors mb-1">{cTitle}</h3>
        {cShort && <p className="text-xs text-white/60 line-clamp-2 mb-3 flex-1">{cShort}</p>}
        <div className="flex items-baseline gap-2 mb-3">
          {hasDiscount ? (
            <><span className="text-lg font-black text-[#5aca26]">{c.discount_price} ج.م</span><span className="text-xs text-white/40 line-through">{c.price}</span></>
          ) : (
            <span className="text-lg font-black text-[#5aca26]">{c.price} ج.م</span>
          )}
        </div>
        <Button asChild size="sm" className="bg-gradient-to-r from-[#e50914] to-[#b8050e] hover:from-[#d6004c] text-white font-bold rounded-xl w-full">
          <Link to="/checkout/$courseId" params={{ courseId: c.id }}>إشترك الآن</Link>
        </Button>
        <Button asChild size="sm" variant="ghost" className="mt-1.5 rounded-xl text-xs text-white/60 hover:text-white">
          <Link to="/courses/$slug" params={{ slug: c.slug || c.id }}>تفاصيل الدورة <ChevronLeft className="mr-1 h-3 w-3" /></Link>
        </Button>
      </div>
    </Card>
  );
}

function RedeemCodeCard({ onRedeemed }: { onRedeemed: () => void }) {
  const { t, isEn, dir } = useI18n();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [preview, setPreview] = useState<{ courseTitle?: string } | null>(null);

  const startRedeem = async () => {
    const c = code.trim();
    if (!c) { toast.error(t("dashboard.redeem.enterCode")); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("preview_access_code", { _code: c });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const res = (data ?? {}) as { ok?: boolean; error?: string; course_title?: string };
    if (!res.ok) {
      const msg = res.error === "invalid_code" ? t("dashboard.redeem.invalid") : res.error === "used_code" ? t("dashboard.redeem.used") : res.error === "not_authenticated" ? t("dashboard.redeem.notAuth") : t("dashboard.redeem.verifyFail");
      toast.error(msg); return;
    }
    const courseId = (data as any)?.course_id as string | undefined;
    const { data: { user: u } } = await supabase.auth.getUser();
    if (courseId && u) {
      const { data: existing } = await supabase.from("enrollments").select("id").eq("user_id", u.id).eq("course_id", courseId).eq("status", "active").maybeSingle();
      if (existing) { toast.error(t("dashboard.redeem.alreadyEnrolled")); return; }
    }
    setPreview({ courseTitle: res.course_title });
    setConfirmOpen(true);
  };

  const confirmRedeem = async () => {
    const c = code.trim();
    if (!c) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("redeem_access_code", { _code: c });
    setBusy(false);
    setConfirmOpen(false);
    if (error) { toast.error(error.message); return; }
    const res = (data ?? {}) as { ok?: boolean; error?: string };
    if (!res.ok) {
      toast.error(res.error === "invalid_code" ? t("dashboard.redeem.invalid") : res.error === "used_code" ? t("dashboard.redeem.used") : t("dashboard.redeem.activateFail")); return;
    }
    toast.success(t("dashboard.redeem.added"));
    setCode(""); setPreview(null);
    onRedeemed();
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-[#393434] bg-gradient-to-l from-[#221e1e] via-[#1c1818] to-[#1c1818] p-5 sm:p-6 shadow-xl hover:border-[#4d4646] transition-all duration-300 mb-8">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 md:gap-8">
          {/* Header Info */}
          <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
            <div className="grid h-12 w-12 sm:h-13 sm:w-13 place-items-center rounded-xl bg-[#e50914]/15 border border-[#e50914]/30 text-[#e50914] shadow-md shadow-[#e50914]/10 shrink-0">
              <KeyRound className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-base sm:text-lg text-white leading-snug">
                {isEn ? "Have an Enrollment or Gift Code?" : "لديك كود تفعيل أو كود وصول للكورس؟"}
              </h3>
              <p className="text-xs sm:text-sm text-white/60 mt-1 leading-relaxed">
                {isEn
                  ? "Enter your code below to instantly unlock your course with lifetime access."
                  : "أدخل الكود الخاص بك وسيتم فتح الكورس فوراً في حسابك مدى الحياة."}
              </p>
            </div>
          </div>

          {/* Input & Action Button */}
          <div className="w-full lg:w-auto lg:min-w-[360px] xl:min-w-[420px] shrink-0">
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-[#252121] p-1.5 rounded-xl border border-[#393434] focus-within:border-[#e50914]/80 focus-within:ring-1 focus-within:ring-[#e50914]/40 transition-all shadow-inner">
              <div className="relative flex-1">
                <Input
                  placeholder={isEn ? "ENTER CODE HERE..." : "ادخل كود التفعيل..."}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className={`font-mono h-10 border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm font-bold tracking-widest text-white placeholder:text-white/35 ${
                    dir === "rtl" ? "px-3 text-right" : "px-3 text-left"
                  }`}
                  onKeyDown={(e) => e.key === "Enter" && startRedeem()}
                />
              </div>
              <Button
                onClick={startRedeem}
                disabled={busy || !code.trim()}
                className="bg-[#e50914] hover:bg-[#c90812] active:scale-[0.98] text-white font-bold rounded-lg h-10 px-5 shadow-md shadow-[#e50914]/25 transition-all text-xs sm:text-sm shrink-0 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{isEn ? "Activate Code" : "تفعيل الكود"}</span>
                  </>
                )}
              </Button>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-white/45 mt-2 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#25D366]" />
              <span>{isEn ? "Instant activation for official academy and promotional codes" : "تفعيل فوري وتلقائي لكافة أكواد الأكاديمية والاشتراكات"}</span>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-2xl bg-[#1e1b1b] border-[#393434] text-white shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-white">
              <Gift className="h-5 w-5 text-[#f5c518]" />
              {t("dashboard.redeem.confirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-white/70 leading-relaxed mt-2">
              {t("dashboard.redeem.confirmPrefix")}{" "}
              <b className="text-white text-base font-bold underline decoration-[#e50914]">
                {preview?.courseTitle ?? "—"}
              </b>
              .<br />
              <span className="text-xs text-white/50 mt-1 block">
                {t("dashboard.redeem.warn")}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 mt-4">
            <AlertDialogCancel
              disabled={busy}
              className="rounded-xl border-[#393434] bg-[#252121] text-white hover:bg-[#2e2929] hover:text-white"
            >
              {t("dashboard.redeem.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmRedeem();
              }}
              disabled={busy}
              className="bg-[#e50914] hover:bg-[#c90812] text-white font-bold rounded-xl px-5"
            >
              {busy ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("dashboard.redeem.activating")}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> {t("dashboard.redeem.confirm")}
                </span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PaymentStatusBanner({ userId, orderRef, preferSlug, onApproved, onOpenCourse, onDismiss }: {
  userId: string; orderRef?: string; preferSlug?: string;
  onApproved: () => void; onOpenCourse: (slug: string) => void; onDismiss: () => void;
}) {
  const { t, isEn } = useI18n();
  const [state, setState] = useState<"checking" | "approved" | "pending" | "timeout">("checking");
  const [order, setOrder] = useState<any>(null);
  const [autoOpened, setAutoOpened] = useState(false);
  const checkOrderStatus = useServerFn(checkKashierOrderStatus);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 150;
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const tick = async () => {
      attempts++;
      let query = supabase.from("orders").select("*, courses(title, slug)").eq("user_id", userId);
      query = orderRef ? query.eq("transaction_ref", orderRef) : query.gte("created_at", since);
      const { data } = await query.order("created_at", { ascending: false }).limit(1);
      if (cancelled) return;
      const o = data?.[0];
      if (o && o.status === "approved") {
        const { data: ae } = await supabase.from("enrollments").select("id").eq("user_id", userId).eq("course_id", o.course_id).eq("status", "active").maybeSingle();
        if (cancelled) return;
        if (ae) { setOrder(o); setState("approved"); onApproved(); return; }
      }
      if (orderRef && o && o.status === "pending") {
        try {
          const res = await checkOrderStatus({ data: { orderRef } });
          if (cancelled) return;
          if (res?.ok) { setOrder(res.order ?? o); setState("approved"); onApproved(); return; }
        } catch { /* ignore */ }
      }
      if (o) setOrder(o);
      if (attempts >= maxAttempts) { setState(o ? "pending" : "timeout"); return; }
      setTimeout(tick, 2000);
    };
    tick();
    return () => { cancelled = true; };
  }, [userId, orderRef, onApproved, checkOrderStatus]);

  if (state === "checking") return (
    <Card className="p-4 mb-2 border-blue/30 bg-blue/5 flex items-center gap-3 rounded-2xl">
      <Loader2 className="h-5 w-5 animate-spin text-blue shrink-0" />
      <div><div className="font-bold text-primary">{t("dashboard.pay.checkingTitle")}</div><div className="text-sm text-muted-foreground">{t("dashboard.pay.checkingDesc")}</div></div>
    </Card>
  );

  if (state === "approved") {
    const slug = preferSlug || order?.courses?.slug;
    if (slug && !autoOpened) { setAutoOpened(true); setTimeout(() => onOpenCourse(slug), 1500); }
    const courseTitle = (isEn && order?.courses?.title_en) || order?.courses?.title;
    return (
      <Card className="p-4 mb-2 border-success/40 bg-success/8 flex items-center gap-3 rounded-2xl">
        <CheckCircle2 className="h-6 w-6 text-success shrink-0" />
        <div className="flex-1">
          <div className="font-bold text-success">{t("dashboard.pay.approvedTitle")}</div>
          <div className="text-sm text-muted-foreground">{courseTitle ? t("dashboard.pay.approvedDescNamed", { title: courseTitle }) : t("dashboard.pay.approvedDesc")}</div>
          {order?.transaction_ref && <div className="text-xs mt-1">{t("dashboard.orders.orderNo")} <code className="font-mono text-primary">{order.transaction_ref}</code></div>}
        </div>
        {slug && <Button size="sm" onClick={() => onOpenCourse(slug)} className="btn-gold-gradient text-gold-foreground font-bold rounded-full shrink-0">{t("dashboard.pay.openCourse")}</Button>}
        <Button size="sm" variant="ghost" onClick={onDismiss} className="shrink-0"><X className="h-4 w-4" /></Button>
      </Card>
    );
  }

  if (state === "pending") return (
    <Card className="p-4 mb-2 border-warning/40 bg-warning/8 flex items-start gap-3 rounded-2xl">
      <Clock className="h-6 w-6 text-warning shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="font-bold">{t("dashboard.pay.pendingTitle")}</div>
        <div className="text-sm text-muted-foreground mt-1">{t("dashboard.pay.pendingDesc")}</div>
        <div className="flex gap-2 mt-2">
          <Button size="sm" variant="outline" onClick={() => window.location.reload()} className="rounded-full">{t("dashboard.pay.refresh")}</Button>
          <Button size="sm" variant="ghost" onClick={onDismiss} className="rounded-full">{t("dashboard.pay.hide")}</Button>
        </div>
      </div>
    </Card>
  );

  return (
    <Card className="p-4 mb-2 border-destructive/30 bg-destructive/5 flex items-start gap-3 rounded-2xl">
      <Clock className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="font-bold">{t("dashboard.pay.timeoutTitle")}</div>
        <div className="text-sm text-muted-foreground mt-1">{t("dashboard.pay.timeoutDesc")}</div>
        <div className="flex gap-2 mt-2">
          <Button size="sm" variant="outline" onClick={() => window.location.reload()} className="rounded-full">{t("dashboard.pay.refresh")}</Button>
          <Button size="sm" variant="ghost" onClick={onDismiss} className="rounded-full">{t("dashboard.pay.hide")}</Button>
        </div>
      </div>
    </Card>
  );
}
