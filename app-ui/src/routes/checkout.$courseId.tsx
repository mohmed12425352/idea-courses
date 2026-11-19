import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SiteShell } from "@/components/layout/SiteShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Wallet,
  CheckCircle2,
  Copy,
  Loader2,
  ShieldCheck,
  CreditCard,
  ExternalLink,
  RefreshCw,
  Clock,
  Sparkles,
  Lock,
  Tag,
  Zap,
  Award,
  DownloadCloud,
  Layers,
  ArrowRight,
  HelpCircle,
  XCircle,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { checkKashierOrderStatus, createKashierSession } from "@/lib/kashier.functions";
import { fbqTrack } from "@/lib/pixel";
import { usePricing } from "@/lib/pricing";
import { MascotLoader } from "@/components/common/MascotLoader";
import { STATIC_COURSES } from "@/lib/staticCoursesData";

export const Route = createFileRoute("/checkout/$courseId")({
  loader: async ({ params }) => {
    try {
      const { data } = await supabase
        .from("courses")
        .select("*")
        .eq("id", params.courseId)
        .maybeSingle();
      return { initialCourse: data };
    } catch {
      return { initialCourse: null };
    }
  },
  head: () => ({
    meta: [
      { title: "إتمام الشراء والدفع الآمن — Idea Courses" },
      { name: "description", content: "أكمل عملية شراء الكورس بأمان عبر بوابة الدفع الإلكترونية المعتمدة — Idea Courses." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CheckoutPage,
});

const AUTO_METHODS = {
  wallet: {
    id: "wallet",
    label: "المحافظ الإلكترونية و InstaPay",
    sublabel: "فودافون كاش • إنستاباي • أورنج • اتصالات • WE Pay",
    desc: "ادفع بسهولة عبر رقم المحفظة أو إنستاباي — يتم التحقق والتفعيل الفوري تلقائياً.",
    icon: Wallet,
    badges: ["Vodafone Cash", "InstaPay", "Orange Cash", "Etisalat", "WE Pay"],
    kashier: "wallet",
    popular: true,
  },
  card: {
    id: "card",
    label: "البطاقات البنكية المباشرة",
    sublabel: "فيزا • ماستركارد • ميزة (Visa / MasterCard / Meeza)",
    desc: "دفع مشفّر وآمن ببطاقتك الائتمانية أو بطاقة الخصم المباشر وميزة عبر كاشير.",
    icon: CreditCard,
    badges: ["Visa", "Mastercard", "Meeza"],
    kashier: "card",
    popular: false,
  },
} as const;

type PayMethod = "wallet" | "card";

type PaymentTracker = {
  orderRef: string;
  checkoutUrl: string;
  courseId: string;
};

const PENDING_PAYMENT_KEY = "fekra_pending_kashier_payment";

function readCourseSlug(order: unknown): string | undefined {
  const courses = (order as { courses?: { slug?: string } | Array<{ slug?: string }> })?.courses;
  return Array.isArray(courses) ? courses[0]?.slug : courses?.slug;
}

function CheckoutPage() {
  const { courseId } = Route.useParams();
  const loaderData = Route.useLoaderData();
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const { adjust } = usePricing();
  const isValidCourseId = !!courseId && courseId !== "undefined" && courseId !== "null";
  const [course, setCourse] = useState<any>(() => loaderData?.initialCourse || null);
  const [method, setMethod] = useState<PayMethod>("wallet");
  const [coupon, setCoupon] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [paying, setPaying] = useState(false);
  const [paymentTracker, setPaymentTracker] = useState<PaymentTracker | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [paymentApproved, setPaymentApproved] = useState(false);
  const createKashierSessionFn = useServerFn(createKashierSession);
  const checkKashierOrderStatusFn = useServerFn(checkKashierOrderStatus);

  useEffect(() => {
    if (!isValidCourseId) {
      nav({ to: "/courses" });
      return;
    }
    if (authLoading) return;
    if (!user) {
      nav({ to: "/register", search: { redirect: `/checkout/${courseId}` } });
      return;
    }
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(courseId);
    let resolvedCourse: any = null;

    const coursePromise = isUuid
      ? supabase.from("courses").select("*").eq("id", courseId).maybeSingle()
      : supabase.from("courses").select("*").eq("slug", courseId).maybeSingle();

    Promise.resolve(coursePromise)
      .then(({ data }) => {
        if (data) {
          resolvedCourse = data;
          setCourse(data);
        } else {
          const fallback = STATIC_COURSES.find((c) => c.id === courseId || c.slug === courseId);
          if (fallback) {
            resolvedCourse = fallback;
            setCourse(fallback);
          }
        }
      })
      .catch(() => {
        const fallback = STATIC_COURSES.find((c) => c.id === courseId || c.slug === courseId);
        if (fallback) {
          resolvedCourse = fallback;
          setCourse(fallback);
        }
      })
      .finally(() => {
        supabase
          .from("enrollments")
          .select("id, course_id, status, courses(id, slug)")
          .eq("user_id", user.id)
          .neq("status", "banned")
          .then(({ data }) => {
            if (data && data.length > 0) {
              const matched = data.find((e: any) => {
                const cRef = e.courses as any;
                return (
                  e.course_id === courseId ||
                  cRef?.id === courseId ||
                  cRef?.slug === courseId ||
                  (resolvedCourse && (e.course_id === resolvedCourse.id || cRef?.id === resolvedCourse.id))
                );
              });
              if (matched) {
                toast.info("أنت مشترك في هذا الكورس بالفعل!");
                const slug = (matched as any)?.courses?.slug || resolvedCourse?.slug || courseId;
                if (slug) nav({ to: "/learn/$slug", params: { slug } });
                else nav({ to: "/dashboard" });
              }
            }
          });
      });
  }, [courseId, user, nav, isValidCourseId, authLoading]);

  useEffect(() => {
    if (!course) return;
    fbqTrack("InitiateCheckout", {
      content_ids: [course.id],
      content_name: course.title,
      content_type: "product",
      value: course.discount_price ?? course.price,
      currency: "EGP",
    });
  }, [course]);

  useEffect(() => {
    if (!isValidCourseId || paymentTracker) return;
    try {
      const saved = window.localStorage.getItem(PENDING_PAYMENT_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as PaymentTracker;
      if (parsed?.courseId === courseId && parsed.orderRef && parsed.checkoutUrl) {
        setPaymentTracker(parsed);
      }
    } catch {
      window.localStorage.removeItem(PENDING_PAYMENT_KEY);
    }
  }, [courseId, isValidCourseId, paymentTracker]);

  useEffect(() => {
    if (!paymentTracker || paymentApproved) return;
    let cancelled = false;
    let timer: number | undefined;

    const check = async () => {
      setVerifyingPayment(true);
      try {
        const res = await checkKashierOrderStatusFn({ data: { orderRef: paymentTracker.orderRef } });
        if (cancelled) return;
        if (res?.ok) {
          setPaymentApproved(true);
          window.localStorage.removeItem(PENDING_PAYMENT_KEY);
          toast.success("تهانينا! تم تأكيد الدفع وتفعيل الكورس في حسابك 🎉");
          timer = window.setTimeout(() => {
            const slug = res.slug || readCourseSlug(res.order);
            if (slug) nav({ to: "/learn/$slug", params: { slug } });
            else nav({ to: "/dashboard", search: { paid: "1", ref: paymentTracker.orderRef } });
          }, 1200);
          return;
        }
      } catch (err) {
        console.warn("Payment status check failed", err);
      } finally {
        if (!cancelled) setVerifyingPayment(false);
      }
      if (!cancelled) timer = window.setTimeout(check, 3500);
    };

    check();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [checkKashierOrderStatusFn, nav, paymentApproved, paymentTracker]);

  if (!course) {
    return (
      <SiteShell>
        <div className="container-page py-28 flex flex-col items-center justify-center min-h-[60vh]">
          <MascotLoader size="lg" message="جاري تجهيز صفحة الدفع..." />
        </div>
      </SiteShell>
    );
  }

  const base = adjust(course.discount_price ?? course.price);
  const listPrice = adjust(course.price);
  let final = base;
  let discountAmount = 0;

  if (appliedCoupon) {
    if (appliedCoupon.discount_type === "percentage") {
      discountAmount = Math.round((base * appliedCoupon.discount_value) / 100);
      final = Math.max(0, base - discountAmount);
    } else {
      discountAmount = Math.min(base, appliedCoupon.discount_value);
      final = Math.max(0, base - discountAmount);
    }
  }

  const totalSavings = (listPrice - base) + discountAmount;

  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    setCouponLoading(true);
    try {
      const { data, error } = await supabase.rpc("validate_coupon", { _code: coupon.trim() });
      const row = Array.isArray(data) ? data[0] : null;
      if (error || !row) {
        toast.error("كود الخصم غير صحيح أو منتهي الصلاحية");
        return;
      }
      setAppliedCoupon(row);
      toast.success("تم تطبيق كود الخصم بنجاح! 🎉");
    } catch {
      toast.error("حدث خطأ أثناء فحص كود الخصم");
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCoupon("");
    toast.info("تمت إزالة كود الخصم");
  };

  const payWithKashier = async () => {
    if (!user || !course?.id) return;
    const paymentWindow = window.open("about:blank", "_blank");
    const amt = Number(final);
    if (!Number.isFinite(amt) || amt <= 0) {
      paymentWindow?.close();
      toast.error("المبلغ غير صالح. تأكد من سعر الكورس أو كود الخصم.");
      return;
    }
    setPaying(true);
    try {
      const kashierMethod = method === "card" ? "card" : "wallet";
      const result = await createKashierSessionFn({
        data: {
          courseId: course.id,
          amount: amt,
          couponCode: appliedCoupon?.code ?? null,
          methods: kashierMethod,
        },
      });
      if (!result?.ok) {
        paymentWindow?.close();
        toast.error(result?.error ?? "تعذّر فتح بوابة الدفع");
        setPaying(false);
        return;
      }
      const tracker = { orderRef: result.orderRef, checkoutUrl: result.checkoutUrl, courseId: course.id };
      setPaymentTracker(tracker);
      window.localStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(tracker));
      if (paymentWindow) {
        paymentWindow.location.href = result.checkoutUrl;
        toast.info("تم فتح بوابة الدفع الآمنة في تبويب جديد. سنتابع تأكيد الدفع تلقائياً هنا.");
      } else {
        toast.info("اضغط زر «فتح بوابة الدفع» لإكمال الدفع، وسنتابع التأكيد تلقائياً.");
      }
      setPaying(false);
    } catch (e: any) {
      paymentWindow?.close();
      const msg = typeof e?.message === "string" ? e.message : "تعذّر فتح بوابة الدفع";
      toast.error(msg);
      setPaying(false);
    }
  };

  const openPaymentGateway = () => {
    if (!paymentTracker?.checkoutUrl) return;
    window.open(paymentTracker.checkoutUrl, "_blank", "noopener,noreferrer");
  };

  const recheckPaymentNow = async () => {
    if (!paymentTracker) return;
    setVerifyingPayment(true);
    try {
      const res = await checkKashierOrderStatusFn({ data: { orderRef: paymentTracker.orderRef } });
      if (res?.ok) {
        setPaymentApproved(true);
        window.localStorage.removeItem(PENDING_PAYMENT_KEY);
        toast.success("تم تأكيد الدفع وتفعيل الكورس بنجاح!");
        const slug = res.slug || readCourseSlug(res.order);
        if (slug) nav({ to: "/learn/$slug", params: { slug } });
        else nav({ to: "/dashboard", search: { paid: "1", ref: paymentTracker.orderRef } });
      } else {
        toast.info("في انتظار اكتمال الدفع من البوابة. يتم الفحص التلقائي باستمرار.");
      }
    } catch {
      toast.error("تعذّر فحص حالة الدفع الآن، يُرجى المحاولة لاحقاً.");
    } finally {
      setVerifyingPayment(false);
    }
  };

  return (
    <SiteShell>
      <div className="container-page py-10 max-w-6xl">
        {/* Progress Breadcrumbs */}
        <div className="flex items-center justify-between gap-2 md:gap-4 mb-8 text-xs md:text-sm font-medium border-b border-border/60 pb-5 overflow-x-auto">
          <Link to="/courses" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500/15 text-emerald-500 text-xs font-bold">✓</span>
            <span>1. اختيار الكورس</span>
          </Link>
          <span className="text-muted-foreground/40 shrink-0">←</span>
          <div className="flex items-center gap-2 text-gold font-bold shrink-0">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-gold text-primary-foreground text-xs font-bold">2</span>
            <span>2. بيانات الدفع والخصم</span>
          </div>
          <span className="text-muted-foreground/40 shrink-0">←</span>
          <div className="flex items-center gap-2 text-muted-foreground/60 shrink-0">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-muted-foreground text-xs font-bold">3</span>
            <span>3. بدء المشاهدة الفورية</span>
          </div>
        </div>

        {/* Page Title & Trust Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
              <span>إتمام الاشتراك والطلب</span>
              <Badge variant="outline" className="border-gold/40 text-gold bg-gold/10 font-medium text-xs px-2.5 py-0.5">
                تشفير آمن 100%
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              اختر وسيلة الدفع المناسبة واستمتع بوصول فوري وشامل لجميع محتويات الكورس.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 px-3.5 py-2 rounded-xl border border-border/50 self-start md:self-auto">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>معتمد ومرخص من البنك المركزي المصري عبر Kashier</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_390px] gap-8 items-start">
          {/* Main Content Column */}
          <div className="space-y-6">
            {/* Payment Method Selector */}
            <Card className="p-6 border-border/80 shadow-sm bg-card/70 backdrop-blur-sm rounded-2xl relative overflow-hidden">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-md bg-gold/15 text-gold text-xs font-black">1</span>
                    اختر طريقة الدفع المفضلة
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    جميع الطرق تتيح تفعيل الكورس فورياً في حسابك دون أي انتظار.
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-1 gap-3.5">
                {(Object.keys(AUTO_METHODS) as Array<keyof typeof AUTO_METHODS>).map((k) => {
                  const m = AUTO_METHODS[k];
                  const Icon = m.icon;
                  const isSelected = method === k;

                  return (
                    <div
                      key={k}
                      onClick={() => setMethod(k as PayMethod)}
                      className={`relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 md:p-5 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? "border-gold bg-gold/5 shadow-md shadow-gold/5 ring-1 ring-gold/20"
                          : "border-border/70 hover:border-border hover:bg-secondary/30 bg-background/50"
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`mt-0.5 grid h-10 w-10 place-items-center rounded-xl transition-colors shrink-0 ${
                            isSelected ? "bg-gold text-primary-foreground font-bold shadow-sm shadow-gold/30" : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-foreground text-base">{m.label}</span>
                            {m.popular && (
                              <span className="bg-gradient-to-r from-amber-500 to-gold text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                                الأكثر استخداماً ⚡
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{m.desc}</p>
                          
                          {/* Badges / Supported providers */}
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {m.badges.map((b) => (
                              <span
                                key={b}
                                className={`text-[11px] px-2 py-0.5 rounded-md border font-medium ${
                                  isSelected
                                    ? "bg-gold/15 border-gold/30 text-gold-foreground font-semibold dark:text-gold"
                                    : "bg-secondary/70 border-border/60 text-muted-foreground"
                                }`}
                              >
                                {b}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <span
                          className={`grid h-6 w-6 place-items-center rounded-full border-2 transition-all ${
                            isSelected
                              ? "border-gold bg-gold text-primary-foreground"
                              : "border-muted-foreground/30 bg-background"
                          }`}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Active Payment Tracker Polling */}
            {paymentTracker && (
              <Card className="p-6 border-gold/50 bg-gradient-to-br from-gold/10 via-background to-gold/5 shadow-md shadow-gold/5 rounded-2xl">
                <div className="flex items-start gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-gold/20 text-gold shrink-0 animate-pulse">
                    {paymentApproved ? <CheckCircle2 className="h-6 w-6 text-emerald-500" /> : <Clock className="h-6 w-6" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-lg font-bold text-foreground">
                        {paymentApproved ? "تم تأكيد الدفع بنجاح 🎉" : "جاري متابعة إتمام الدفع..."}
                      </h3>
                      <Badge variant="outline" className="bg-background/80 text-xs border-gold/40 text-gold">
                        رقم العملية: {paymentTracker.orderRef}
                      </Badge>
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                      إذا كنت قد أتممت الدفع في بوابة Kashier ولم يتم تحويلك تلقائياً، اترك هذه الصفحة مفتوحة أو اضغط على زر "فحص الدفع الآن".
                    </p>

                    <div className="flex flex-wrap gap-2.5 mt-4">
                      <Button onClick={openPaymentGateway} variant="outline" size="sm" className="rounded-xl border-border/80 hover:bg-secondary">
                        <ExternalLink className="h-4 w-4 ml-1.5" /> إعادة فتح بوابة الدفع
                      </Button>
                      <Button
                        onClick={recheckPaymentNow}
                        disabled={verifyingPayment || paymentApproved}
                        size="sm"
                        className="bg-gold text-primary-foreground font-bold hover:bg-gold/90 shadow-sm shadow-gold/20 rounded-xl"
                      >
                        {verifyingPayment ? <Loader2 className="h-4 w-4 ml-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 ml-1.5" />}
                        فحص الدفع الآن
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Guarantees & Features Grid */}
            <Card className="p-6 border-border/80 shadow-sm bg-card/60 backdrop-blur-sm rounded-2xl">
              <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                ضمانات ومميزات اشتراكك في المنصة
              </h2>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-secondary/30 border border-border/50">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-500 shrink-0">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">تفعيل فوري مباشر</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">يبدأ وصولك للدروس فور تأكيد الدفع آلياً دون انتظار.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-secondary/30 border border-border/50">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-gold/10 text-gold shrink-0">
                    <Award className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">شهادة إتمام الكورس</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">شهادة رقمية برمز تحقق QR Code خاص بكل متدرب.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-secondary/30 border border-border/50">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-500/10 text-blue-500 shrink-0">
                    <DownloadCloud className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">ملفات ومشاريع العمل</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">تحميل كامل للملحقات والقوالب التدريبية المرفقة.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-secondary/30 border border-border/50">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-purple-500/10 text-purple-500 shrink-0">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">وصول دائم وتحديثات</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">مشاهدة غير محدودة من أي جهاز مع جميع التحديثات القادمة.</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Sticky Order Summary Sidebar */}
          <div className="sticky top-24 space-y-4">
            <Card className="p-6 border-border/80 shadow-lg shadow-black/5 bg-card rounded-2xl relative overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-border/60 mb-5">
                <h2 className="text-lg font-bold text-foreground">ملخص الطلب</h2>
                <Badge variant="secondary" className="text-xs font-semibold">
                  1 كورس
                </Badge>
              </div>

              {/* Course Item Mini Card */}
              <div className="flex gap-3.5 items-start p-3 rounded-xl bg-secondary/40 border border-border/50 mb-5">
                {course.image_url ? (
                  <img
                    src={course.image_url}
                    alt={course.title}
                    className="w-16 h-16 rounded-lg object-cover shrink-0 border border-border/60 shadow-xs"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gold/10 grid place-items-center text-gold shrink-0 border border-gold/20 font-bold text-lg">
                    FD
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-foreground line-clamp-2 leading-snug">
                    {course.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-emerald-500/40 text-emerald-500 bg-emerald-500/5">
                      وصول كامل
                    </Badge>
                    {course.level && (
                      <span className="text-[10px] text-muted-foreground">
                        {course.level === "beginner" ? "مبتدئ" : course.level === "intermediate" ? "متوسط" : "متقدم"}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Coupon Box */}
              <div className="mb-5">
                <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  هل لديك كوبون خصم؟
                </Label>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <Tag className="h-4 w-4" />
                      <span>الكوبون: {appliedCoupon.code}</span>
                      <span className="text-[10px] bg-emerald-500/20 px-1.5 py-0.5 rounded">
                        -{appliedCoupon.discount_type === "percentage" ? `${appliedCoupon.discount_value}%` : `${appliedCoupon.discount_value} ج.م`}
                      </span>
                    </div>
                    <button
                      onClick={removeCoupon}
                      className="text-xs text-muted-foreground hover:text-destructive p-1 transition-colors"
                      title="إزالة الكوبون"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={coupon}
                        onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                        placeholder="أدخل كود الخصم"
                        className="pr-9 h-10 text-xs rounded-xl uppercase font-mono"
                      />
                    </div>
                    <Button
                      variant="outline"
                      onClick={applyCoupon}
                      disabled={couponLoading || !coupon.trim()}
                      className="h-10 px-4 rounded-xl text-xs font-bold border-border/80 hover:bg-secondary"
                    >
                      {couponLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "تطبيق"}
                    </Button>
                  </div>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2.5 text-xs border-t border-border/60 pt-4 mb-4">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>السعر الأصلي:</span>
                  <span className={course.discount_price ? "line-through text-muted-foreground/70" : "font-semibold text-foreground"}>
                    {listPrice} ج.م
                  </span>
                </div>

                {course.discount_price && (
                  <div className="flex justify-between items-center text-emerald-500 font-medium">
                    <span>خصم المنصة:</span>
                    <span>-{(listPrice - base)} ج.م</span>
                  </div>
                )}

                {appliedCoupon && (
                  <div className="flex justify-between items-center text-emerald-500 font-bold">
                    <span>خصم الكوبون ({appliedCoupon.code}):</span>
                    <span>-{discountAmount} ج.م</span>
                  </div>
                )}

                {totalSavings > 0 && (
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold text-center flex items-center justify-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    وفرت اليوم إجمالي {totalSavings} ج.م
                  </div>
                )}
              </div>

              {/* Final Total */}
              <div className="border-t border-border/80 pt-4 pb-1 mb-5 flex justify-between items-baseline">
                <div>
                  <span className="text-sm font-bold text-foreground block">المبلغ الإجمالي</span>
                  <span className="text-[10px] text-muted-foreground">شامل كافة الرسوم والمحتوى</span>
                </div>
                <div className="text-left">
                  <div className="text-2xl font-black text-gold tracking-tight">
                    {final} <span className="text-sm font-bold text-foreground">ج.م</span>
                  </div>
                </div>
              </div>

              {/* Primary CTA Button */}
              <Button
                onClick={paymentTracker ? openPaymentGateway : payWithKashier}
                disabled={paying}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 via-gold to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-sm md:text-base shadow-lg shadow-gold/25 hover:shadow-xl hover:shadow-gold/30 transition-all duration-200"
              >
                {paying ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>جاري تجهيز بوابة الدفع...</span>
                  </div>
                ) : paymentTracker ? (
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    <span>متابعة الدفع في بوابة Kashier</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    <span>ادفع الآن بأمان ({final} ج.م)</span>
                  </div>
                )}
              </Button>

              {/* Security & Guarantee Badges Under Button */}
              <div className="mt-4 pt-3 border-t border-border/50 space-y-2">
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground text-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>ضمان استرداد الأموال لمدة 7 أيام</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/80 text-center">
                  <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span>بياناتك المالية مشفرة ومحمية بالكامل عبر Kashier</span>
                </div>
              </div>
            </Card>

            {/* Need Help Box */}
            <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 text-center text-xs text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">واجهتك أي مشكلة أثناء الدفع؟</p>
              <p className="text-[11px] mb-2">فريق الدعم الفني جاهز لمساعدتك خطوة بخطوة</p>
              <a
                href="https://wa.me/201026533835"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-gold font-bold hover:underline"
              >
                تواصل عبر واتساب مباشر ←
              </a>
            </div>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
