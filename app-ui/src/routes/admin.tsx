import { sendPlatformEmail } from "@/lib/transactional-email.functions";
import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { sendOrderInvoice } from "@/lib/invoice.functions";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CertificatePositionEditor } from "@/components/admin/CertificatePositionEditor";
import { CertificateLivePreview } from "@/components/admin/CertificateLivePreview";
import { CertificateTemplatePicker } from "@/components/admin/CertificateTemplatePicker";
import { DiscountsManager } from "@/components/admin/DiscountsManager";
import { useAuth } from "@/lib/auth";
import { SiteShell } from "@/components/layout/SiteShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  CheckCircle2,
  DollarSign,
  Film,
  Plus,
  Receipt,
  ShieldCheck,
  Tag,
  Trash2,
  Loader2,
  UserMinus,
  UserPlus,
  Users,
  XCircle,
  RefreshCw,
  Ban,
  ShieldOff,
  Bell,
  Circle,
  Send,
  Eye,
  EyeOff,
  Calendar,
  ClipboardCheck,
  MessageSquareX,
  GraduationCap,
  Pencil,
  LayoutDashboard,
  KeyRound,
  MessageCircle,
  Image as ImageIcon,
  Star,
  Smartphone,
  Menu,
  TrendingUp,
  LifeBuoy,
  Megaphone,
  Copy,
  ExternalLink,
  RotateCw,
  HelpCircle,
  UserX,
  Lock,
  FileDown,
  Search,
  LogOut,
  Headphones,
  Layers,
  Sparkles,
  X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import cloudMd from "../../cloud.md?raw";
import designSystemMd from "../../design-system.md?raw";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StudentWorksManager } from "@/components/admin/StudentWorksManager";
import { SuccessStoriesManager } from "@/components/admin/SuccessStoriesManager";
import { OrderAuditDialog } from "@/components/admin/OrderAuditDialog";
import { SecurePlayer } from "@/components/common/SecurePlayer";
import { PaymentE2ETestDialog } from "@/components/admin/PaymentE2ETestDialog";
import { useServerFn } from "@tanstack/react-start";
import { adminDeleteUser } from "@/lib/admin-users.functions";
import { invalidateCache } from "@/lib/cache";
import { translateFields } from "@/lib/translate.functions";
import { BroadcastAnnouncementManager } from "@/components/admin/BroadcastAnnouncementManager";
import { SeoManager } from "@/components/admin/SeoManager";
import { CategoryChipsManager } from "@/components/admin/CategoryChipsManager";


export const Route = createFileRoute("/admin")({
  codeSplitGroupings: [["loader", "component", "errorComponent", "notFoundComponent", "pendingComponent"]],
  ssr: false,
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/login", search: { redirect: "/admin" } });
    }
    const { data: isAdmin, error } = await supabase.rpc("has_role", {
      _user_id: session.user.id,
      _role: "admin",
    });
    if (error || isAdmin !== true) {
      if (error) console.error("[admin] has_role check failed", error);
      throw redirect({ to: "/" });
    }
  },
  component: AdminPage,
});

function AdminPage() {
  const { user, profile, isAdmin, loading, signOut } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState({ revenue: 0, users: 0, courses: 0, pending: 0 });
  const [orders, setOrders] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [revenueResetAt, setRevenueResetAt] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Instant search & status filters for fast daily operations
  const [orderStatusFilter, setOrderStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [courseSearch, setCourseSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState<"all" | "visible" | "hidden" | "latest">("all");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentFilter, setStudentFilter] = useState<"all" | "active" | "banned">("all");

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      toast.error("ليس لديك صلاحية الوصول");
      nav({ to: "/" });
    }
  }, [loading, user, isAdmin, nav]);

  // Simple in-memory cache to reduce load from rarely-changing RPCs
  // (list_admins, list_users_last_signin) and throttle visibility refreshes.
  const CACHE_TTL_MS = 5 * 60_000;
  const cacheRef = useRef<{
    admins?: { at: number; data: any };
    lastSignin?: { at: number; data: any };
    lastRefreshAt: number;
  }>({ lastRefreshAt: 0 });

  const refresh = async (opts: { force?: boolean } = {}) => {
    const now = Date.now();
    // Throttle full refresh to once per 60s unless forced.
    if (!opts.force && now - cacheRef.current.lastRefreshAt < 60_000) return;
    cacheRef.current.lastRefreshAt = now;

    const adminsCached =
      cacheRef.current.admins && now - cacheRef.current.admins.at < CACHE_TTL_MS
        ? cacheRef.current.admins.data
        : null;
    const signinCached =
      cacheRef.current.lastSignin && now - cacheRef.current.lastSignin.at < CACHE_TTL_MS
        ? cacheRef.current.lastSignin.data
        : null;

    const [oo, cc, uu, kk, aa, ll, en, rr] = await Promise.all([
      supabase
        .from("orders")
        .select("*, courses(title), profiles(name,email)")
        .order("created_at", { ascending: false }),
      supabase.from("courses").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("coupons").select("*").order("created_at", { ascending: false }),
      adminsCached
        ? Promise.resolve({ data: adminsCached, error: null } as any)
        : supabase.rpc("list_admins"),
      signinCached
        ? Promise.resolve({ data: signinCached, error: null } as any)
        : supabase.rpc("list_users_last_signin"),
      supabase
        .from("enrollments")
        .select("id,user_id,course_id,status,courses(title)"),
      supabase.from("app_settings").select("value").eq("key", "revenue_reset_at").maybeSingle(),
    ]);
    if (!adminsCached && aa && (aa as any).data)
      cacheRef.current.admins = { at: now, data: (aa as any).data };
    if (!signinCached && ll && (ll as any).data)
      cacheRef.current.lastSignin = { at: now, data: (ll as any).data };
    setOrders(oo.data ?? []);
    setCourses(cc.data ?? []);
    const signinMap: Record<string, string | null> = {};
    for (const r of (ll.data ?? []) as any[]) signinMap[r.user_id] = r.last_sign_in_at;
    const enrollByUser: Record<string, any[]> = {};
    for (const e of (en.data ?? []) as any[]) {
      (enrollByUser[e.user_id] ||= []).push(e);
    }
    setStudents(
      (uu.data ?? []).map((s: any) => ({
        ...s,
        last_sign_in_at: signinMap[s.id] ?? null,
        enrollments: enrollByUser[s.id] ?? [],
      })),
    );
    setCoupons(kk.data ?? []);
    setAdmins(aa.data ?? []);
    const resetAt = (rr.data?.value as any)?.at ?? null;
    setRevenueResetAt(resetAt);
    const resetTs = resetAt ? new Date(resetAt).getTime() : 0;
    const revenue = (oo.data ?? [])
      .filter((o: any) => o.status === "approved" && new Date(o.created_at).getTime() > resetTs)
      .reduce((s: number, o: any) => s + Number(o.amount), 0);
    setStats({
      revenue,
      users: uu.data?.length ?? 0,
      courses: cc.data?.length ?? 0,
      pending: (oo.data ?? []).filter((o: any) => o.status === "pending").length,
    });
  };

  const resetRevenue = async () => {
    if (!confirm("هل أنت متأكد من إعادة تعيين عدّاد الإيرادات إلى صفر؟ (لن يتم حذف أي طلبات)")) return;
    const { error } = await supabase.from("app_settings").upsert({
      key: "revenue_reset_at",
      value: { at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("تم إعادة تعيين عدّاد الإيرادات");
    refresh({ force: true });
  };

  useEffect(() => {
    if (isAdmin) refresh({ force: true });
  }, [isAdmin]);

  // Auto-refresh students/orders every 60s so "آخر نشاط" stays fresh
  useEffect(() => {
    if (!isAdmin) return;
    // Refresh every 5 min while visible; visibilitychange is throttled by refresh() itself.
    const tick = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const id = window.setInterval(tick, 5 * 60_000);
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [isAdmin]);

  // Realtime subscription on orders so new payment screenshots appear instantly
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  if (loading) {
    return (
      <SiteShell>
        <div className="container-page py-16 text-center text-muted-foreground">
          جاري تحميل صلاحيات الحساب…
        </div>
      </SiteShell>
    );
  }

  if (!isAdmin) return null;

  const reviewOrder = async (id: string, status: "approved" | "rejected", reason?: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status, rejection_reason: reason ?? null })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(status === "approved" ? "تم القبول" : "تم الرفض");
      if (status === "approved") {
        try {
          const res = await sendOrderInvoice({ data: { orderId: id } });
          if ((res as any)?.ok) toast.success("تم إرسال فاتورة للطالب");
        } catch (e) {
          console.error("invoice send failed", e);
        }
      }
      refresh();
    }
  };

  const getScreenshotUrl = async (path: string) => {
    const { data } = await supabase.storage.from("payment-screenshots").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const approvedOrdersCount = orders.filter((o) => o.status === "approved").length;
  const rejectedOrdersCount = orders.filter((o) => o.status === "rejected").length;
  const totalOrdersCount = orders.length;

  const filteredOrders = orders.filter((o) => {
    if (orderStatusFilter !== "all" && o.status !== orderStatusFilter) return false;
    const q = orderSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      String(o.courses?.title || "").toLowerCase().includes(q) ||
      String(o.profiles?.name || "").toLowerCase().includes(q) ||
      String(o.profiles?.email || "").toLowerCase().includes(q) ||
      String(o.transaction_ref || "").toLowerCase().includes(q)
    );
  });

  const filteredAdminCourses = courses.filter((c) => {
    if (courseFilter === "visible" && c.is_hidden) return false;
    if (courseFilter === "hidden" && !c.is_hidden) return false;
    if (courseFilter === "latest" && !c.is_latest) return false;
    const q = courseSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      String(c.title || "").toLowerCase().includes(q) ||
      String(c.category || "").toLowerCase().includes(q) ||
      String(c.slug || "").toLowerCase().includes(q)
    );
  });

  const filteredStudents = students.filter((s) => {
    if (studentFilter === "active" && s.banned) return false;
    if (studentFilter === "banned" && !s.banned) return false;
    const q = studentSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      String(s.name || "").toLowerCase().includes(q) ||
      String(s.email || "").toLowerCase().includes(q) ||
      String(s.phone || "").toLowerCase().includes(q)
    );
  });

  return (
    <div dir="rtl" className="min-h-screen bg-[#0f0e11] text-white">
      <AdminLayout
        activeTab={activeTab}
        onTabChange={(v) => {
          setActiveTab(v);
          setMobileNavOpen(false);
        }}
        mobileNavOpen={mobileNavOpen}
        onMobileToggle={() => setMobileNavOpen((s) => !s)}
        pendingCount={stats.pending}
        coursesCount={stats.courses}
        studentsCount={stats.users}
        adminName={profile?.name || user?.email || "مدير المنصة"}
        onRefresh={() => refresh({ force: true })}
        onSignOut={() => signOut().then(() => nav({ to: "/login" }))}
        newCourseSlot={<CourseDialog onSaved={() => refresh({ force: true })} />}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <TabsList className="sr-only">
            <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
            <TabsTrigger value="activity">النشاط الحالي</TabsTrigger>
            <TabsTrigger value="orders">الطلبات</TabsTrigger>
            <TabsTrigger value="courses">الكورسات</TabsTrigger>
            <TabsTrigger value="discounts">الخصومات</TabsTrigger>
            <TabsTrigger value="students">الطلاب</TabsTrigger>
            <TabsTrigger value="coupons">الكوبونات</TabsTrigger>
            <TabsTrigger value="codes">أكواد الدخول</TabsTrigger>
            <TabsTrigger value="admins">الأدمنز</TabsTrigger>
            <TabsTrigger value="outreach">الشات والإشعارات</TabsTrigger>
            <TabsTrigger value="works">أعمال الطلاب</TabsTrigger>
            <TabsTrigger value="success-stories">قصص النجاح</TabsTrigger>
            <TabsTrigger value="reviews">التقييمات</TabsTrigger>
            <TabsTrigger value="devices">الأجهزة</TabsTrigger>
            <TabsTrigger value="announcements">رسائل وتنبيهات المنصة</TabsTrigger>
            <TabsTrigger value="marketing">التسويق</TabsTrigger>
            <TabsTrigger value="seo">تحسين محركات البحث (SEO)</TabsTrigger>
            <TabsTrigger value="category-chips">أقسام الرئيسية</TabsTrigger>
          </TabsList>

          {/* ================================================================
              TAB 1: OVERVIEW COMMAND CENTER
             ================================================================ */}
          <TabsContent value="overview" className="space-y-6">
            {/* 4 Executive KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard
                icon={<DollarSign className="h-5 w-5" />}
                label="إجمالي الإيرادات المحققة"
                color="gold"
                value={`${stats.revenue.toLocaleString("ar-EG")} ج.م`}
                footer={
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-white/45">
                      {revenueResetAt
                        ? `منذ ${new Date(revenueResetAt).toLocaleDateString("ar-EG")}`
                        : `${approvedOrdersCount} طلب مكتمل`}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] ml-auto rounded-lg border-[#f5c518]/30 text-[#f5c518] hover:bg-[#f5c518] hover:text-black gap-1 cursor-pointer"
                      onClick={resetRevenue}
                    >
                      <RefreshCw className="h-3 w-3" /> تصفير العدّاد
                    </Button>
                  </div>
                }
              />
              <StatCard
                icon={<Receipt className="h-5 w-5" />}
                label="طلبات بانتظار المراجعة"
                value={stats.pending}
                highlight={stats.pending > 0}
                footer={
                  <button
                    type="button"
                    onClick={() => {
                      setOrderStatusFilter("pending");
                      setActiveTab("orders");
                    }}
                    className="text-xs font-bold text-[#f5c518] hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>فتح الطلبات المعلقة فوراً</span>
                  </button>
                }
              />
              <StatCard
                icon={<Users className="h-5 w-5" />}
                label="إجمالي الطلاب المسجلين"
                value={stats.users}
                color="blue"
                footer={
                  <button
                    type="button"
                    onClick={() => setActiveTab("students")}
                    className="text-xs font-bold text-sky-400 hover:underline cursor-pointer"
                  >
                    استعراض دليل الطلاب
                  </button>
                }
              />
              <StatCard
                icon={<BookOpen className="h-5 w-5" />}
                label="الكورسات المتاحة"
                value={stats.courses}
                color="success"
                footer={
                  <button
                    type="button"
                    onClick={() => setActiveTab("courses")}
                    className="text-xs font-bold text-emerald-400 hover:underline cursor-pointer"
                  >
                    إدارة المناهج والدروس
                  </button>
                }
              />
            </div>

            {/* Live Active Users Strip + Order Conversion Health */}
            <div className="grid xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2">
                <ActiveUsersPanel compact />
              </div>
              <Card className="p-5 rounded-2xl bg-[#161419] border-white/[0.08] flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-extrabold text-white/80">توزيع حالات الطلبات ({totalOrdersCount})</span>
                  <span className="text-[11px] text-emerald-400 font-bold">
                    {totalOrdersCount > 0 ? `${Math.round((approvedOrdersCount / totalOrdersCount) * 100)}% مقبول` : "—"}
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-white/[0.06] overflow-hidden flex">
                  {totalOrdersCount > 0 && (
                    <>
                      <div
                        style={{ width: `${(approvedOrdersCount / totalOrdersCount) * 100}%` }}
                        className="bg-emerald-500 h-full"
                        title={`مقبول: ${approvedOrdersCount}`}
                      />
                      <div
                        style={{ width: `${(stats.pending / totalOrdersCount) * 100}%` }}
                        className="bg-[#f5c518] h-full"
                        title={`معلق: ${stats.pending}`}
                      />
                      <div
                        style={{ width: `${(rejectedOrdersCount / totalOrdersCount) * 100}%` }}
                        className="bg-[#e50914] h-full"
                        title={`مرفوض: ${rejectedOrdersCount}`}
                      />
                    </>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] text-white/60 mt-3 pt-2 border-t border-white/[0.06]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> مقبول ({approvedOrdersCount})
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#f5c518]" /> معلق ({stats.pending})
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#e50914]" /> مرفوض ({rejectedOrdersCount})
                  </span>
                </div>
              </Card>
            </div>

            {/* Actionable Recent Orders + Quick Admin Shortcuts */}
            <div className="grid xl:grid-cols-12 gap-5">
              {/* Actionable Orders Queue (7 cols) */}
              <Card className="xl:col-span-7 p-5 rounded-2xl bg-[#161419] border-white/[0.08] shadow-xl">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.07]">
                  <div className="flex items-center gap-2.5 font-extrabold text-white text-sm">
                    <div className="p-2 rounded-xl bg-[#f5c518]/15 text-[#f5c518]">
                      <Receipt className="h-4 w-4" />
                    </div>
                    <div>
                      <div>أحدث الطلبات والتحويلات</div>
                      <div className="text-[11px] font-normal text-white/50">يمكنك القبول الفوري بضغطة واحدة من هنا</div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setActiveTab("orders")}
                    className="text-[#f5c518] hover:bg-[#f5c518]/10 text-xs rounded-xl h-8 px-3 font-bold cursor-pointer"
                  >
                    عرض كل الطلبات ({orders.length})
                  </Button>
                </div>

                {orders.length === 0 ? (
                  <div className="text-sm text-white/45 text-center py-10">لا توجد طلبات مسجلة حتى الآن</div>
                ) : (
                  <ul className="space-y-2.5">
                    {orders.slice(0, 6).map((o: any) => (
                      <li
                        key={o.id}
                        className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/15 transition-all"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs sm:text-sm font-bold text-white truncate">
                            {String(o.courses?.title || "كورس غير محدد").replace(/\*\*/g, "")}
                          </div>
                          <div className="text-[11px] text-white/55 truncate mt-0.5">
                            {o.profiles?.name || "طالب"} • <span dir="ltr">{o.profiles?.email}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-black text-[#f5c518]">{o.amount} ج.م</span>
                          {o.payment_screenshot_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => getScreenshotUrl(o.payment_screenshot_url)}
                              className="h-7 px-2.5 text-[11px] rounded-lg bg-white/[0.04] border-white/10 text-white hover:bg-white/10 cursor-pointer"
                            >
                              <Eye className="w-3 h-3 ml-1 text-[#f5c518]" /> الإيصال
                            </Button>
                          )}
                          {o.status === "pending" ? (
                            <Button
                              size="sm"
                              onClick={() => reviewOrder(o.id, "approved")}
                              className="h-7 px-2.5 text-[11px] rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                            >
                              <CheckCircle2 className="w-3 h-3 ml-1" /> قبول
                            </Button>
                          ) : (
                            <Badge
                              className={`rounded-full text-[10px] font-bold px-2.5 py-0.5 border ${
                                o.status === "approved"
                                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                  : "bg-[#e50914]/15 text-[#ff6b72] border-[#e50914]/30"
                              }`}
                            >
                              {o.status === "approved" ? "مقبول ✓" : "مرفوض"}
                            </Badge>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* Visual Quick-Launch Grid (5 cols) */}
              <Card className="xl:col-span-5 p-5 rounded-2xl bg-[#161419] border-white/[0.08] shadow-xl">
                <div className="flex items-center gap-2.5 font-extrabold text-white text-sm mb-4 pb-3 border-b border-white/[0.07]">
                  <div className="p-2 rounded-xl bg-[#e50914]/15 text-[#e50914]">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <div>الوصول السريع للأدوات</div>
                    <div className="text-[11px] font-normal text-white/50">أهم أدوات الإدارة اليومية</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: "مراجعة الطلبات", sub: `${stats.pending} بانتظارك`, icon: Receipt, tab: "orders", urgent: stats.pending > 0 },
                    { label: "إدارة الكورسات", sub: `${stats.courses} دورات`, icon: BookOpen, tab: "courses" },
                    { label: "أكواد التفعيل", sub: "توليد أكواد فورية", icon: KeyRound, tab: "codes" },
                    { label: "الكوبونات والخصم", sub: `${coupons.length} كوبون`, icon: Tag, tab: "coupons" },
                    { label: "أعمال الطلاب", sub: "معرض الفيديو", icon: Film, tab: "works" },
                    { label: "التنبيهات العامة", sub: "رسائل المنصة", icon: Bell, tab: "announcements" },
                  ].map((s) => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.tab}
                        type="button"
                        onClick={() => setActiveTab(s.tab)}
                        className={`text-right p-3.5 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                          s.urgent
                            ? "bg-[#e50914]/15 border-[#e50914]/60 hover:bg-[#e50914]/25"
                            : "bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.07] hover:border-white/20"
                        }`}
                      >
                        <div className={`p-2 rounded-lg shrink-0 ${s.urgent ? "bg-[#e50914] text-white" : "bg-white/[0.06] text-[#f5c518]"}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-white truncate">{s.label}</div>
                          <div className="text-[11px] text-white/50 truncate mt-0.5">{s.sub}</div>
                        </div>
                      </button>
                    );
                  })}

                  <Link
                    to="/admin/support"
                    className="text-right p-3.5 rounded-xl border bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.07] hover:border-white/20 transition-all flex items-start gap-3"
                  >
                    <div className="p-2 rounded-lg bg-sky-500/15 text-sky-400 shrink-0">
                      <Headphones className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-white truncate">صندوق الدعم</div>
                      <div className="text-[11px] text-white/50 truncate mt-0.5">محادثات الزوار</div>
                    </div>
                  </Link>

                  <Link
                    to="/admin/lesson-blocks"
                    className="text-right p-3.5 rounded-xl border bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.07] hover:border-white/20 transition-all flex items-start gap-3"
                  >
                    <div className="p-2 rounded-lg bg-amber-500/15 text-amber-400 shrink-0">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-white truncate">قفل المحاضرات</div>
                      <div className="text-[11px] text-white/50 truncate mt-0.5">تحكم مخصص</div>
                    </div>
                  </Link>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* ================================================================
              TAB 2: ORDERS & TRANSFERS (WITH INSTANT SEARCH & STATUS PILLS)
             ================================================================ */}
          <TabsContent value="orders" className="space-y-4">
            <Card className="p-4 rounded-2xl bg-[#161419] border-white/[0.08] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Status Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: "all", label: `الكل (${orders.length})` },
                  { id: "pending", label: `⏳ معلق (${stats.pending})` },
                  { id: "approved", label: `✅ مقبول (${approvedOrdersCount})` },
                  { id: "rejected", label: `❌ مرفوض (${rejectedOrdersCount})` },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setOrderStatusFilter(pill.id as any)}
                    className={`h-9 px-3.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      orderStatusFilter === pill.id
                        ? "bg-[#e50914] text-white shadow-md shadow-[#e50914]/25"
                        : "bg-white/[0.04] text-white/70 hover:bg-white/[0.09] border border-white/[0.07]"
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              {/* Search + E2E Test */}
              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                <div className="relative flex-1 sm:w-64">
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="بحث بالطالب، الإيميل، الكورس، المرجع..."
                    className="w-full h-9 pr-9 pl-3 rounded-xl bg-white/[0.05] border border-white/10 focus:border-[#e50914] text-xs text-white placeholder-white/40 outline-none"
                  />
                  <Search className="w-3.5 h-3.5 text-white/40 absolute right-3 top-2.5 pointer-events-none" />
                </div>
                <PaymentE2ETestDialog
                  courses={courses.map((c: any) => ({ id: c.id, title: c.title, slug: c.slug }))}
                />
              </div>
            </Card>

            {filteredOrders.length === 0 ? (
              <Card className="p-10 text-center text-white/50 border-dashed border-white/15 bg-[#161419] rounded-2xl">
                لا توجد طلبات مطابقة للفلتر الحالي
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((o) => (
                  <Card
                    key={o.id}
                    className={`p-5 rounded-2xl transition-all bg-[#161419] border ${
                      o.status === "pending"
                        ? "border-[#f5c518]/50 ring-1 ring-[#f5c518]/20"
                        : o.status === "approved"
                        ? "border-emerald-500/25"
                        : "border-[#e50914]/25"
                    }`}
                  >
                    <div className="flex flex-wrap justify-between gap-4 items-start">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                          <Badge
                            className={`rounded-full text-[11px] font-bold px-2.5 py-0.5 border shrink-0 ${
                              o.status === "approved"
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                : o.status === "rejected"
                                ? "bg-[#e50914]/15 text-[#ff6b72] border-[#e50914]/30"
                                : "bg-[#f5c518]/20 text-[#f5c518] border-[#f5c518]/30 animate-pulse"
                            }`}
                          >
                            {o.status === "approved" ? "✅ مقبول" : o.status === "rejected" ? "❌ مرفوض" : "⏳ بانتظار المراجعة"}
                          </Badge>
                          <div className="font-extrabold text-base text-white truncate">
                            {String(o.courses?.title || "كورس غير محدد").replace(/\*\*/g, "")}
                          </div>
                        </div>
                        <div className="text-xs sm:text-sm text-white/75 font-medium">
                          {o.profiles?.name || "طالب"} — <span className="text-white/50" dir="ltr">{o.profiles?.email}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-white/60">
                          <span>المبلغ: <span className="font-bold text-[#f5c518]">{o.amount} ج.م</span></span>
                          <span>•</span>
                          <span>وسيلة الدفع: <span className="text-white/85 font-semibold">{o.payment_method || "تحويل"}</span></span>
                          <span>•</span>
                          <span>التاريخ: <span className="text-white/75">{new Date(o.created_at).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}</span></span>
                          {o.transaction_ref && (
                            <>
                              <span>•</span>
                              <span>المرجع: <code className="font-mono bg-black/40 text-[#f5c518] px-1.5 py-0.5 rounded border border-white/10">{o.transaction_ref}</code></span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 items-center flex-wrap shrink-0">
                        {o.payment_screenshot_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl gap-1.5 text-xs bg-white/[0.04] border-white/15 text-white hover:bg-white/10 cursor-pointer"
                            onClick={() => getScreenshotUrl(o.payment_screenshot_url)}
                          >
                            <Eye className="h-3.5 w-3.5 text-[#f5c518]" /> صورة الإيصال
                          </Button>
                        )}
                        {o.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 gap-1.5 font-bold cursor-pointer"
                              onClick={() => reviewOrder(o.id, "approved")}
                            >
                              <CheckCircle2 className="h-4 w-4" /> قبول وتفعيل الكورس
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="rounded-xl bg-[#e50914] text-white hover:bg-[#c80812] gap-1.5 font-bold cursor-pointer"
                              onClick={() => {
                                const reason = prompt("سبب الرفض (اختياري):") ?? "بيانات التحويل غير مطابقة";
                                reviewOrder(o.id, "rejected", reason);
                              }}
                            >
                              <XCircle className="h-4 w-4" /> رفض
                            </Button>
                          </>
                        )}
                        <EditOrderDialog order={o} onSaved={() => refresh({ force: true })} />
                        <OrderAuditDialog orderId={o.id} />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ================================================================
              TAB 3: COURSES & CURRICULUM MANAGER
             ================================================================ */}
          <TabsContent value="courses" className="space-y-4">
            <Card className="p-4 rounded-2xl bg-[#161419] border-white/[0.08] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: "all", label: `الكل (${courses.length})` },
                  { id: "visible", label: `ظاهر بالموقع (${courses.filter((c) => !c.is_hidden).length})` },
                  { id: "hidden", label: `مخفي (${courses.filter((c) => c.is_hidden).length})` },
                  { id: "latest", label: `⭐ ضمن الأحدث (${courses.filter((c) => c.is_latest).length})` },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setCourseFilter(pill.id as any)}
                    className={`h-9 px-3.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      courseFilter === pill.id
                        ? "bg-[#e50914] text-white"
                        : "bg-white/[0.04] text-white/70 hover:bg-white/[0.09] border border-white/[0.07]"
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                <div className="relative flex-1 sm:w-64">
                  <input
                    type="text"
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    placeholder="ابحث باسم الكورس أو التصنيف..."
                    className="w-full h-9 pr-9 pl-3 rounded-xl bg-white/[0.05] border border-white/10 focus:border-[#e50914] text-xs text-white placeholder-white/40 outline-none"
                  />
                  <Search className="w-3.5 h-3.5 text-white/40 absolute right-3 top-2.5 pointer-events-none" />
                </div>
                <CourseDialog onSaved={() => refresh({ force: true })} />
              </div>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              {filteredAdminCourses.map((c) => (
                <Card
                  key={c.id}
                  className="p-5 rounded-2xl bg-[#161419] border-white/[0.08] hover:border-white/20 shadow-xl flex flex-col gap-4 overflow-hidden transition-all"
                >
                  <div className="flex gap-4 items-start">
                    {c.image_url ? (
                      <img
                        src={c.image_url}
                        className="w-28 h-20 rounded-xl object-cover shrink-0 border border-white/10 shadow-md"
                        alt=""
                      />
                    ) : (
                      <div className="w-28 h-20 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0 text-white/40">
                        <BookOpen className="h-7 w-7" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-extrabold text-white text-base leading-snug line-clamp-2">
                        {String(c.title || "").replace(/\*\*/g, "")}
                      </div>
                      <div className="text-xs text-white/60 mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-white/85 bg-white/[0.05] px-2 py-0.5 rounded-md">{c.category || "عام"}</span>
                        <span className="font-black text-[#f5c518]">{c.discount_price ?? c.price} ج.م</span>
                        {c.discount_price != null && Number(c.discount_price) < Number(c.price) && (
                          <span className="line-through text-white/35">{c.price} ج.م</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10.5px] font-bold">
                          {c.status === "published" ? "منشور" : "مسودة"}
                        </Badge>
                        {c.is_hidden && (
                          <Badge variant="outline" className="border-[#e50914]/40 text-[#ff6b72] bg-[#e50914]/10 text-[10.5px]">
                            مخفي من العرض العام
                          </Badge>
                        )}
                        {c.is_latest && (
                          <Badge className="bg-[#f5c518]/20 text-[#f5c518] border border-[#f5c518]/40 text-[10.5px]">
                            ⭐ ضمن الأحدث
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Primary Curriculum & Live Actions */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3 border-t border-white/[0.07]">
                    <Button
                      asChild
                      size="sm"
                      className="bg-gradient-to-r from-[#e50914] to-[#b80710] hover:from-[#ff1f2a] hover:to-[#d10813] text-white font-bold rounded-xl gap-1.5 col-span-2 sm:col-span-1"
                    >
                      <Link to="/admin/courses/$courseId" params={{ courseId: c.id }}>
                        <Film className="h-3.5 w-3.5" />
                        <span className="text-xs">الدروس والفيديوهات</span>
                      </Link>
                    </Button>

                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="rounded-xl border-white/10 bg-white/[0.04] hover:bg-white/[0.1] text-white gap-1.5"
                    >
                      <Link to="/admin/course-sessions/$courseId" params={{ courseId: c.id }}>
                        <Calendar className="h-3.5 w-3.5 text-[#f5c518]" />
                        <span className="text-xs">الجلسات المباشرة</span>
                      </Link>
                    </Button>

                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="rounded-xl border-white/10 bg-white/[0.04] hover:bg-white/[0.1] text-white gap-1.5"
                    >
                      <Link to="/admin/attendance/$courseId" params={{ courseId: c.id }}>
                        <ClipboardCheck className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-xs">الحضور والشهادات</span>
                      </Link>
                    </Button>
                  </div>

                  {/* Secondary Quick Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-white/[0.05]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <CourseDialog course={c} onSaved={() => refresh({ force: true })} />
                      <Button
                        size="sm"
                        variant="outline"
                        className={`h-8 rounded-lg text-xs gap-1 cursor-pointer ${
                          c.is_latest
                            ? "bg-[#f5c518]/20 border-[#f5c518]/50 text-[#f5c518]"
                            : "border-white/10 bg-white/[0.03] text-white/75"
                        }`}
                        onClick={async () => {
                          const { error } = await supabase
                            .from("courses")
                            .update({ is_latest: !c.is_latest })
                            .eq("id", c.id);
                          if (error) toast.error(error.message);
                          else {
                            toast.success(!c.is_latest ? "أُضيف لقسم الأحدث" : "أُزيل من قسم الأحدث");
                            refresh({ force: true });
                          }
                        }}
                      >
                        <Star className={`h-3.5 w-3.5 ${c.is_latest ? "fill-current" : ""}`} />
                        <span>الأحدث</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg text-xs gap-1 border-white/10 bg-white/[0.03] text-white/75 cursor-pointer"
                        onClick={async () => {
                          const { error } = await supabase
                            .from("courses")
                            .update({ is_hidden: !c.is_hidden })
                            .eq("id", c.id);
                          if (error) toast.error(error.message);
                          else {
                            toast.success(!c.is_hidden ? "تم إخفاء الكورس" : "تم إظهار الكورس");
                            refresh({ force: true });
                          }
                        }}
                      >
                        {c.is_hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        <span>{c.is_hidden ? "إظهار" : "إخفاء"}</span>
                      </Button>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                        title="نسخ رابط الدراسة المباشر"
                        onClick={() => {
                          const url = `${window.location.origin}/learn/${encodeURIComponent(c.slug || c.id)}`;
                          navigator.clipboard.writeText(url);
                          toast.success("تم نسخ رابط الدراسة");
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button asChild size="icon" variant="ghost" className="h-8 w-8" title="معاينة صفحة الكورس">
                        <Link to="/courses/$slug" params={{ slug: c.slug || c.id }} target="_blank">
                          <ExternalLink className="h-3.5 w-3.5 text-white/60 hover:text-white" />
                        </Link>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 cursor-pointer"
                        title="حذف الكورس"
                        onClick={async () => {
                          if (!confirm("حذف الكورس نهائياً؟")) return;
                          const { error } = await supabase.from("courses").delete().eq("id", c.id);
                          if (error) toast.error(error.message);
                          else {
                            toast.success("تم حذف الكورس");
                            refresh({ force: true });
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="discounts">
            <DiscountsManager />
          </TabsContent>

          {/* ================================================================
              TAB 4: STUDENTS DIRECTORY (WITH INSTANT SEARCH & STATUS FILTER)
             ================================================================ */}
          <TabsContent value="students" className="space-y-4">
            <DeviceLimitCard />

            <Card className="p-4 rounded-2xl bg-[#161419] border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {[
                  { id: "all", label: `كل الطلاب (${students.length})` },
                  { id: "active", label: `نشط (${students.filter((s) => !s.banned).length})` },
                  { id: "banned", label: `محظور (${students.filter((s) => s.banned).length})` },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setStudentFilter(pill.id as any)}
                    className={`h-9 px-3.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      studentFilter === pill.id
                        ? "bg-[#e50914] text-white"
                        : "bg-white/[0.04] text-white/70 hover:bg-white/[0.09] border border-white/[0.07]"
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="ابحث بالاسم، البريد، أو رقم الموبايل..."
                  className="w-full h-9 pr-9 pl-3 rounded-xl bg-white/[0.05] border border-white/10 focus:border-[#e50914] text-xs text-white placeholder-white/40 outline-none"
                />
                <Search className="w-3.5 h-3.5 text-white/40 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </Card>

            <Card className="rounded-2xl bg-[#161419] border-white/[0.08] shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[760px]">
                  <thead className="bg-white/[0.04] text-white/70 border-b border-white/[0.08]">
                    <tr>
                      <th className="p-3.5 text-right font-bold text-xs">الطالب</th>
                      <th className="p-3.5 text-right font-bold text-xs">التواصل</th>
                      <th className="p-3.5 text-right font-bold text-xs">الاشتراكات</th>
                      <th className="p-3.5 text-right font-bold text-xs">آخر نشاط</th>
                      <th className="p-3.5 text-right font-bold text-xs">الحالة</th>
                      <th className="p-3.5 text-left w-64 font-bold text-xs">إجراءات التحكم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {filteredStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-white/[0.025] transition-colors">
                        <td className="p-3.5">
                          <div className="font-bold text-white">{s.name || "—"}</div>
                          <div className="text-[11px] text-white/45 mt-0.5">
                            انضم {new Date(s.created_at).toLocaleDateString("ar-EG")}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="text-white/85 font-mono text-xs" dir="ltr">{s.email}</div>
                          <div className="text-white/50 text-xs mt-0.5" dir="ltr">{s.phone ?? "—"}</div>
                        </td>
                        <td className="p-3.5">
                          <Badge className="bg-white/[0.06] text-white/85 border border-white/10 text-[11px]">
                            {(s.enrollments?.length || 0)} كورسات
                          </Badge>
                        </td>
                        <td className="p-3.5 text-white/60 text-xs font-mono" dir="ltr">
                          {s.last_active_at
                            ? new Date(s.last_active_at).toLocaleString("ar-EG", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "—"}
                        </td>
                        <td className="p-3.5">
                          {s.banned ? (
                            <Badge className="bg-[#e50914] text-white text-[11px] font-bold">محظور</Badge>
                          ) : (
                            <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">
                              نشط
                            </Badge>
                          )}
                        </td>
                        <td className="p-3.5">
                          <div className="flex flex-wrap gap-1.5 justify-end">
                            <CourseBanDialog student={s} courses={courses} onChanged={() => refresh({ force: true })} />
                            <ResetDevicesButton student={s} onChanged={() => refresh({ force: true })} />
                            <BanToggleButton student={s} adminId={user?.id} onChanged={() => refresh({ force: true })} />
                            <DeleteUserButton student={s} onChanged={() => refresh({ force: true })} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="coupons">
            <CouponForm onCreated={() => refresh({ force: true })} />
            <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {coupons.map((c) => (
                <Card key={c.id} className="p-4 rounded-2xl bg-[#161419] border-white/[0.08]">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="font-bold flex items-center gap-2 text-white">
                        <Tag className="h-4 w-4 text-[#f5c518] shrink-0" />
                        <span className="truncate font-mono">{c.code}</span>
                      </div>
                      <div className="text-sm text-[#f5c518] font-bold mt-1">
                        {c.discount_type === "percentage" ? `خصم ${c.discount_value}%` : `خصم ${c.discount_value} ج.م`}
                      </div>
                      <div className="text-xs text-white/50 mt-0.5">استُخدم {c.usage_count} مرة</div>
                    </div>
                    <Badge variant={c.active ? "default" : "secondary"}>
                      {c.active ? "نشط" : "موقوف"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={c.active}
                        onCheckedChange={async (val) => {
                          const { error } = await supabase.from("coupons").update({ active: val }).eq("id", c.id);
                          if (error) toast.error(error.message);
                          else {
                            toast.success(val ? "تم التفعيل" : "تم الإيقاف");
                            refresh({ force: true });
                          }
                        }}
                      />
                      <span className="text-xs text-white/60">{c.active ? "مفعّل" : "موقوف"}</span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm(`حذف الكوبون "${c.code}"؟`)) return;
                        const { error } = await supabase.from("coupons").delete().eq("id", c.id);
                        if (error) toast.error(error.message);
                        else {
                          toast.success("تم الحذف");
                          refresh({ force: true });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="admins">
            <AdminsManager admins={admins} currentUserId={user?.id} onChanged={() => refresh({ force: true })} />
          </TabsContent>

          <TabsContent value="codes">
            <AccessCodesPanel courses={courses} />
          </TabsContent>

          <TabsContent value="outreach">
            <OutreachPanel students={students} courses={courses} adminId={user?.id} />
          </TabsContent>

          <TabsContent value="works">
            <StudentWorksManager />
          </TabsContent>

          <TabsContent value="success-stories">
            <SuccessStoriesManager />
          </TabsContent>

          <TabsContent value="reviews">
            <ReviewsModeration />
          </TabsContent>

          <TabsContent value="devices">
            <DevicesPanel />
          </TabsContent>

          <TabsContent value="activity">
            <ActiveUsersPanel />
          </TabsContent>

          <TabsContent value="marketing">
            <MetaMarketingCard />
          </TabsContent>

          <TabsContent value="announcements">
            <BroadcastAnnouncementManager />
          </TabsContent>

          <TabsContent value="seo">
            <SeoManager />
          </TabsContent>

          <TabsContent value="category-chips">
            <CategoryChipsManager />
          </TabsContent>
        </Tabs>
      </AdminLayout>
    </div>
  );
}

const ADMIN_NAV_GROUPS: {
  title: string;
  items: { value: string; label: string; icon: any; badge?: "pending" | "courses" | "students"; href?: string }[];
}[] = [
  {
    title: "القيادة والإحصائيات",
    items: [
      { value: "overview", label: "نظرة عامة سريعة", icon: LayoutDashboard },
      { value: "activity", label: "المتواجدون الآن مباشرة", icon: Circle },
    ],
  },
  {
    title: "المبيعات والطلاب",
    items: [
      { value: "orders", label: "الطلبات والتحويلات", icon: Receipt, badge: "pending" },
      { value: "students", label: "دليل الطلاب والمشتركين", icon: Users, badge: "students" },
      { value: "devices", label: "أجهزة وجلسات الطلاب", icon: Smartphone },
      { value: "balance-notifications", label: "تذكيرات المبالغ المتبقية", icon: DollarSign, href: "/admin/balance-notifications" },
      { value: "inactive-users", label: "الطلاب غير النشطين", icon: UserX, href: "/admin/inactive-users" },
      { value: "lesson-blocks", label: "قفل المحاضرات المخصص", icon: Lock, href: "/admin/lesson-blocks" },
    ],
  },
  {
    title: "الكورسات والعروض",
    items: [
      { value: "courses", label: "إدارة الكورسات والمناهج", icon: BookOpen, badge: "courses" },
      { value: "codes", label: "أكواد التفعيل المباشرة", icon: KeyRound },
      { value: "coupons", label: "كوبونات الخصم", icon: Tag },
      { value: "discounts", label: "عروض الباقات والخصومات", icon: Layers },
      { value: "category-chips", label: "تصنيفات الصفحة الرئيسية", icon: Sparkles },
    ],
  },
  {
    title: "الدعم والتسويق والمحتوى",
    items: [
      { value: "support-inbox", label: "صندوق محادثات الدعم", icon: Headphones, href: "/admin/support" },
      { value: "announcements", label: "النوافذ والتنبيهات العامة", icon: Bell },
      { value: "outreach", label: "الإشعارات الجماعية للطلاب", icon: MessageCircle },
      { value: "works", label: "معرض فيديوهات الطلاب", icon: Film },
      { value: "success-stories", label: "قصص النجاح وسكرينات الشات", icon: ImageIcon },
      { value: "reviews", label: "مراجعة تقييمات الطلاب", icon: Star },
      { value: "faqs", label: "الأسئلة الشائعة (FAQ)", icon: HelpCircle, href: "/admin/faqs" },
      { value: "help", label: "فيديوهات مركز المساعدة", icon: LifeBuoy, href: "/admin/help" },
      { value: "seo", label: "إعدادات محركات البحث SEO", icon: Search },
      { value: "marketing", label: "Meta Pixel & الكتالوج", icon: Megaphone },
    ],
  },
  {
    title: "فريق الإدارة",
    items: [
      { value: "admins", label: "المدراء والمشرفون", icon: ShieldCheck },
    ],
  },
];

function downloadCloudMd() {
  const blob = new Blob([cloudMd], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "README-architecture.md";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success("تم تنزيل دليل البنية التقنية");
}

function downloadDesignSystemMd() {
  const blob = new Blob([designSystemMd], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "design-system.md";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success("تم تنزيل دليل التصميم");
}

function AdminLayout({
  activeTab,
  onTabChange,
  mobileNavOpen,
  onMobileToggle,
  pendingCount,
  coursesCount,
  studentsCount,
  adminName,
  onRefresh,
  onSignOut,
  newCourseSlot,
  children,
}: {
  activeTab: string;
  onTabChange: (v: string) => void;
  mobileNavOpen: boolean;
  onMobileToggle: () => void;
  pendingCount: number;
  coursesCount: number;
  studentsCount: number;
  adminName: string;
  onRefresh: () => void;
  onSignOut: () => void;
  newCourseSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [navFilter, setNavFilter] = useState("");
  const activeItem = ADMIN_NAV_GROUPS.flatMap((g) => g.items).find((i) => i.value === activeTab);
  const activeLabel = activeItem?.label ?? "لوحة الإدارة";
  const ActiveIcon = activeItem?.icon ?? LayoutDashboard;

  const filteredGroups = ADMIN_NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((it) => !navFilter.trim() || it.label.toLowerCase().includes(navFilter.trim().toLowerCase())),
  })).filter((g) => g.items.length > 0);

  const NavContent = (
    <div className="flex flex-col h-full">
      {/* Sidebar Search */}
      <div className="relative mb-4">
        <input
          type="text"
          value={navFilter}
          onChange={(e) => setNavFilter(e.target.value)}
          placeholder="ابحث في أدوات الإدارة..."
          className="w-full h-9 pr-9 pl-7 rounded-xl bg-white/[0.05] border border-white/10 focus:border-[#e50914] text-xs text-white placeholder-white/40 outline-none"
        />
        <Search className="w-3.5 h-3.5 text-white/40 absolute right-3 top-2.5 pointer-events-none" />
        {navFilter && (
          <button
            type="button"
            onClick={() => setNavFilter("")}
            className="absolute left-2.5 top-2.5 text-white/40 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Scrollable Nav Groups */}
      <nav className="space-y-5 flex-1 overflow-y-auto pl-1">
        {filteredGroups.map((group) => (
          <div key={group.title}>
            <div className="px-2.5 mb-1.5 text-[10.5px] uppercase tracking-wider text-white/40 font-extrabold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#e50914]" />
              <span>{group.title}</span>
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.value;
                const badgeVal =
                  item.badge === "pending" && pendingCount > 0
                    ? pendingCount
                    : item.badge === "courses"
                    ? coursesCount
                    : item.badge === "students"
                    ? studentsCount
                    : null;

                if (item.href) {
                  return (
                    <li key={item.value}>
                      <Link
                        to={item.href as any}
                        className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/[0.06] hover:text-white transition-all"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-white/45" />
                        <span className="flex-1 text-right truncate">{item.label}</span>
                        <ExternalLink className="h-3 w-3 text-white/25" />
                      </Link>
                    </li>
                  );
                }

                return (
                  <li key={item.value}>
                    <button
                      type="button"
                      onClick={() => onTabChange(item.value)}
                      className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs transition-all cursor-pointer ${
                        active
                          ? "bg-gradient-to-l from-[#e50914] to-[#b80710] text-white font-extrabold shadow-md shadow-[#e50914]/25"
                          : "text-white/75 font-semibold hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-white/50"}`} />
                      <span className="flex-1 text-right truncate">{item.label}</span>
                      {badgeVal !== null && (
                        <span
                          className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                            item.badge === "pending"
                              ? active
                                ? "bg-white text-[#e50914]"
                                : "bg-[#e50914] text-white animate-pulse"
                              : "bg-white/10 text-white/80"
                          }`}
                        >
                          {badgeVal}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom Utility Links */}
      <div className="mt-4 pt-3 border-t border-white/10 space-y-1">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/[0.03] mb-1">
          <div className="w-7 h-7 rounded-full bg-[#e50914] text-white text-xs font-bold flex items-center justify-center shrink-0">
            م
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-white truncate">{adminName}</div>
            <div className="text-[10px] text-emerald-400">● صلاحية مدير كامل</div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            title="تسجيل الخروج"
            className="p-1.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={downloadCloudMd}
            className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] text-white/50 hover:bg-white/5 hover:text-white cursor-pointer"
          >
            <FileDown className="h-3 w-3" /> <span>دليل النظام</span>
          </button>
          <button
            type="button"
            onClick={downloadDesignSystemMd}
            className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] text-white/50 hover:bg-white/5 hover:text-white cursor-pointer"
          >
            <FileDown className="h-3 w-3" /> <span>الهوية البصرية</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-4 sm:py-5">
      <div className="grid lg:grid-cols-[270px_minmax(0,1fr)] gap-5 items-start">
        {/* Sticky Full-Height Scrollable Sidebar */}
        <aside className="hidden lg:block sticky top-4 h-[calc(100vh-2rem)]">
          <div className="h-full rounded-2xl bg-[#161419] p-4 shadow-2xl border border-white/[0.08] flex flex-col">
            <div className="flex items-center gap-3 mb-4 pb-3.5 border-b border-white/[0.08]">
              <Link to="/" className="shrink-0 group" title="العودة للموقع الرئيسي">
                <img src="/logo.png" alt="Idea Courses" className="h-9 w-auto object-contain" />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black text-white truncate">مركز القيادة</div>
                <div className="text-[10.5px] text-white/45 truncate">إدارة منصة Idea Courses</div>
              </div>
            </div>
            <div className="flex-1 min-h-0">{NavContent}</div>
          </div>
        </aside>

        {/* Main Workspace Column */}
        <div className="min-w-0 space-y-5">
          {/* Executive Sticky Top Command Bar */}
          <div className="sticky top-3 z-30 flex items-center justify-between gap-3 flex-wrap bg-[#161419]/95 backdrop-blur-xl rounded-2xl border border-white/[0.09] px-4 sm:px-5 py-3 shadow-xl">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                className="lg:hidden p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white cursor-pointer"
                onClick={onMobileToggle}
                aria-label="فتح القائمة"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <div className="text-[11px] text-white/45 flex items-center gap-1.5">
                  <span>لوحة الإدارة</span>
                  <span>/</span>
                  <span className="text-[#f5c518] font-bold">{activeLabel}</span>
                </div>
                <h1 className="text-base sm:text-lg font-black text-white truncate flex items-center gap-2">
                  <ActiveIcon className="w-4 h-4 text-[#e50914] shrink-0" />
                  <span>{activeLabel}</span>
                </h1>
              </div>
            </div>

            {/* Center Quick-Switch Pills (Desktop) */}
            <div className="hidden xl:flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] p-1 rounded-xl">
              {[
                { id: "overview", label: "الرئيسية" },
                { id: "orders", label: `الطلبات${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
                { id: "courses", label: "الكورسات" },
                { id: "students", label: "الطلاب" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTabChange(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === t.id
                      ? "bg-[#e50914] text-white"
                      : "text-white/65 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {newCourseSlot}
              <Button
                variant="outline"
                onClick={onRefresh}
                size="sm"
                className="h-9 rounded-xl border-white/10 text-white bg-white/[0.04] hover:bg-white/[0.1] gap-1.5 font-bold cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5 text-[#f5c518]" />
                <span className="hidden sm:inline">تحديث</span>
              </Button>
              <Link
                to="/"
                className="h-9 px-3.5 rounded-xl border border-white/10 hover:border-[#f5c518]/50 text-white/85 hover:text-white text-xs font-bold bg-white/[0.04] hover:bg-white/[0.08] inline-flex items-center gap-1.5 transition-all"
              >
                <ExternalLink className="h-3.5 w-3.5 text-[#f5c518]" />
                <span>واجهة الموقع</span>
              </Link>
            </div>
          </div>

          {/* Mobile Drawer */}
          {mobileNavOpen && (
            <div className="lg:hidden rounded-2xl bg-[#161419] p-4 border border-white/10 shadow-2xl max-h-[75vh] overflow-y-auto">
              {NavContent}
            </div>
          )}

          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, highlight, footer, color }: any) {
  const colorMap: Record<string, string> = {
    gold: "bg-[#f5c518]/15 text-[#f5c518] border-[#f5c518]/30",
    blue: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    destructive: "bg-[#e50914]/20 text-[#ff6b72] border-[#e50914]/40",
  };
  const iconClass = color
    ? colorMap[color] ?? colorMap.gold
    : highlight
    ? colorMap.destructive
    : "bg-white/[0.06] text-white/80 border-white/10";

  return (
    <Card
      className={`p-5 rounded-2xl bg-[#161419] border-white/[0.08] hover:border-white/20 transition-all duration-300 ${
        highlight ? "border-[#e50914]/60 bg-gradient-to-br from-[#e50914]/15 to-[#161419] shadow-lg shadow-[#e50914]/15" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-white/55 mb-2">{label}</div>
          <div className="text-2xl sm:text-3xl font-black text-white leading-none tracking-tight">{value}</div>
        </div>
        <div className={`grid h-11 w-11 place-items-center rounded-xl border shrink-0 ${iconClass}`}>
          {icon}
        </div>
      </div>
      {footer && <div className="mt-3.5 pt-3 border-t border-white/[0.07]">{footer}</div>}
    </Card>
  );
}


function parseDeviceName(ua: string | null | undefined): string {
  if (!ua) return "جهاز غير معروف";
  const u = ua;
  if (/IdeaCoursesDesktop/i.test(u)) {
    const pcMatch = u.match(/PC:([^;)]+)/i);
    const hwMatch = u.match(/HW:([^;)]+)/i);
    const pc = pcMatch ? pcMatch[1].trim() : "Windows PC";
    const hw = hwMatch ? ` [HW:${hwMatch[1].trim()}]` : "";
    return `🛡️ تطبيق الديسكتوب المحمي • ${pc}${hw}`;
  }
  if (/IdeaCoursesMobile/i.test(u)) {
    const devMatch = u.match(/DEV:([^;)]+)/i);
    const hwMatch = u.match(/HW:([^;)]+)/i);
    const dev = devMatch ? devMatch[1].trim() : "Android Phone";
    const hw = hwMatch ? ` [HW:${hwMatch[1].trim()}]` : "";
    return `📱 تطبيق الموبايل المحمي • ${dev}${hw}`;
  }
  // OS
  let os = "";
  if (/Windows NT 10/.test(u)) os = "Windows 10/11";
  else if (/Windows NT/.test(u)) os = "Windows";
  else if (/iPhone/.test(u)) os = "iPhone";
  else if (/iPad/.test(u)) os = "iPad";
  else if (/Android/.test(u)) {
    const m = u.match(/Android\s([\d.]+)/);
    os = m ? `Android ${m[1]}` : "Android";
  } else if (/Mac OS X/.test(u)) os = "macOS";
  else if (/Linux/.test(u)) os = "Linux";
  // Browser
  let br = "";
  if (/Edg\//.test(u)) br = "Edge";
  else if (/OPR\//.test(u)) br = "Opera";
  else if (/Chrome\//.test(u) && !/Chromium/.test(u)) br = "Chrome";
  else if (/Firefox\//.test(u)) br = "Firefox";
  else if (/Safari\//.test(u)) br = "Safari";
  // Device model (Android)
  let model = "";
  const am = u.match(/Android[^;]*;\s*([^)]+?)(?:Build|\))/);
  if (am) model = am[1].split(";").pop()?.trim() ?? "";
  const parts = [model, os, br].filter(Boolean);
  return parts.length ? parts.join(" • ") : u.slice(0, 60);
}

function DevicesPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: devices, error } = await supabase
      .from("user_devices")
      .select("id,user_id,device_id,user_agent,first_seen,last_seen")
      .order("last_seen", { ascending: false });
    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }
    const ids = Array.from(new Set((devices ?? []).map((d: any) => d.user_id)));
    let profMap: Record<string, { name: string; email: string }> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,name,email")
        .in("id", ids);
      (profs ?? []).forEach((p: any) => {
        profMap[p.id] = { name: p.name, email: p.email };
      });
    }
    setRows(
      (devices ?? []).map((d: any) => ({
        ...d,
        name: profMap[d.user_id]?.name ?? "—",
        email: profMap[d.user_id]?.email ?? "—",
        device_name: parseDeviceName(d.user_agent),
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const reset = async (userId: string) => {
    if (!confirm("إعادة تعيين أجهزة هذا الطالب؟")) return;
    const { error } = await supabase.rpc("admin_reset_user_devices", { _user_id: userId });
    if (error) {
      const { toast } = await import("sonner");
      toast.error(error.message);
      return;
    }
    const { toast } = await import("sonner");
    toast.success("تم إعادة تعيين الأجهزة");
    load();
  };

  const deleteOne = async (id: string) => {
    if (!confirm("حذف هذا الجهاز؟")) return;
    const { error } = await supabase.from("user_devices").delete().eq("id", id);
    if (error) {
      const { toast } = await import("sonner");
      toast.error(error.message);
      return;
    }
    load();
  };

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      r.name?.toLowerCase().includes(s) ||
      r.email?.toLowerCase().includes(s) ||
      r.device_name?.toLowerCase().includes(s) ||
      r.device_id?.toLowerCase().includes(s)
    );
  });

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-lg font-bold">أجهزة الطلاب</div>
          <div className="text-xs text-muted-foreground">
            عرض اسم الجهاز ونظام التشغيل والمتصفح لكل طالب
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="ابحث باسم الطالب أو الجهاز..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-64"
          />
          <Button variant="outline" size="icon" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-right">
              <th className="p-2">الطالب</th>
              <th className="p-2">البريد</th>
              <th className="p-2">اسم الجهاز</th>
              <th className="p-2">معرّف الجهاز</th>
              <th className="p-2">أول ظهور</th>
              <th className="p-2">آخر ظهور</th>
              <th className="p-2">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-4 text-center text-muted-foreground" colSpan={7}>
                  جاري التحميل...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="p-4 text-center text-muted-foreground" colSpan={7}>
                  لا توجد أجهزة
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2 font-medium">{r.name}</td>
                  <td className="p-2 text-muted-foreground">{r.email}</td>
                  <td className="p-2">{r.device_name}</td>
                  <td className="p-2 font-mono text-xs text-muted-foreground">
                    {r.device_id?.slice(0, 12)}...
                  </td>
                  <td className="p-2 text-xs">
                    {r.first_seen ? new Date(r.first_seen).toLocaleString("ar-EG") : "—"}
                  </td>
                  <td className="p-2 text-xs">
                    {r.last_seen ? new Date(r.last_seen).toLocaleString("ar-EG") : "—"}
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        title="حذف الجهاز"
                        onClick={() => deleteOne(r.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        title="إعادة تعيين كل أجهزة الطالب"
                        onClick={() => reset(r.user_id)}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// Arabic → Latin transliteration map (Buckwalter-inspired, readable)
const AR_TO_LATIN: Record<string, string> = {
  ا: "a", أ: "a", إ: "i", آ: "a", ٱ: "a",
  ب: "b", ت: "t", ث: "th", ج: "j", ح: "h", خ: "kh",
  د: "d", ذ: "dh", ر: "r", ز: "z", س: "s", ش: "sh",
  ص: "s", ض: "d", ط: "t", ظ: "z", ع: "a", غ: "gh",
  ف: "f", ق: "q", ك: "k", ل: "l", م: "m", ن: "n",
  ه: "h", و: "w", ي: "y", ى: "a", ة: "a", ئ: "y", ؤ: "w", ء: "",
  // Persian/Urdu extras occasionally used
  پ: "p", چ: "ch", ژ: "zh", گ: "g", ک: "k", ی: "y",
  // Arabic-Indic digits
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

function transliterateArabic(input: string) {
  let out = "";
  for (const ch of input) {
    out += AR_TO_LATIN[ch] ?? ch;
  }
  return out;
}

function makeCourseSlug(title: string) {
  const cleaned = title
    .normalize("NFKD")
    // strip Arabic diacritics (tashkeel) & tatweel
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    // strip Latin combining marks (accents)
    .replace(/[\u0300-\u036f]/g, "");

  const latin = transliterateArabic(cleaned)
    .toLowerCase()
    // keep only a-z, 0-9 — everything else (punctuation, symbols, spaces) → separator
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  return latin || `course-${Date.now()}`;
}

function CourseDialog({ course, onSaved }: { course?: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    title: course?.title ?? "",
    slug: course?.slug ?? "",
    description: course?.description ?? "",
    short_description: course?.short_description ?? "",
    title_en: course?.title_en ?? "",
    short_description_en: course?.short_description_en ?? "",
    description_en: course?.description_en ?? "",
    image_url: course?.image_url ?? "",
    preview_video_url: course?.preview_video_url ?? "",
    price: course?.price ?? 0,
    discount_price: course?.discount_price ?? "",
    category: course?.category ?? "",
    instructor_name: course?.instructor_name ?? "",
    instructor_avatar_url: course?.instructor_avatar_url ?? "",
    duration: course?.duration ?? "",
    level: course?.level ?? "beginner",
    status: course?.status ?? "draft",
  });
  const [translatingCourse, setTranslatingCourse] = useState(false);
  const translateCourseFn = useServerFn(translateFields);

  const translateCourseToEn = async () => {
    const src: { key: string; text: string }[] = [];
    if (f.title.trim()) src.push({ key: "title", text: f.title.trim() });
    if (f.short_description.trim()) src.push({ key: "short_description", text: f.short_description.trim() });
    if (f.description.trim()) src.push({ key: "description", text: f.description.trim() });
    if (src.length === 0) { toast.error("لا يوجد نص عربي للترجمة"); return; }
    setTranslatingCourse(true);
    try {
      const res = await translateCourseFn({ data: { fields: src, target: "en" as const } });
      const t = res.translations;
      setF((prev) => ({
        ...prev,
        title_en: t.title ?? prev.title_en,
        short_description_en: t.short_description ?? prev.short_description_en,
        description_en: t.description ?? prev.description_en,
      }));
      toast.success("تمت الترجمة — راجع النص قبل الحفظ");
    } catch (e: any) {
      const m = String(e?.message || "");
      if (m.includes("rate_limited")) toast.error("محاولات كتير — استنى شوية");
      else if (m.includes("credits_exhausted")) toast.error("الرصيد نفد — اشحن باقة");
      else toast.error("فشل الترجمة");
    } finally {
      setTranslatingCourse(false);
    }
  };
  // Track if user manually edited the slug — if not, keep it in sync with title
  const [slugManual, setSlugManual] = useState<boolean>(!!course?.slug);
  const certCfg = course?.certificate_config ?? {};
  const [cert, setCert] = useState({
    template_url: certCfg.template_url ?? "",
    name_x: certCfg.name_x ?? "",
    name_y: certCfg.name_y ?? "",
    name_size: certCfg.name_size ?? "",
    name_color: certCfg.name_color ?? "",
    date_x: certCfg.date_x ?? "",
    date_y: certCfg.date_y ?? "",
    date_size: certCfg.date_size ?? "",
    date_color: certCfg.date_color ?? "",
    date_format: certCfg.date_format ?? "",
    name_font: certCfg.name_font ?? "",
    date_font: certCfg.date_font ?? "",
    course_x: certCfg.course_x ?? "",
    course_y: certCfg.course_y ?? "",
    course_size: certCfg.course_size ?? "",
    course_color: certCfg.course_color ?? "",
    course_font: certCfg.course_font ?? "",
    show_course: certCfg.show_course !== false,
    certid_x: certCfg.certid_x ?? "",
    certid_y: certCfg.certid_y ?? "",
    certid_size: certCfg.certid_size ?? "",
    certid_color: certCfg.certid_color ?? "",
    certid_font: certCfg.certid_font ?? "",
    show_certid: certCfg.show_certid !== false,
    qr_x: certCfg.qr_x ?? "",
    qr_y: certCfg.qr_y ?? "",
    qr_size: certCfg.qr_size ?? "",
    show_qr: certCfg.show_qr !== false,
    max_video_views: certCfg.max_video_views !== undefined ? String(certCfg.max_video_views) : "4",
  });

  const save = async () => {
    const cleanSlug = f.slug.trim() || makeCourseSlug(f.title);
    const certPayload: any = {};
    for (const k of Object.keys(cert) as (keyof typeof cert)[]) {
      const v = (cert as any)[k];
      if (v === "" || v === null || v === undefined) continue;
      if (typeof v === "boolean") {
        certPayload[k] = v;
      } else if (k.endsWith("_color") || k.endsWith("_font") || k === "date_format" || k === "template_url") {
        certPayload[k] = String(v);
      } else {
        certPayload[k] = Number(v);
      }
    }
    const payload: any = {
      ...f,
      slug: cleanSlug,
      preview_video_url: f.preview_video_url.trim() || null,
      title_en: f.title_en.trim() || null,
      short_description_en: f.short_description_en.trim() || null,
      description_en: f.description_en.trim() || null,
      price: Number(f.price),
      discount_price: f.discount_price ? Number(f.discount_price) : null,
      certificate_config: Object.keys(certPayload).length ? certPayload : null,
    };
    const { error } = course
      ? await supabase.from("courses").update(payload).eq("id", course.id)
      : await supabase.from("courses").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم الحفظ");
    invalidateCache(`course:slug:${course?.slug ?? cleanSlug}`);
    invalidateCache(`course:slug:${cleanSlug}`);
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {course ? (
          <Button size="icon" variant="ghost">
            <BookOpen className="h-4 w-4" />
          </Button>
        ) : (
          <Button className="bg-gold text-gold-foreground hover:bg-gold/90">
            <Plus className="h-4 w-4 ml-1" /> كورس جديد
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{course ? "تعديل كورس" : "إضافة كورس"}</DialogTitle>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>العنوان</Label>
            <Input
              value={f.title}
              onChange={(e) => {
                const title = e.target.value;
                setF((prev) => ({
                  ...prev,
                  title,
                  slug: slugManual ? prev.slug : (title.trim() ? makeCourseSlug(title) : ""),
                }));
              }}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Slug</Label>
              <button
                type="button"
                onClick={() => {
                  setF((prev) => ({ ...prev, slug: prev.title.trim() ? makeCourseSlug(prev.title) : "" }));
                  setSlugManual(false);
                }}
                className="text-[11px] text-gold hover:underline"
                title="توليد من العنوان"
              >
                توليد تلقائي ↻
              </button>
            </div>
            <Input
              value={f.slug}
              onChange={(e) => {
                setF({ ...f, slug: e.target.value });
                setSlugManual(true);
              }}
              placeholder="يتولد تلقائياً من العنوان"
            />
            {!slugManual && f.slug && (
              <p className="text-[10px] text-muted-foreground mt-1">تلقائي — عدّل يدوياً لو حبيت</p>
            )}
          </div>
          <div>
            <Label>التصنيف</Label>
            <Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>وصف قصير</Label>
            <Input
              value={f.short_description}
              onChange={(e) => setF({ ...f, short_description: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>الوصف الكامل</Label>
            <Textarea
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
              rows={4}
            />
          </div>
          <div className="sm:col-span-2 mt-2 border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-primary text-sm">النسخة الإنجليزية (تظهر لما اللغة EN)</div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={translatingCourse}
                onClick={translateCourseToEn}
                className="gap-1 border-gold/40 text-gold hover:bg-gold/10"
              >
                {translatingCourse ? "جاري الترجمة…" : "ترجم بالـ AI ✨"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mb-2">اتركها فارغة لتعرض النسخة العربية للجميع.</p>
          </div>
          <div className="sm:col-span-2">
            <Label>Title (English)</Label>
            <Input dir="ltr" value={f.title_en} onChange={(e) => setF({ ...f, title_en: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Short description (English)</Label>
            <Input dir="ltr" value={f.short_description_en} onChange={(e) => setF({ ...f, short_description_en: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Full description (English)</Label>
            <Textarea dir="ltr" value={f.description_en} onChange={(e) => setF({ ...f, description_en: e.target.value })} rows={4} />
          </div>
          <div>
            <Label>السعر</Label>
            <Input
              type="number"
              value={f.price}
              onChange={(e) => setF({ ...f, price: e.target.value as any })}
            />
          </div>
          <div>
            <Label>سعر الخصم</Label>
            <Input
              type="number"
              value={f.discount_price}
              onChange={(e) => setF({ ...f, discount_price: e.target.value as any })}
            />
          </div>
          <div>
            <Label>اسم المدرب</Label>
            <Input
              value={f.instructor_name}
              onChange={(e) => setF({ ...f, instructor_name: e.target.value })}
            />
          </div>
          <div>
            <Label>صورة المدرب</Label>
            <div className="flex flex-col gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const ext = file.name.split(".").pop() || "jpg";
                  const path = `instructors/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
                  const { error: upErr } = await supabase.storage
                    .from("course-assets")
                    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
                  if (upErr) { toast.error("فشل رفع صورة المدرب"); return; }
                  const { data } = supabase.storage.from("course-assets").getPublicUrl(path);
                  setF({ ...f, instructor_avatar_url: data.publicUrl });
                  toast.success("تم رفع صورة المدرب");
                }}
                className="text-sm"
              />
              <Input
                placeholder="أو ألصق رابط الصورة (اختياري)"
                value={f.instructor_avatar_url}
                onChange={(e) => setF({ ...f, instructor_avatar_url: e.target.value })}
              />
              {f.instructor_avatar_url && (
                <img src={f.instructor_avatar_url} alt="" className="h-20 w-20 rounded-full border object-cover" />
              )}
            </div>
          </div>
          <div>
            <Label>المدة</Label>
            <Input value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>صورة الكورس</Label>
            <div className="flex flex-col gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const ext = file.name.split(".").pop() || "jpg";
                  const path = `courses/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
                  const { error: upErr } = await supabase.storage
                    .from("course-assets")
                    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
                  if (upErr) { toast.error("فشل رفع الصورة"); return; }
                  const { data } = supabase.storage.from("course-assets").getPublicUrl(path);
                  setF({ ...f, image_url: data.publicUrl });
                  toast.success("تم رفع الصورة");
                }}
                className="text-sm"
              />
              <Input
                placeholder="أو ألصق رابط الصورة (اختياري)"
                value={f.image_url}
                onChange={(e) => setF({ ...f, image_url: e.target.value })}
              />
              {f.image_url && (
                <img src={f.image_url} alt="" className="h-32 w-auto rounded-md border object-cover" />
              )}
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label>فيديو تعريفي للكورس (اختياري)</Label>
            <div className="flex flex-col gap-2">
              <input
                type="file"
                accept="video/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 100 * 1024 * 1024) { toast.error("الحد الأقصى 100MB"); return; }
                  const ext = file.name.split(".").pop() || "mp4";
                  const path = `courses/preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
                  const t = toast.loading("جاري رفع الفيديو...");
                  const { error: upErr } = await supabase.storage
                    .from("course-assets")
                    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
                  toast.dismiss(t);
                  if (upErr) { toast.error("فشل رفع الفيديو"); return; }
                  const { data } = supabase.storage.from("course-assets").getPublicUrl(path);
                  setF({ ...f, preview_video_url: data.publicUrl });
                  toast.success("تم رفع الفيديو");
                }}
                className="text-sm"
              />
              <Input
                placeholder="لينك الفيديو أو الموقع"
                value={f.preview_video_url}
                onChange={(e) => setF({ ...f, preview_video_url: e.target.value })}
              />
              {f.preview_video_url && (
                <div className="relative w-full max-w-md aspect-video rounded-md border overflow-hidden bg-black">
                  <SecurePlayer url={f.preview_video_url} title="معاينة" />
                </div>
              )}
            </div>
          </div>
          <div>
            <Label>المستوى</Label>
            <select
              className="w-full h-10 rounded-md border bg-background px-3"
              value={f.level}
              onChange={(e) => setF({ ...f, level: e.target.value })}
            >
              <option value="beginner">مبتدئ</option>
              <option value="intermediate">متوسط</option>
              <option value="advanced">متقدم</option>
            </select>
          </div>
          <div>
            <Label>الحالة</Label>
            <select
              className="w-full h-10 rounded-md border bg-background px-3"
              value={f.status}
              onChange={(e) => setF({ ...f, status: e.target.value })}
            >
              <option value="draft">مسودة</option>
              <option value="published">منشور</option>
            </select>
          </div>
          <div className="sm:col-span-2 bg-secondary/30 p-3.5 rounded-xl border border-secondary">
            <Label className="flex items-center gap-1.5 font-bold text-sm text-primary mb-1">
              <Eye className="h-4 w-4 text-gold" />
              الحد الأقصى لعدد مشاهدات الفيديو لكل درس
            </Label>
            <Input
              type="number"
              min="0"
              value={cert.max_video_views}
              onChange={(e) => setCert({ ...cert, max_video_views: e.target.value })}
              placeholder="4"
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              محدد افتراضياً بـ 4 مشاهدات لكل فيديو. عند استهلاك الطالب لكل المشاهدات يتم قفل الفيديو وإرشاده للتواصل مع الإدارة. (اكتب 0 للمشاهدة غير المحدودة).
            </p>
          </div>
        </div>
        <details className="rounded-md border p-3">
          <summary className="cursor-pointer font-semibold text-sm">إعدادات قالب الشهادة (مكان الاسم والتاريخ)</summary>
          <p className="text-xs text-muted-foreground mt-2 mb-3">ارفع صورة قالب الشهادة ثم اسحب اسم الطالب والتاريخ على المعاينة لتحديد المكان بدقة. الإحداثيات تُحفظ كنسبة (0-1) من أبعاد الصورة.</p>
          <CertificateTemplatePicker cert={cert as never} setCert={setCert as never} currentCourseId={course?.id} />
          <div className="mb-4">
            <Label>صورة قالب الشهادة</Label>
            <div className="flex flex-col gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const ext = file.name.split(".").pop() || "png";
                  const path = `certificates/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
                  const t = toast.loading("جاري رفع القالب...");
                  const { error: upErr } = await supabase.storage
                    .from("course-assets")
                    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
                  toast.dismiss(t);
                  if (upErr) { toast.error("فشل رفع القالب"); return; }
                  const { data } = supabase.storage.from("course-assets").getPublicUrl(path);
                  setCert({ ...cert, template_url: data.publicUrl });
                  toast.success("تم رفع قالب الشهادة");
                }}
                className="text-sm"
              />
              <Input
                placeholder="أو ألصق رابط الصورة"
                value={cert.template_url}
                onChange={(e) => setCert({ ...cert, template_url: e.target.value })}
              />
            </div>
          </div>
          {cert.template_url ? (
            <CertificatePositionEditor cert={cert} setCert={(c) => setCert((prev) => ({ ...prev, ...c }))} />
          ) : (
            <p className="text-xs text-muted-foreground">ارفع القالب أولاً لتظهر المعاينة التفاعلية.</p>
          )}
          {cert.template_url ? (
            <CertificateLivePreview cert={cert} courseTitle={f.title} courseSlug={f.slug} />
          ) : null}
        </details>
        <Button onClick={save} className="w-full bg-gold text-gold-foreground hover:bg-gold/90">
          حفظ
        </Button>
      </DialogContent>
    </Dialog>
  );
}


function AccessCodesPanel({ courses }: { courses: any[] }) {
  const [courseId, setCourseId] = useState("");
  const [count, setCount] = useState("1");
  const [codes, setCodes] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("access_codes")
      .select("*, courses(title)")
      .order("created_at", { ascending: false })
      .limit(200);
    const list = data ?? [];
    const userIds = Array.from(new Set(list.map((c: any) => c.used_by).filter(Boolean)));
    let profMap: Record<string, any> = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles").select("id,name,email").in("id", userIds as string[]);
      for (const p of profs ?? []) profMap[(p as any).id] = p;
    }
    setCodes(list.map((c: any) => ({ ...c, user: c.used_by ? profMap[c.used_by] : null })));
  };
  useEffect(() => { load(); }, []);

  const randomCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  };

  const generate = async () => {
    if (!courseId) { toast.error("اختر الكورس"); return; }
    const n = Math.max(1, Math.min(100, Number(count) || 1));
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    const rows = Array.from({ length: n }, () => ({
      code: randomCode(),
      course_id: courseId,
      created_by: user.id,
    }));
    const { error } = await supabase.from("access_codes").insert(rows);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(`تم إنشاء ${n} كود`); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("حذف الكود؟")) return;
    const { error } = await supabase.from("access_codes").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("تم الحذف"); load(); }
  };

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("تم نسخ الكود");
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <Label>الكورس</Label>
          <select
            className="w-full h-10 rounded-md border bg-background px-3"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            <option value="">— اختر —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
        <div className="w-28">
          <Label>عدد الأكواد</Label>
          <Input type="number" min={1} max={100} value={count} onChange={(e) => setCount(e.target.value)} />
        </div>
        <Button onClick={generate} disabled={busy} className="bg-gold text-gold-foreground hover:bg-gold/90">
          <Plus className="h-4 w-4 ml-1" /> إنشاء
        </Button>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-secondary">
            <tr>
              <th className="p-3 text-right">الكود</th>
              <th className="p-3 text-right">الكورس</th>
              <th className="p-3 text-right">الحالة</th>
              <th className="p-3 text-right">المستخدم</th>
              <th className="p-3 text-left">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {codes.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">لا توجد أكواد</td></tr>
            )}
            {codes.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3 font-mono">{c.code}</td>
                <td className="p-3">{c.courses?.title ?? "—"}</td>
                <td className="p-3">
                  {c.used_by
                    ? <Badge variant="secondary">مستخدم</Badge>
                    : <Badge className="bg-success text-white">متاح</Badge>}
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {c.user?.name ? `${c.user.name} (${c.user.email})` : "—"}
                </td>
                <td className="p-3">
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" variant="outline" onClick={() => copy(c.code)}>نسخ</Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}

type ActiveUserRow = {
  user_id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  last_active_at: string;
  current_path: string | null;
  is_admin: boolean;
  is_moderator: boolean;
};

function describePath(path: string | null): string {
  if (!path) return "—";
  const p = path.split("?")[0];
  if (p === "/" || p === "") return "الصفحة الرئيسية";
  if (p === "/courses") return "قائمة الكورسات";
  if (p.startsWith("/courses/")) return `صفحة كورس (${p.replace("/courses/", "")})`;
  if (p.startsWith("/learn/")) return `يشاهد كورس (${p.replace("/learn/", "")})`;
  if (p === "/dashboard") return "لوحة الطالب";
  if (p === "/wishlist") return "قائمة الأمنيات";
  if (p.startsWith("/checkout")) return "صفحة الدفع";
  if (p === "/cart") return "السلة";
  if (p === "/chat") return "الدردشة";
  if (p === "/help") return "مركز المساعدة";
  if (p === "/contact") return "تواصل معنا";
  if (p === "/about") return "من نحن";
  if (p === "/login") return "تسجيل الدخول";
  if (p === "/register") return "إنشاء حساب";
  if (p.startsWith("/admin")) return `لوحة الإدارة (${p})`;
  if (p.startsWith("/verify/")) return "التحقق من شهادة";
  return p;
}

function relativeAr(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `منذ ${s} ث`;
  const m = Math.floor(s / 60);
  if (m < 60) return `منذ ${m} د`;
  const h = Math.floor(m / 60);
  return `منذ ${h} س`;
}

function ActiveUsersPanel({ compact = false }: { compact?: boolean }) {
  const [rows, setRows] = useState<ActiveUserRow[]>([]);
  const [minutes, setMinutes] = useState<number>(5);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const load = async (mins: number) => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_active_users", { _minutes: mins } as any);
    setLoading(false);
    if (!error && Array.isArray(data)) setRows(data as ActiveUserRow[]);
  };

  useEffect(() => {
    load(minutes);
    const id = window.setInterval(() => load(minutes), 15_000);
    const t = window.setInterval(() => setTick((n) => n + 1), 10_000);
    return () => { window.clearInterval(id); window.clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minutes]);

  const display = compact ? rows.slice(0, 5) : rows;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="font-bold text-primary">
            المتواجدون الآن <span className="text-muted-foreground font-normal">({rows.length})</span>
          </h3>
          <span className="sr-only">{tick}</span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(minutes)} onValueChange={(v) => setMinutes(Number(v))}>
            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">آخر دقيقة</SelectItem>
              <SelectItem value="5">آخر 5 دقايق</SelectItem>
              <SelectItem value="15">آخر 15 دقيقة</SelectItem>
              <SelectItem value="60">آخر ساعة</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-8" onClick={() => load(minutes)} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ml-1 ${loading ? "animate-spin" : ""}`} /> تحديث
          </Button>
        </div>
      </div>

      {display.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          لا يوجد مستخدمون نشطون في هذه الفترة.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {display.map((u) => (
            <li key={u.user_id} className="py-2.5 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-secondary overflow-hidden shrink-0 grid place-items-center text-xs font-bold text-muted-foreground">
                {u.avatar_url
                  ? <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                  : (u.name?.[0] ?? u.email?.[0] ?? "؟").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-primary truncate">{u.name || u.email || "طالب"}</span>
                  {u.is_admin && <Badge className="h-4 text-[10px] px-1.5">أدمن</Badge>}
                  {u.is_moderator && !u.is_admin && <Badge variant="secondary" className="h-4 text-[10px] px-1.5">مشرف</Badge>}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {describePath(u.current_path)}
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground shrink-0">
                {relativeAr(u.last_active_at)}
              </div>
            </li>
          ))}
        </ul>
      )}
      {compact && rows.length > 5 && (
        <div className="text-xs text-muted-foreground text-center pt-1">
          + {rows.length - 5} مستخدم آخرين — افتح تبويب «النشاط الحالي» للتفاصيل.
        </div>
      )}
    </Card>
  );
}

function CouponForm({ onCreated }: { onCreated: () => void }) {
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percentage" | "fixed">("percentage");
  const [value, setValue] = useState("");
  const create = async () => {
    if (!code.trim() || !value) return;
    const { error } = await supabase.from("coupons").insert({
      code: code.toUpperCase().trim(),
      discount_type: type,
      discount_value: Number(value),
      active: true,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("تم الإنشاء");
      setCode("");
      setValue("");
      onCreated();
    }
  };
  return (
    <Card className="p-4 flex flex-wrap gap-2 items-end">
      <div className="flex-1 min-w-[120px]">
        <Label>الكود</Label>
        <Input value={code} onChange={(e) => setCode(e.target.value)} />
      </div>
      <div>
        <Label>النوع</Label>
        <select
          className="h-10 rounded-md border bg-background px-3"
          value={type}
          onChange={(e) => setType(e.target.value as any)}
        >
          <option value="percentage">نسبة %</option>
          <option value="fixed">قيمة ثابتة</option>
        </select>
      </div>
      <div className="w-32">
        <Label>القيمة</Label>
        <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <Button onClick={create} className="bg-gold text-gold-foreground hover:bg-gold/90">
        <Plus className="h-4 w-4 ml-1" /> إنشاء
      </Button>
    </Card>
  );
}

function AdminsManager({
  admins,
  currentUserId,
  onChanged,
}: {
  admins: any[];
  currentUserId?: string;
  onChanged: () => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const promote = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("ادخل البريد الإلكتروني");
      return;
    }
    setBusy(true);
    const { data: uid, error } = await supabase.rpc("find_user_id_by_email", { _email: trimmed });
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    if (!uid) {
      toast.error("لم يتم العثور على مستخدم بهذا البريد. اطلب منه التسجيل أولاً");
      setBusy(false);
      return;
    }
    const { error: insErr } = await supabase
      .from("user_roles")
      .insert({ user_id: uid, role: "admin" });
    setBusy(false);
    if (insErr) {
      if (insErr.code === "23505") toast.info("هذا المستخدم أدمن بالفعل");
      else toast.error(insErr.message);
      return;
    }
    toast.success("تمت ترقية المستخدم إلى أدمن");
    setEmail("");
    onChanged();
  };

  const demote = async (uid: string) => {
    if (uid === currentUserId) {
      toast.error("لا يمكنك إزالة صلاحياتك بنفسك");
      return;
    }
    if (admins.length <= 1) {
      toast.error("لا يمكن إزالة آخر أدمن");
      return;
    }
    if (!confirm("إزالة صلاحيات الأدمن من هذا المستخدم؟")) return;
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", uid)
      .eq("role", "admin");
    if (error) toast.error(error.message);
    else {
      toast.success("تمت الإزالة");
      onChanged();
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-5 w-5 text-gold" />
          <h3 className="font-bold text-primary">ترقية مستخدم إلى أدمن</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          المستخدم لازم يكون عامل تسجيل في المنصة الأول. اكتب بريده الإلكتروني وسيتم منحه صلاحيات
          الإدارة الكاملة.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            type="email"
            className="flex-1 min-w-[200px]"
          />
          <Button
            onClick={promote}
            disabled={busy}
            className="bg-gold text-gold-foreground hover:bg-gold/90"
          >
            <UserPlus className="h-4 w-4 ml-1" /> ترقية
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b bg-secondary/50 font-semibold text-sm flex items-center gap-2">
          <Users className="h-4 w-4" /> المديرون الحاليون ({admins.length})
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-secondary text-xs">
            <tr>
              <th className="p-3 text-right">الاسم</th>
              <th className="p-3 text-right">البريد</th>
              <th className="p-3 text-left w-32">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {admins.length === 0 && (
              <tr>
                <td colSpan={3} className="p-6 text-center text-muted-foreground">
                  لا يوجد مديرون
                </td>
              </tr>
            )}
            {admins.map((a) => (
              <tr key={a.user_id} className="border-t">
                <td className="p-3 font-medium">
                  {a.name ?? "—"}
                  {a.user_id === currentUserId && (
                    <Badge variant="secondary" className="mr-2 text-xs">
                      أنت
                    </Badge>
                  )}
                </td>
                <td className="p-3 text-muted-foreground">{a.email ?? "—"}</td>
                <td className="p-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => demote(a.user_id)}
                    disabled={a.user_id === currentUserId || admins.length <= 1}
                  >
                    <UserMinus className="h-4 w-4 ml-1" /> إزالة
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}

function OutreachPanel({
  students,
  courses,
  adminId,
}: {
  students: any[];
  courses: any[];
  adminId?: string;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [target, setTarget] = useState<string>("__all__");
  const [targetMode, setTargetMode] = useState<"all" | "course" | "user">("all");
  const [targetCourse, setTargetCourse] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [channel, setChannel] = useState<"both" | "platform" | "email">("both");
  const [online, setOnline] = useState<{ id: string; name: string; isAdmin?: boolean }[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [readsByNotif, setReadsByNotif] = useState<Record<string, { user_id: string; read_at: string; name?: string; email?: string }[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [emailsByNotif, setEmailsByNotif] = useState<Record<string, { recipient_email: string; status: string; error_message?: string | null; created_at: string }[]>>({});
  const refreshTimersRef = useRef<number[]>([]);

  // Presence: see who is online
  useEffect(() => {
    if (!adminId) return;
    const ch = supabase.channel(`online-users-${adminId}-${Date.now()}`, { config: { presence: { key: adminId } } });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, any[]>;
      const arr: { id: string; name: string; isAdmin?: boolean }[] = [];
      for (const k of Object.keys(state)) {
        const meta = state[k][0];
        arr.push({ id: k, name: meta?.name ?? "زائر", isAdmin: meta?.isAdmin });
      }
      setOnline(arr);
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") await ch.track({ name: "إدارة", isAdmin: true });
    });
    return () => { supabase.removeChannel(ch); };
  }, [adminId]);

  const loadRecent = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setRecent(data ?? []);

    // Load read receipts for these notifications
    const ids = (data ?? []).map((n: any) => n.id);
    if (ids.length === 0) { setReadsByNotif({}); return; }
    const { data: reads } = await supabase
      .from("notification_reads")
      .select("notification_id, user_id, read_at")
      .in("notification_id", ids);
    const userIds = Array.from(new Set((reads ?? []).map((r: any) => r.user_id)));
    const { data: profs } = userIds.length
      ? await supabase.from("profiles").select("id,name,email").in("id", userIds)
      : { data: [] as any[] };
    const profMap: Record<string, { name: string; email: string }> = {};
    (profs ?? []).forEach((p: any) => { profMap[p.id] = { name: p.name, email: p.email }; });
    const grouped: Record<string, any[]> = {};
    (reads ?? []).forEach((r: any) => {
      grouped[r.notification_id] ||= [];
      grouped[r.notification_id].push({ ...r, ...(profMap[r.user_id] ?? {}) });
    });
    setReadsByNotif(grouped);

    // Load email delivery status for notifications that were also emailed
    const batchIds = (data ?? [])
      .map((n: any) => n.email_batch_id)
      .filter((x: string | null): x is string => !!x);
    if (batchIds.length === 0) { setEmailsByNotif({}); return; }
    const orClauses = batchIds.map((b) => `message_id.like.${b}-%`).join(",");
    const { data: logs } = await supabase
      .from("email_send_log")
      .select("message_id, recipient_email, status, error_message, created_at")
      .or(orClauses)
      .order("created_at", { ascending: false })
      .limit(2000);
    // Deduplicate: latest status per (batch, recipient)
    const latest: Record<string, Record<string, any>> = {};
    (logs ?? []).forEach((r: any) => {
      const mid: string = r.message_id ?? "";
      const dash = mid.lastIndexOf("-");
      if (dash < 0) return;
      // message_id shape: `${batch}-${idx}` — batch id is a UUID (contains dashes),
      // so split on the LAST dash where the suffix is a numeric index.
      const suffix = mid.slice(dash + 1);
      if (!/^\d+$/.test(suffix)) return;
      const batch = mid.slice(0, dash);
      const key = `${batch}::${r.recipient_email}`;
      if (!latest[batch]) latest[batch] = {};
      if (!latest[batch][key]) latest[batch][key] = r;
    });
    const byNotif: Record<string, any[]> = {};
    (data ?? []).forEach((n: any) => {
      if (!n.email_batch_id) return;
      const rows = latest[n.email_batch_id] ? Object.values(latest[n.email_batch_id]) : [];
      byNotif[n.id] = rows as any[];
    });
    setEmailsByNotif(byNotif);
  };
  useEffect(() => { loadRecent(); }, []);
  useEffect(() => {
    return () => {
      refreshTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      refreshTimersRef.current = [];
    };
  }, []);

  const scheduleEmailStatusRefresh = () => {
    refreshTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    refreshTimersRef.current = [2500, 7000, 15000, 30000].map((delay) =>
      window.setTimeout(loadRecent, delay),
    );
  };

  const send = async () => {
    if (!title.trim() || !body.trim() || !adminId) {
      toast.error("اكتب العنوان والمحتوى");
      return;
    }
    setSending(true);
    const sendPlatform = channel === "platform" || channel === "both";
    const sendEmail = channel === "email" || channel === "both";
    // One shared batch id for this send. Tagged on notifications AND used as
    // the message_id prefix for every email so we can correlate delivery.
    const batchId = sendEmail ? crypto.randomUUID() : null;

    // Resolve recipients based on mode
    let courseUserIds: string[] = [];
    if (targetMode === "course") {
      if (!targetCourse) {
        setSending(false);
        toast.error("اختر الكورس");
        return;
      }
      const { data: enr, error: enrErr } = await supabase
        .from("enrollments")
        .select("user_id")
        .eq("course_id", targetCourse)
        .eq("status", "active");
      if (enrErr) {
        setSending(false);
        toast.error(enrErr.message);
        return;
      }
      courseUserIds = Array.from(new Set((enr ?? []).map((e: any) => e.user_id)));
      if (courseUserIds.length === 0) {
        setSending(false);
        toast.error("لا يوجد طلاب في هذا الكورس");
        return;
      }
    }

    if (sendPlatform) {
      const base = {
        title: title.trim(),
        body: body.trim(),
        link: link.trim() || null,
        created_by: adminId,
        email_batch_id: batchId,
      };
      let error: any = null;
      if (targetMode === "all") {
        const r = await supabase.from("notifications").insert({ ...base, target_user_id: null });
        error = r.error;
      } else if (targetMode === "user") {
        const r = await supabase.from("notifications").insert({ ...base, target_user_id: target });
        error = r.error;
      } else {
        const rows = courseUserIds.map((uid) => ({ ...base, target_user_id: uid }));
        const r = await supabase.from("notifications").insert(rows);
        error = r.error;
      }
      if (error) {
        setSending(false);
        toast.error(error.message);
        return;
      }
    }

    if (sendEmail) {
      try {
        let recipients: any[];
        if (targetMode === "all") recipients = students;
        else if (targetMode === "user") recipients = students.filter((s) => s.id === target);
        else recipients = students.filter((s) => courseUserIds.includes(s.id));
        const valid = recipients.filter((s) => s.email);
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) {
          toast.error("فشل إرسال البريد: لازم تسجل دخول");
        } else {
          let ok = 0, fail = 0;
          await Promise.all(valid.map(async (s, idx) => {
            try {
              const res: any = await sendPlatformEmail({
                data: {
                  templateName: "notification",
                  recipientEmail: s.email,
                  messageId: `${batchId}-${idx}`,
                  templateData: {
                    studentName: s.name || "الطالب",
                    title: title.trim(),
                    body: body.trim(),
                    link: link.trim() || undefined,
                  },
                },
              });
              if (res?.ok) ok++; else fail++;
            } catch { fail++; }

          }));
          const summary = `(${ok} تمت إضافته للطابور${fail ? `، ${fail} فشل` : ""})`;
          if (ok === 0 && fail > 0) {
            toast.error(`فشل إضافة البريد للطابور ${summary}`);
          } else if (sendPlatform) {
            toast.success(`تم إرسال الإشعار وإضافة البريد للطابور ${summary}`);
          } else {
            toast.success(`تمت إضافة البريد للطابور ${summary}`);
          }
          if (ok > 0) scheduleEmailStatusRefresh();
        }
      } catch (e: any) {
        toast.error("فشل إرسال البريد");
      }
    } else if (sendPlatform) {
      toast.success("تم إرسال الإشعار");
    }
    setTitle(""); setBody(""); setLink("");
    setSending(false);
    loadRecent();
  };

  const removeNotif = async (id: string) => {
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) toast.error(error.message); else loadRecent();
  };

  const [clearingAll, setClearingAll] = useState(false);
  const clearAllNotifs = async () => {
    if (!confirm("هل أنت متأكد من حذف جميع الإشعارات المرسلة نهائياً؟\nسيتم حذفها من لوحة التحكم ومن عند جميع الطلاب.")) return;
    setClearingAll(true);
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .not("id", "is", null);
      if (error) {
        toast.error(`فشل حذف الإشعارات: ${error.message}`);
      } else {
        toast.success("تم حذف جميع الإشعارات بنجاح");
        setRecent([]);
        setReadsByNotif({});
        setEmailsByNotif({});
        loadRecent();
      }
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء الحذف");
    } finally {
      setClearingAll(false);
    }
  };

  const [resending, setResending] = useState<string | null>(null);
  const [emailFilter, setEmailFilter] = useState<"all" | "failed" | "sent" | "pending" | "suppressed">("all");
  const [emailSort, setEmailSort] = useState<"latest" | "oldest" | "reason" | "email">("latest");
  const resendEmail = async (n: any, recipientEmail: string) => {
    const key = `${n.id}::${recipientEmail}`;
    setResending(key);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) { toast.error("لازم تسجل دخول"); return; }
      const batchId = n.email_batch_id || crypto.randomUUID();
      const suffix = `retry-${Date.now()}`;
      const stu = students.find((s) => s.email === recipientEmail);
      const res: any = await sendPlatformEmail({
        data: {
          templateName: "notification",
          recipientEmail,
          messageId: `${batchId}-${suffix}`,
          templateData: {
            studentName: stu?.name || "الطالب",
            title: n.title,
            body: n.body,
            link: n.link || undefined,
          },
        },
      });
      if (!res?.ok) {
        toast.error(`فشل إعادة الإرسال: ${res?.message || res?.reason || ""}`);
      } else {
        toast.success(`تم إرسال البريد لـ ${recipientEmail}`);
        scheduleEmailStatusRefresh();
      }

    } catch (e: any) {
      toast.error("فشل إعادة الإرسال");
    } finally {
      setResending(null);
    }
  };

  const resendAllFailed = async (n: any) => {
    const emails = (emailsByNotif[n.id] ?? []).filter((e: any) => {
      const s = String(e.status ?? "").toLowerCase();
      return s && s !== "sent" && s !== "pending" && s !== "queued" && s !== "suppressed";
    });
    if (emails.length === 0) { toast.info("لا توجد رسائل فاشلة لإعادة إرسالها"); return; }
    if (!confirm(`إعادة إرسال البريد لـ ${emails.length} مستلم؟`)) return;
    for (const e of emails) {
      await resendEmail(n, e.recipient_email);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {/* Online students */}
      <Card className="p-5">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <Circle className="h-3 w-3 fill-success text-success" />
          المتصلون الآن ({online.length})
        </h3>
        <div className="max-h-72 overflow-y-auto space-y-2">
          {online.length === 0 && (
            <div className="text-xs text-muted-foreground">لا يوجد مستخدمون متصلون</div>
          )}
          {online.map((u) => (
            <div key={u.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success" />
                <span>{u.name}</span>
                {u.isAdmin && (
                  <span className="text-[10px] bg-gold/20 text-gold px-1.5 py-0.5 rounded">إدارة</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Send notification */}
      <Card className="p-5">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <Bell className="h-4 w-4 text-gold" /> إرسال إشعار
        </h3>
        <div className="space-y-3">
          <div>
            <Label>المستهدف</Label>
            <select
              className="w-full border rounded-md h-10 px-2 bg-background mt-1"
              value={targetMode}
              onChange={(e) => setTargetMode(e.target.value as any)}
            >
              <option value="all">كل المستخدمين</option>
              <option value="course">طلاب كورس معين</option>
              <option value="user">مستخدم واحد</option>
            </select>
            {targetMode === "course" && (
              <select
                className="w-full border rounded-md h-10 px-2 bg-background mt-2"
                value={targetCourse}
                onChange={(e) => setTargetCourse(e.target.value)}
              >
                <option value="">— اختر الكورس —</option>
                {courses.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            )}
            {targetMode === "user" && (
              <select
                className="w-full border rounded-md h-10 px-2 bg-background mt-2"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="__all__">— اختر المستخدم —</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — {s.email}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <Label>العنوان</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div>
            <Label>المحتوى</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000} />
          </div>
          <div>
            <Label>رابط (اختياري)</Label>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label>طريقة الإرسال</Label>
            <select
              className="w-full border rounded-md h-10 px-2 bg-background mt-1"
              value={channel}
              onChange={(e) => setChannel(e.target.value as any)}
            >
              <option value="both">المنصة + البريد الإلكتروني</option>
              <option value="platform">المنصة فقط</option>
              <option value="email">البريد الإلكتروني فقط</option>
            </select>
          </div>
          <Button onClick={send} disabled={sending} className="bg-gold text-gold-foreground hover:bg-gold/90 w-full">
            <Send className="h-4 w-4 ml-2" /> {sending ? "جارٍ الإرسال..." : "إرسال الإشعار"}
          </Button>
        </div>
      </Card>

      {/* Recent notifications */}
      <Card className="p-5 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-3">
            <h3 className="font-bold">آخر الإشعارات المرسلة</h3>
            {recent.length > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={clearAllNotifs}
                disabled={clearingAll}
                className="h-7 text-xs font-semibold gap-1 bg-red-600 hover:bg-red-700 text-white"
                title="حذف جميع الإشعارات المرسلة نهائياً"
              >
                {clearingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                حذف جميع الإشعارات
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Label className="text-xs m-0">فلتر:</Label>
            <select
              className="border rounded-md h-8 px-2 bg-background text-xs"
              value={emailFilter}
              onChange={(e) => setEmailFilter(e.target.value as any)}
            >
              <option value="all">الكل</option>
              <option value="failed">الفاشلين فقط</option>
              <option value="sent">الواصلة فقط</option>
              <option value="pending">قيد الانتظار</option>
              <option value="suppressed">المحجوبين</option>
            </select>
            <Label className="text-xs m-0">فرز:</Label>
            <select
              className="border rounded-md h-8 px-2 bg-background text-xs"
              value={emailSort}
              onChange={(e) => setEmailSort(e.target.value as any)}
            >
              <option value="latest">آخر محاولة</option>
              <option value="oldest">الأقدم</option>
              <option value="reason">سبب الرفض</option>
              <option value="email">البريد أبجدياً</option>
            </select>
          </div>
        </div>
        {recent.length === 0 ? (
          <div className="text-xs text-muted-foreground">لا توجد إشعارات</div>
        ) : (
          <div className="space-y-2">
            {recent.map((n) => {
              const reads = readsByNotif[n.id] ?? [];
              const emails = emailsByNotif[n.id] ?? [];
              const emailStats = emails.reduce(
                (acc, e) => {
                  const s = String(e.status ?? "").toLowerCase();
                  if (s === "sent") acc.sent++;
                  else if (s === "pending" || s === "queued") acc.pending++;
                  else acc.failed++;
                  return acc;
                },
                { sent: 0, pending: 0, failed: 0 },
              );
              const isOpen = expanded === n.id;
              return (
                <div key={n.id} className="border-b last:border-0 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{n.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>
                      <div className="text-[10px] text-muted-foreground mt-1 flex flex-wrap gap-2 items-center">
                        <span>{n.target_user_id ? "مستخدم محدد" : "للجميع"}</span>
                        <span>•</span>
                        <span>{new Date(n.created_at).toLocaleString("ar-EG")}</span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 text-success font-semibold">
                          <Eye className="h-3 w-3" /> {reads.length} قراءة
                        </span>
                        {n.email_batch_id && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1">
                              <span className="text-success font-semibold">📧 {emailStats.sent}</span>
                              {emailStats.pending > 0 && (
                                <span className="text-warning font-semibold">⏳ {emailStats.pending}</span>
                              )}
                              {emailStats.failed > 0 && (
                                <span className="text-destructive font-semibold">✗ {emailStats.failed}</span>
                              )}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {n.email_batch_id && emailStats.failed > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => resendAllFailed(n)}
                          title="إعادة إرسال البريد للفاشلين"
                          className="text-warning"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setExpanded(isOpen ? null : n.id)}
                        title="عرض من قرأ"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeNotif(n.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="mt-2 mr-2 pr-3 border-r-2 border-gold/40 bg-secondary/30 rounded-l-md p-2 text-xs space-y-1 max-h-48 overflow-y-auto">
                      {n.email_batch_id && (
                        <div className="mb-2">
                          <div className="font-semibold text-[11px] mb-1">حالة البريد لكل طالب:</div>
                          {emails.length === 0 ? (
                            <div className="text-muted-foreground">لا توجد سجلات بريد بعد</div>
                          ) : (
                            <div className="space-y-0.5">
                              {(() => {
                                const filtered = emails.filter((e: any) => {
                                  const s = String(e.status ?? "").toLowerCase();
                                  if (emailFilter === "all") return true;
                                  if (emailFilter === "sent") return s === "sent";
                                  if (emailFilter === "pending") return s === "pending" || s === "queued";
                                  if (emailFilter === "suppressed") return s === "suppressed";
                                  return s && s !== "sent" && s !== "pending" && s !== "queued" && s !== "suppressed";
                                });
                                const sorted = filtered.slice().sort((a: any, b: any) => {
                                  if (emailSort === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                                  if (emailSort === "email") return String(a.recipient_email).localeCompare(String(b.recipient_email));
                                  if (emailSort === "reason") return String(a.error_message ?? "").localeCompare(String(b.error_message ?? ""));
                                  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                                });
                                if (sorted.length === 0) {
                                  return <div className="text-muted-foreground">لا توجد نتائج تطابق الفلتر</div>;
                                }
                                return sorted.map((e: any) => {
                                  const s = String(e.status ?? "").toLowerCase();
                                  const label =
                                    s === "sent" ? "✓ وصل" :
                                    s === "pending" || s === "queued" ? "⏳ بالانتظار" :
                                    s === "suppressed" ? "⊘ محجوب" :
                                    "✗ فشل";
                                  const color =
                                    s === "sent" ? "text-success" :
                                    s === "pending" || s === "queued" ? "text-warning" :
                                    "text-destructive";
                                  return (
                                    <div key={e.recipient_email} className="flex flex-col gap-0.5 py-1 border-b border-border/30 last:border-0">
                                      <div className="flex justify-between gap-2">
                                        <span className="truncate" dir="ltr">{e.recipient_email}</span>
                                        <span className="shrink-0 flex items-center gap-1">
                                          <span className="text-[10px] text-muted-foreground">
                                            {new Date(e.created_at).toLocaleString("ar-EG")}
                                          </span>
                                          <span className={`font-semibold ${color}`} title={e.error_message ?? ""}>
                                            {label}
                                          </span>
                                          {s !== "sent" && s !== "pending" && s !== "queued" && s !== "suppressed" && (
                                            <button
                                              onClick={() => resendEmail(n, e.recipient_email)}
                                              disabled={resending === `${n.id}::${e.recipient_email}`}
                                              className="text-[10px] px-1.5 py-0.5 rounded bg-warning/20 hover:bg-warning/30 text-warning font-semibold disabled:opacity-50"
                                              title="إعادة إرسال"
                                            >
                                              {resending === `${n.id}::${e.recipient_email}` ? "..." : "↻ إعادة"}
                                            </button>
                                          )}
                                        </span>
                                      </div>
                                      {e.error_message && s !== "sent" && (
                                        <div className="text-[10px] text-destructive/80 truncate" dir="ltr" title={e.error_message}>
                                          سبب: {e.error_message}
                                        </div>
                                      )}
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          )}
                          <div className="border-t border-border/50 my-2" />
                          <div className="font-semibold text-[11px] mb-1">قراءات الإشعار:</div>
                        </div>
                      )}
                      {reads.length === 0 ? (
                        <div className="text-muted-foreground">لم يقرأها أحد بعد</div>
                      ) : (
                        reads
                          .sort((a, b) => new Date(b.read_at).getTime() - new Date(a.read_at).getTime())
                          .map((r) => (
                            <div key={r.user_id} className="flex justify-between gap-2">
                              <span className="truncate">
                                <strong>{r.name ?? "—"}</strong>
                                <span className="text-muted-foreground"> ({r.email ?? r.user_id.slice(0, 8)})</span>
                              </span>
                              <span className="text-muted-foreground shrink-0" dir="ltr">
                                {new Date(r.read_at).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}
                              </span>
                            </div>
                          ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function CourseBanDialog({
  student,
  courses = [],
  onChanged,
}: {
  student: any;
  courses?: any[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const enrollments: any[] = student.enrollments ?? [];

  const enrolledCourseIds = new Set(enrollments.map((e) => e.course_id));
  const availableToEnroll = courses.filter((c) => !enrolledCourseIds.has(c.id));

  const enrollStudent = async () => {
    if (!selectedCourseId) {
      toast.error("يرجى اختيار الكورس أولاً");
      return;
    }
    setEnrolling(true);
    try {
      const { error } = await supabase.from("enrollments").upsert(
        {
          user_id: student.id,
          course_id: selectedCourseId,
          status: "active",
        },
        { onConflict: "user_id,course_id" },
      );

      if (error) throw error;

      // Best effort student count increment
      try {
        const { data: c } = await supabase
          .from("courses")
          .select("students_count")
          .eq("id", selectedCourseId)
          .maybeSingle();
        await supabase
          .from("courses")
          .update({ students_count: (c?.students_count ?? 0) + 1 })
          .eq("id", selectedCourseId);
      } catch {}

      toast.success("تم تسجيل الطالب في الكورس بنجاح!");
      setSelectedCourseId("");
      onChanged();
    } catch (err: any) {
      toast.error("فشل تسجيل الطالب: " + err?.message);
    } finally {
      setEnrolling(false);
    }
  };

  const toggle = async (courseId: string, currentlyBanned: boolean) => {
    const action = currentlyBanned ? "إلغاء حظر الكورس" : "حظر من الكورس";
    if (!confirm(`${action} للطالب "${student.name}"؟`)) return;
    const { error } = await supabase.rpc("set_enrollment_banned", {
      _user_id: student.id,
      _course_id: courseId,
      _banned: !currentlyBanned,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(currentlyBanned ? "تم فك الحظر من الكورس" : "تم الحظر من الكورس");
      onChanged();
    }
  };

  const removeCourse = async (courseId: string, courseTitle: string) => {
    if (!confirm(`هتشيل الكورس "${courseTitle}" من الطالب "${student.name}" نهائياً. تأكيد؟`)) return;
    const { error } = await supabase
      .from("enrollments")
      .delete()
      .eq("user_id", student.id)
      .eq("course_id", courseId);
    if (error) { toast.error(error.message); return; }
    // decrement students_count (best-effort)
    try {
      const { data: c } = await supabase
        .from("courses")
        .select("students_count")
        .eq("id", courseId)
        .maybeSingle();
      const next = Math.max(0, (c?.students_count ?? 1) - 1);
      await supabase.from("courses").update({ students_count: next }).eq("id", courseId);
    } catch {}
    toast.success("تم حذف الكورس من الطالب");
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="border-[#443e3e] hover:border-[#e50914]"
          title="إدارة وتسجيل كورسات الطالب"
        >
          <GraduationCap className="h-4 w-4 ml-1 text-[#e50914]" />
          كورسات ({enrollments.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md bg-[#252121] border-[#443e3e] text-white">
        <DialogHeader>
          <DialogTitle className="text-white text-base sm:text-lg">
            إدارة كورسات {student.name}
          </DialogTitle>
          <p className="text-xs text-white/60 truncate" dir="ltr">{student.email}</p>
        </DialogHeader>

        {/* Enroll in new course */}
        <div className="p-3 rounded-xl bg-[#2f2b2b] border border-[#443e3e] space-y-2 mt-2">
          <Label className="text-xs font-bold text-white flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5 text-[#e50914]" />
            تسجيل الطالب في كورس جديد:
          </Label>
          <div className="flex gap-2 items-center">
            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
              <SelectTrigger className="flex-1 bg-[#383333] border-[#484242] text-xs text-white">
                <SelectValue placeholder="اختر الكورس المراد إضافته..." />
              </SelectTrigger>
              <SelectContent className="bg-[#2f2b2b] border-[#443e3e] text-white max-h-56">
                {availableToEnroll.length === 0 ? (
                  <div className="p-2 text-xs text-white/50 text-center">
                    مسجل في كافة الكورسات المتاحة
                  </div>
                ) : (
                  availableToEnroll.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!selectedCourseId || enrolling}
              onClick={enrollStudent}
              className="bg-[#e50914] hover:bg-[#b8050e] text-white text-xs font-bold shrink-0"
            >
              {enrolling ? "جاري..." : "تأكيد الإضافة"}
            </Button>
          </div>
        </div>

        {/* Enrolled courses list */}
        <div className="mt-2">
          <div className="text-xs font-bold text-white/70 mb-2">
            الكورسات الحالية ({enrollments.length}):
          </div>
          {enrollments.length === 0 ? (
            <div className="text-xs text-white/40 text-center py-6 border border-dashed border-[#443e3e] rounded-xl">
              هذا الطالب غير مسجّل في أي كورس بعد
            </div>
          ) : (
            <div className="space-y-2 max-h-[45vh] overflow-y-auto">
              {enrollments.map((e) => {
                const banned = e.status === "banned";
                return (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-2 border border-[#443e3e] bg-[#2f2b2b] rounded-xl p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">
                        {e.courses?.title ?? "كورس"}
                      </div>
                      <div className="text-[10px] mt-0.5">
                        {banned ? (
                          <Badge className="bg-[#e50914] text-white text-[10px]">
                            محظور من الكورس
                          </Badge>
                        ) : (
                          <Badge className="bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 text-[10px]">
                            نشط
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant={banned ? "outline" : "destructive"}
                        className="text-xs h-7 px-2"
                        onClick={() => toggle(e.course_id, banned)}
                      >
                        {banned ? (
                          <>
                            <ShieldOff className="h-3 w-3 ml-1" /> فك الحظر
                          </>
                        ) : (
                          <>
                            <Ban className="h-3 w-3 ml-1" /> حظر
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2 border-[#484242] text-red-400 hover:text-white hover:bg-red-950"
                        title="حذف الكورس من الطالب نهائياً"
                        onClick={() =>
                          removeCourse(e.course_id, e.courses?.title ?? "كورس")
                        }
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BanToggleButton({ student, adminId, onChanged }: { student: any; adminId?: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  // Direct ban (no extra dialog — confirm is enough)
  const banNow = async () => {
    if (!confirm(`حظر الطالب "${student.name}"؟`)) return;
    const { error } = await supabase.rpc("set_user_banned", { _user_id: student.id, _banned: true });
    if (error) { toast.error(error.message); return; }
    if (adminId) {
      await supabase.from("admin_actions_log").insert({
        admin_id: adminId,
        action: "ban_user",
        target_user_id: student.id,
      });
    }
    toast.success("تم الحظر");
    onChanged();
  };

  const unbanNow = async () => {
    if (!reason.trim()) { toast.error("اكتب سبب إلغاء الحظر"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("set_user_banned", { _user_id: student.id, _banned: false });
    if (error) { setBusy(false); toast.error(error.message); return; }
    await supabase.rpc("admin_reset_user_devices", { _user_id: student.id });
    if (adminId) {
      await supabase.from("admin_actions_log").insert({
        admin_id: adminId,
        action: "unban_user",
        target_user_id: student.id,
        reason: reason.trim(),
      });
    }
    setBusy(false);
    setOpen(false);
    setReason("");
    toast.success("تم إلغاء الحظر");
    onChanged();
  };

  if (!student.banned) {
    return (
      <Button size="sm" variant="destructive" onClick={banNow}>
        <Ban className="h-4 w-4 ml-1" /> حظر
      </Button>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ShieldOff className="h-4 w-4 ml-1" /> إلغاء الحظر
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>تأكيد إلغاء الحظر</AlertDialogTitle>
          <AlertDialogDescription>
            هتقوم بإلغاء حظر الطالب <b>{student.name}</b> ({student.email}) وإعادة تعيين أجهزته.
            من فضلك اكتب سبب إلغاء الحظر — هيتسجل في سجل الإدارة.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="my-2">
          <Label>سبب إلغاء الحظر *</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="مثال: تواصل الطالب وأكد أن الجهاز الجديد بسبب فقدان الموبايل"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>إلغاء</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); unbanNow(); }} disabled={busy || !reason.trim()}>
            {busy ? "جاري التنفيذ..." : "تأكيد إلغاء الحظر"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function EditOrderDialog({ order, onSaved }: { order: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<string>(String(order.amount ?? ""));
  const [method, setMethod] = useState<string>(order.payment_method ?? "vodafone_cash");
  const [ref, setRef] = useState<string>(order.transaction_ref ?? "");
  const [status, setStatus] = useState<string>(order.status ?? "pending");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("orders")
      .update({
        amount: Number(amount),
        payment_method: method as any,
        transaction_ref: ref || null,
        status: status as any,
      })
      .eq("id", order.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("تم تحديث الطلب");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" title="تعديل">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تعديل الطلب</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>المبلغ (ج.م)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>طريقة الدفع</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vodafone_cash">فودافون كاش</SelectItem>
                <SelectItem value="instapay">إنستا باي</SelectItem>
                <SelectItem value="bank_transfer">تحويل بنكي / فيزا</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>المرجع / رقم العملية</Label>
            <Input value={ref} onChange={(e) => setRef(e.target.value)} />
          </div>
          <div>
            <Label>الحالة</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">قيد المراجعة</SelectItem>
                <SelectItem value="approved">مقبول</SelectItem>
                <SelectItem value="rejected">مرفوض</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>إلغاء</Button>
            <Button onClick={save} disabled={busy}>{busy ? "جاري الحفظ..." : "حفظ"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReviewsModeration() {
  const [pending, setPending] = useState<any[]>([]);
  const [approved, setApproved] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editComment, setEditComment] = useState("");
  const [editRating, setEditRating] = useState(5);
  const [editAuthor, setEditAuthor] = useState("");
  // Curated review form
  const [curatedCourse, setCuratedCourse] = useState<string>("");
  const [curatedAuthor, setCuratedAuthor] = useState("");
  const [curatedComment, setCuratedComment] = useState("");
  const [curatedRating, setCuratedRating] = useState(5);
  const [coursesList, setCoursesList] = useState<any[]>([]);
  const [curatedImage, setCuratedImage] = useState<File | null>(null);
  const [uploadingCurated, setUploadingCurated] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: rows } = await supabase
      .from("reviews")
      .select("id,user_id,course_id,rating,comment,created_at,is_approved,author_name")
      .order("created_at", { ascending: false })
      .limit(500);
    const list = (rows ?? []) as any[];
    const userIds = Array.from(new Set(list.map((r) => r.user_id)));
    const courseIds = Array.from(new Set(list.map((r) => r.course_id)));
    const [{ data: profs }, { data: courses }] = await Promise.all([
      userIds.length
        ? supabase.rpc("get_profile_directory", { _ids: userIds })
        : Promise.resolve({ data: [] as any[] }),
      courseIds.length
        ? supabase.from("courses").select("id,title,slug").in("id", courseIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const dir: Record<string, any> = {};
    for (const p of (profs ?? []) as any[]) dir[p.id] = p;
    const courseMap: Record<string, any> = {};
    for (const c of (courses ?? []) as any[]) courseMap[c.id] = c;
    const enriched = list.map((r) => ({ ...r, profile: dir[r.user_id], course: courseMap[r.course_id] }));
    setPending(enriched.filter((r) => !r.is_approved));
    setApproved(enriched.filter((r) => r.is_approved));
    const { data: allCourses } = await supabase.from("courses").select("id,title").order("title");
    setCoursesList((allCourses ?? []) as any[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    const { error } = await supabase.from("reviews").update({ is_approved: true }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم النشر");
    load();
  };

  const unapprove = async (id: string) => {
    const { error } = await supabase.from("reviews").update({ is_approved: false }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الإخفاء");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("متأكد من حذف هذا التقييم؟")) return;
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف");
    load();
  };

  const startEdit = (r: any) => {
    setEditingId(r.id);
    setEditComment(r.comment ?? "");
    setEditRating(r.rating);
    setEditAuthor(r.author_name ?? "");
  };
  const saveEdit = async (id: string) => {
    const { error } = await supabase.from("reviews").update({
      comment: editComment.trim(),
      rating: editRating,
      author_name: editAuthor.trim() || null,
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحفظ");
    setEditingId(null);
    load();
  };

  const addCurated = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (!curatedCourse) { toast.error("اختر الكورس"); return; }
    if (!curatedAuthor.trim()) { toast.error("اكتب اسم الكاتب"); return; }
    if (!curatedComment.trim() && !curatedImage) { toast.error("اكتب نص أو ارفع صورة"); return; }
    setUploadingCurated(true);
    let imageUrl: string | null = null;
    if (curatedImage) {
      const ext = curatedImage.name.split(".").pop() || "jpg";
      const path = `review-screenshots/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("course-assets")
        .upload(path, curatedImage, { contentType: curatedImage.type, upsert: false });
      if (upErr) { setUploadingCurated(false); toast.error(upErr.message); return; }
      imageUrl = supabase.storage.from("course-assets").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from("reviews").insert({
      user_id: user.id,
      course_id: curatedCourse,
      rating: curatedRating,
      comment: curatedComment.trim() || null,
      author_name: curatedAuthor.trim(),
      image_url: imageUrl,
      is_approved: true,
    } as any);
    setUploadingCurated(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم النشر");
    setCuratedCourse(""); setCuratedAuthor(""); setCuratedComment(""); setCuratedRating(5); setCuratedImage(null);
    load();
  };

  const Row = ({ r, mode }: { r: any; mode: "pending" | "approved" }) => (
    <Card className="p-4">
      {editingId === r.id ? (
        <div className="space-y-3">
          <div>
            <Label>اسم الكاتب (اتركه فارغ لاستخدام اسم المستخدم)</Label>
            <Input value={editAuthor} onChange={(e) => setEditAuthor(e.target.value)} />
          </div>
          <div>
            <Label>التقييم</Label>
            <Select value={String(editRating)} onValueChange={(v) => setEditRating(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1,2,3,4,5].map((n) => <SelectItem key={n} value={String(n)}>{n} ★</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>النص</Label>
            <Textarea value={editComment} onChange={(e) => setEditComment(e.target.value)} rows={4} />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>إلغاء</Button>
            <Button size="sm" onClick={() => saveEdit(r.id)} className="bg-gold text-gold-foreground hover:bg-gold/90">حفظ</Button>
          </div>
        </div>
      ) : (
      <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {r.profile?.avatar_url ? (
            <img src={r.profile.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover border" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-muted grid place-items-center text-sm font-bold">
              {(r.author_name ?? r.profile?.name)?.[0] ?? "?"}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">
              {r.author_name ?? r.profile?.name ?? "طالب"}
              {r.author_name && <Badge variant="secondary" className="mr-2 text-[10px]">مُحرَّر</Badge>}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {r.course?.title ?? "—"} • {new Date(r.created_at).toLocaleDateString("ar-EG")}
            </div>
            <div className="flex gap-0.5 text-gold mt-1">
              {Array.from({ length: r.rating }).map((_, i) => <span key={i}>★</span>)}
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {mode === "pending" ? (
            <Button size="sm" onClick={() => approve(r.id)} className="bg-success text-white hover:bg-success/90">موافقة</Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => unapprove(r.id)}>إخفاء</Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => startEdit(r)}><Pencil className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(r.id)}>حذف</Button>
        </div>
      </div>
      {r.comment && <p className="text-sm whitespace-pre-line mt-3 leading-relaxed">{r.comment}</p>}
      </>
      )}
    </Card>
  );

  if (loading) return <div className="text-center py-10 text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-3 border-gold/30 bg-gold/5">
        <div className="font-semibold text-primary flex items-center gap-2"><Plus className="h-4 w-4" /> إضافة تقييم مُحرَّر</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>الكورس</Label>
            <Select value={curatedCourse} onValueChange={setCuratedCourse}>
              <SelectTrigger><SelectValue placeholder="اختر كورس" /></SelectTrigger>
              <SelectContent>
                {coursesList.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>اسم الكاتب</Label>
            <Input value={curatedAuthor} onChange={(e) => setCuratedAuthor(e.target.value)} />
          </div>
          <div>
            <Label>التقييم</Label>
            <Select value={String(curatedRating)} onValueChange={(v) => setCuratedRating(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1,2,3,4,5].map((n) => <SelectItem key={n} value={String(n)}>{n} ★</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>النص</Label>
            <Textarea value={curatedComment} onChange={(e) => setCuratedComment(e.target.value)} rows={3} />
          </div>
          <div className="sm:col-span-2">
            <Label>صورة سكرين شوت (اختياري)</Label>
            <Input type="file" accept="image/*" onChange={(e) => setCuratedImage(e.target.files?.[0] ?? null)} />
            {curatedImage && <div className="text-xs text-muted-foreground mt-1">{curatedImage.name}</div>}
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={addCurated} disabled={uploadingCurated} className="bg-gold text-gold-foreground hover:bg-gold/90">{uploadingCurated ? "جاري الرفع…" : "نشر مباشرة"}</Button>
        </div>
      </Card>
      <section>
        <h3 className="font-bold text-lg mb-3">قيد الموافقة ({pending.length})</h3>
        {pending.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">لا توجد تقييمات في انتظار الموافقة.</Card>
        ) : (
          <div className="space-y-3">{pending.map((r) => <Row key={r.id} r={r} mode="pending" />)}</div>
        )}
      </section>
      <section>
        <h3 className="font-bold text-lg mb-3">المنشورة ({approved.length})</h3>
        {approved.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">لا يوجد.</Card>
        ) : (
          <div className="space-y-3">{approved.map((r) => <Row key={r.id} r={r} mode="approved" />)}</div>
        )}
      </section>
    </div>
  );
}

function DeleteUserButton({ student, onChanged }: { student: any; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const deleteFn = useServerFn(adminDeleteUser);

  const expected = student.email ?? "";
  const canDelete = confirmText.trim().toLowerCase() === expected.toLowerCase() && expected.length > 0;

  const onConfirm = async () => {
    if (!canDelete) return;
    setBusy(true);
    try {
      await deleteFn({ data: { userId: student.id } });
      toast.success("تم حذف الحساب نهائياً");
      setOpen(false);
      setConfirmText("");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الحذف");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmText(""); }}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="destructive" className="bg-destructive/90">
          <Trash2 className="h-4 w-4 ml-1" /> حذف الحساب
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>حذف الحساب نهائياً</AlertDialogTitle>
          <AlertDialogDescription>
            هتمسح حساب الطالب <b>{student.name}</b> ({student.email}) خالص — كل اشتراكاته،
            تقدمه، طلباته، ومراجعاته هتتمسح ومش هينفع يرجع. الإجراء ده <b>نهائي ولا يمكن التراجع عنه</b>.
          </AlertDialogDescription>
          <div className="text-sm text-muted-foreground">
            للتأكيد، اكتب البريد الإلكتروني للطالب:
            <div className="mt-2 font-mono text-xs bg-secondary p-2 rounded" dir="ltr">{expected}</div>
          </div>
        </AlertDialogHeader>
        <Input
          dir="ltr"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="اكتب البريد للتأكيد"
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
            disabled={busy || !canDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? "جاري الحذف..." : "حذف نهائي"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ResetDevicesButton({ student, onChanged }: { student: any; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const reset = async () => {
    if (!confirm(`إعادة تعيين أجهزة الطالب "${student.name}"؟ هيقدر يدخل من جهاز جديد بعدها.`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_reset_user_devices", { _user_id: student.id });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم إعادة تعيين الأجهزة");
    onChanged();
  };
  return (
    <Button size="sm" variant="outline" onClick={reset} disabled={busy} title="إعادة تعيين أجهزة الطالب">
      <RefreshCw className={`h-4 w-4 ml-1 ${busy ? "animate-spin" : ""}`} /> أجهزة
    </Button>
  );
}

function DeviceLimitCard() {
  const [value, setValue] = useState<number>(1);
  const [initial, setInitial] = useState<number>(1);
  const [desktopOnly, setDesktopOnly] = useState<boolean>(false);
  const [togglingDesktop, setTogglingDesktop] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data, error }, { data: dData }] = await Promise.all([
        supabase.from("app_settings").select("value").eq("key", "max_devices_per_user").maybeSingle(),
        supabase.from("app_settings").select("value").eq("key", "desktop_only_playback").maybeSingle(),
      ]);
      if (!error && data?.value != null) {
        const raw = (data.value as any)?.max ?? data.value;
        const n = typeof raw === "number" ? raw : Number(raw);
        if (Number.isFinite(n) && n >= 1) { setValue(n); setInitial(n); }
      }
      if (dData?.value != null) {
        setDesktopOnly(Boolean((dData.value as any)?.enabled ?? dData.value === true));
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!Number.isFinite(value) || value < 1 || value > 20) {
      toast.error("اختر رقم بين 1 و 20");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("set_max_devices", { _max: value });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setInitial(value);
    toast.success("تم حفظ الحد الجديد");
  };

  const toggleDesktopOnlyMode = async () => {
    const next = !desktopOnly;
    setTogglingDesktop(true);
    const { error } = await supabase.rpc("set_desktop_only_playback", { _enabled: next });
    setTogglingDesktop(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDesktopOnly(next);
    toast.success(next ? "تم تفعيل حماية التشغيل الحصري عبر تطبيق الديسكتوب" : "تم السماح بالتشغيل عبر المتصفح وتطبيق الديسكتوب معاً");
  };

  const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") || "";
  const [cloudStatus, setCloudStatus] = useState<{ mode: string; cloudHost: string | null; connectedClients: number } | null>(null);
  const [cloudUrlInput, setCloudUrlInput] = useState("");
  const [connectingCloud, setConnectingCloud] = useState(false);
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [sendingPush, setSendingPush] = useState(false);

  useEffect(() => {
    supabase.rpc("admin_get_cloud_status").then(({ data }) => {
      if (data) setCloudStatus(data as any);
    });
  }, []);

  const connectCloudDb = async () => {
    setConnectingCloud(true);
    const { data, error } = await supabase.rpc("admin_connect_cloud_db", { _database_url: cloudUrlInput.trim() });
    setConnectingCloud(false);
    if (error) {
      toast.error(error.message || "فشل الاتصال بقاعدة البيانات السحابية");
      return;
    }
    setCloudStatus((prev) => ({
      mode: (data as any)?.mode || "pg",
      cloudHost: (data as any)?.cloudHost || null,
      connectedClients: prev?.connectedClients ?? 0,
    }));
    toast.success(
      (data as any)?.cloudHost
        ? `تم الربط وترحيل جميع الجداول إلى السحابة (${(data as any).cloudHost}) بنجاح! 🚀`
        : "تم التبديل لقاعدة البيانات المستقلة المحلية للتطبيقات",
    );
  };

  const sendLivePush = async () => {
    if (!pushBody.trim()) {
      toast.error("اكتب نص التنبيه الفوري أولاً");
      return;
    }
    setSendingPush(true);
    const { data, error } = await supabase.rpc("admin_send_live_push", {
      _title: pushTitle.trim() || "تنبيه جديد من م. إيهاب الجلالي 🔔",
      _body: pushBody.trim(),
    });
    setSendingPush(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPushBody("");
    toast.success(`تم بث الإشعار لحظياً إلى ${(data as any)?.sentTo ?? 0} جهاز متصل الآن!`);
  };

  return (
    <div className="space-y-3 mb-3">
      {/* Independent Cloud DB & Real-Time Sync Hub */}
      <Card className="p-4 space-y-3 border-emerald-500/30 bg-emerald-950/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-bold flex items-center gap-2">
              <span>☁️ قاعدة البيانات السحابية المستقلة (الديسكتوب + الموبايل)</span>
              <Badge variant={cloudStatus?.mode === "pg" ? "default" : "secondary"}>
                {cloudStatus?.mode === "pg"
                  ? `متصل سحابياً • ${cloudStatus.cloudHost || "Cloud PostgreSQL"}`
                  : "مستقلة محلياً (Apps Isolated DB)"}
              </Badge>
              <Badge variant="outline">الأجهزة المتصلة لحظياً: {cloudStatus?.connectedClients ?? 0}</Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              هذه القاعدة مفصولة 100% عن الموقع؛ الصق رابط <strong>Neon.tech</strong> أو <strong>Supabase</strong> أو <strong>Railway PostgreSQL</strong> هنا ليتم إنشاء الجداول تلقائياً على السحابة وتسمّع عند كل الطلاب بدون الحاجة لفتح جهازك!
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            dir="ltr"
            placeholder="postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require"
            value={cloudUrlInput}
            onChange={(e) => setCloudUrlInput(e.target.value)}
            className="flex-1 font-mono text-xs"
          />
          <Button onClick={connectCloudDb} disabled={connectingCloud}>
            {connectingCloud ? "جاري الربط والترحيل..." : "ربط الداتا بيز السحابية فوراً"}
          </Button>
        </div>

        {/* Instant Live Push Broadcast */}
        <div className="pt-3 border-t border-border/50 space-y-2">
          <div className="text-xs font-bold">🔔 إرسال تنبيه لحظي فوري (يظهر فوراً على شاشة الديسكتوب والموبايل لكل الطلاب المتصلين)</div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <Input
              placeholder="عنوان التنبيه (اختياري)"
              value={pushTitle}
              onChange={(e) => setPushTitle(e.target.value)}
              className="sm:col-span-4 text-xs"
            />
            <Input
              placeholder="نص الرسالة الفورية (مثال: تم نزول محاضرة جديدة في كورس المونتاج الآن!)"
              value={pushBody}
              onChange={(e) => setPushBody(e.target.value)}
              className="sm:col-span-6 text-xs"
            />
            <Button variant="secondary" onClick={sendLivePush} disabled={sendingPush} className="sm:col-span-2">
              {sendingPush ? "يرسل..." : "إرسال الآن"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">عدد الأجهزة المسموح بها لكل طالب</div>
          <div className="text-xs text-muted-foreground mt-1">
            يربط الحساب ببصمة الهاردوير الحقيقية على الكمبيوتر (`Windows MachineGuid`) وعلى الموبايل (`Android Hardware ID`).
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={20}
            value={loading ? "" : value}
            onChange={(e) => setValue(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
            className="w-24 text-center"
            disabled={loading || saving}
          />
          <Button onClick={save} disabled={loading || saving || value === initial}>
            {saving ? "جاري الحفظ..." : "حفظ"}
          </Button>
        </div>
      </Card>

      <Card className="p-4 flex flex-wrap items-center justify-between gap-3 border-rose-500/25 bg-rose-950/10">
        <div className="min-w-0">
          <div className="font-semibold flex items-center gap-2">
            <span>حماية تطبيقات (الديسكتوب + الموبايل) الرسمية — م. إيهاب الجلالي</span>
            <Badge variant={desktopOnly ? "default" : "secondary"}>
              {desktopOnly ? "حصري للتطبيقات فقط" : "متاح للتجربة + التطبيقات"}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            عند التفعيل، تعمل الفيديوهات حصرياً داخل تطبيق الويندوز (`.exe`) وتطبيق الأندرويد (`.apk`) المحميين ضد التصوير.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`${apiBase}/api/public/desktop-download`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 hover:bg-background px-3 py-2 text-xs font-semibold transition-colors"
          >
            <span>تحميل نسخة الويندوز (.exe)</span>
          </a>
          <a
            href={`${apiBase}/api/public/mobile-download`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 px-3 py-2 text-xs font-semibold transition-colors"
          >
            <span>تحميل نسخة الموبايل (.apk)</span>
          </a>
          <Button
            variant={desktopOnly ? "destructive" : "default"}
            onClick={toggleDesktopOnlyMode}
            disabled={loading || togglingDesktop}
          >
            {togglingDesktop
              ? "جاري التحديث..."
              : desktopOnly
                ? "إلغاء الحصر"
                : "حصر التشغيل على التطبيقات فقط"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function MetaMarketingCard() {
  const [feedOrigin, setFeedOrigin] = useState<string>("https://fekradesign.shalaby3.online");
  const [pixelsText, setPixelsText] = useState<string>("");
  const [initialText, setInitialText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [feedToken, setFeedToken] = useState<string>("");
  const [tokenBusy, setTokenBusy] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") setFeedOrigin(window.location.origin);
    (async () => {
      const [{ data: pxRow }, { data: tokRow }] = await Promise.all([
        supabase.from("app_settings").select("value").eq("key", "meta_pixel_ids").maybeSingle(),
        supabase.from("app_settings").select("value").eq("key", "meta_feed_token").maybeSingle(),
      ]);
      const raw = (pxRow?.value as { ids?: unknown } | null)?.ids;
      const ids = Array.isArray(raw) ? raw.map((v) => String(v).trim()).filter(Boolean) : [];
      const text = ids.join("\n");
      setPixelsText(text);
      setInitialText(text);
      const tok = (tokRow?.value as { token?: string } | null)?.token ?? "";
      setFeedToken(tok);
      setLoading(false);
    })();
  }, []);

  const feedUrl = feedToken
    ? `${feedOrigin}/api/public/meta-feed/${feedToken}/channel/meta`
    : "";

  const generateToken = (): string => {
    const bytes = new Uint8Array(24);
    (globalThis.crypto ?? window.crypto).getRandomValues(bytes);
    // URL-safe base64
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const saveToken = async (newToken: string) => {
    setTokenBusy(true);
    const { error } = await supabase.from("app_settings").upsert({
      key: "meta_feed_token",
      value: { token: newToken },
      updated_at: new Date().toISOString(),
    });
    setTokenBusy(false);
    if (error) {
      toast.error(error.message);
      return false;
    }
    setFeedToken(newToken);
    return true;
  };

  const createFeed = async () => {
    const t = generateToken();
    const ok = await saveToken(t);
    if (ok) toast.success("تم إنشاء رابط الفيد");
  };

  const regenerateFeed = async () => {
    if (!confirm("توليد رابط جديد سيوقف الرابط الحالي. متأكد؟")) return;
    const t = generateToken();
    const ok = await saveToken(t);
    if (ok) toast.success("تم توليد رابط جديد. حدّث الرابط في Meta.");
  };

  const deleteFeed = async () => {
    if (!confirm("حذف رابط الفيد؟ لن يعمل حتى تنشئ رابطاً جديداً.")) return;
    setTokenBusy(true);
    const { error } = await supabase.from("app_settings").upsert({
      key: "meta_feed_token",
      value: { token: "" },
      updated_at: new Date().toISOString(),
    });
    setTokenBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setFeedToken("");
    toast.success("تم حذف رابط الفيد");
  };

  const copy = async (v: string) => {
    try {
      await navigator.clipboard.writeText(v);
      toast.success("تم النسخ");
    } catch {
      toast.error("فشل النسخ");
    }
  };

  const parseIds = (text: string): string[] => {
    return Array.from(
      new Set(
        text
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    );
  };

  const save = async () => {
    const ids = parseIds(pixelsText);
    const invalid = ids.filter((v) => !/^\d{6,20}$/.test(v));
    if (invalid.length > 0) {
      toast.error(`أرقام غير صالحة: ${invalid.join(", ")}`);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert({
      key: "meta_pixel_ids",
      value: { ids },
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setInitialText(ids.join("\n"));
    setPixelsText(ids.join("\n"));
    toast.success(ids.length === 0 ? "تم حذف كل البيكسلات" : `تم حفظ ${ids.length} بيكسل`);
  };

  const clearAll = async () => {
    if (!confirm("حذف كل أكواد Meta Pixel من الموقع؟")) return;
    setClearing(true);
    const { error } = await supabase.from("app_settings").upsert({
      key: "meta_pixel_ids",
      value: { ids: [] },
      updated_at: new Date().toISOString(),
    });
    setClearing(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPixelsText("");
    setInitialText("");
    toast.success("تم الحذف");
  };

  return (
    <div className="space-y-4" dir="rtl">
      <Card className="p-5 space-y-4">
        <div>
          <div className="font-semibold flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            Meta Product Feed
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            رابط ملف الكورسات لكاتالوج Meta Commerce Manager (CSV، عملة EGP). الرابط بتوكن سري — لو حذفته أو غيّرته الرابط القديم يبطل فوراً.
          </div>
        </div>
        {feedToken ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Input value={feedUrl} readOnly className="flex-1 min-w-[260px] text-left font-mono text-xs" dir="ltr" />
              <Button type="button" variant="outline" onClick={() => copy(feedUrl)}>
                <Copy className="h-4 w-4 ml-1" /> نسخ
              </Button>
              <Button type="button" variant="outline" asChild>
                <a href={feedUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4 ml-1" /> فتح
                </a>
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <Button type="button" variant="outline" onClick={regenerateFeed} disabled={tokenBusy}>
                <RotateCw className={`h-4 w-4 ml-1 ${tokenBusy ? "animate-spin" : ""}`} /> توليد رابط جديد
              </Button>
              <Button type="button" variant="destructive" onClick={deleteFeed} disabled={tokenBusy}>
                <Trash2 className="h-4 w-4 ml-1" /> حذف الرابط
              </Button>
            </div>
            <div className="text-xs text-muted-foreground bg-secondary/50 rounded-md p-3 leading-6">
              خطوات الإضافة في Meta: Commerce Manager ← Catalog ← Data Sources ← Add Products ← Scheduled Feed
              والصق الرابط ده. اختر تحديث يومي.
            </div>
          </>
        ) : (
          <div className="rounded-md border border-dashed p-4 text-center space-y-3">
            <div className="text-sm text-muted-foreground">
              لا يوجد رابط فيد حالياً. اضغط الزر لإنشاء رابط بتوكن سري.
            </div>
            <Button type="button" onClick={createFeed} disabled={tokenBusy}>
              <Plus className="h-4 w-4 ml-1" /> إنشاء رابط Meta Feed
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-4">
        <div>
          <div className="font-semibold">أكواد Meta Pixel</div>
          <div className="text-xs text-muted-foreground mt-1">
            ضِف رقم أو أكثر (كل واحد في سطر أو مفصول بفاصلة). لو مسحت الكل، البيكسل هيتشال من الموقع بالكامل.
          </div>
        </div>
        <Textarea
          value={loading ? "" : pixelsText}
          onChange={(e) => setPixelsText(e.target.value)}
          placeholder="1486972089141361&#10;1513407397182509"
          className="min-h-[110px] font-mono text-left"
          dir="ltr"
          disabled={loading || saving || clearing}
        />
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="text-xs text-muted-foreground">
            {loading ? "جاري التحميل..." : `${parseIds(pixelsText).length} بيكسل`}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={clearAll}
              disabled={loading || saving || clearing || initialText.length === 0}
            >
              <Trash2 className="h-4 w-4 ml-1" /> حذف الكل
            </Button>
            <Button
              type="button"
              onClick={save}
              disabled={loading || saving || clearing || pixelsText === initialText}
            >
              {saving ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground bg-secondary/50 rounded-md p-3 leading-6">
          التغيير بيسري خلال دقايق (كاش 5 دقايق). لو مسحت الكل، مفيش أي كود تتبع هيتحمل عند زيارة الموقع.
        </div>
      </Card>
    </div>
  );
}
