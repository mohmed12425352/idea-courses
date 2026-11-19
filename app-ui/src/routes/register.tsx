import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { resolveSessionForGuard } from "@/lib/auth-guard";
import { useEffect, useMemo, useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/layout/SiteShell";
import { Eye, EyeOff, UserPlus, Mail, Lock, User, Phone, CheckCircle2 } from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { TurnstileWidget, TurnstileWidgetRef } from "@/components/common/TurnstileWidget";
import { verifyTurnstileTokenFn } from "@/lib/turnstile.functions";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/register")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const session = await resolveSessionForGuard();
    if (session) throw redirect({ to: (search.redirect as string) || "/dashboard" });
  },
  component: RegisterPage,
  head: () => ({
    meta: [
      { title: "إنشاء حساب جديد — فكرة كورسات Idea Courses" },
      { name: "description", content: "أنشئ حسابك مجاناً في منصة فكرة كورسات وابدأ بتعلم الموشن جرافيك والمونتاج والذكاء الاصطناعي." },
      { property: "og:title", content: "إنشاء حساب جديد — فكرة كورسات Idea Courses" },
      { property: "og:description", content: "أنشئ حسابك مجاناً في منصة فكرة كورسات وابدأ بتعلم الموشن جرافيك والمونتاج والذكاء الاصطناعي." },
    ],
  }),
});

const schema = z.object({
  name: z.string().trim().min(2, "الاسم يجب أن يكون حرفين على الأقل").max(100),
  email: z.string().trim().email("بريد إلكتروني غير صالح").max(255),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-]{6,20}$/, "رقم هاتف غير صالح"),
  password: z
    .string()
    .min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل")
    .max(72),
});

function getPasswordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "bg-white/20" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const s = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  if (s <= 1) return { score: s, label: "ضعيفة جداً", color: "bg-red-500" };
  if (s === 2) return { score: s, label: "متوسطة", color: "bg-orange-500" };
  if (s === 3) return { score: s, label: "جيدة", color: "bg-yellow-500" };
  return { score: s, label: "قوية جداً", color: "bg-[#5aca26]" };
}

function RegisterPage() {
  const { signUp, user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const { redirect } = Route.useSearch();

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      nav({ to: (redirect as any) || "/dashboard" });
    }
  }, [user, authLoading, redirect, nav]);

  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [agreed, setAgreed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [k]: e.target.value });
  };

  const pwStrength = useMemo(() => getPasswordStrength(form.password), [form.password]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      toast.error("يرجى الموافقة على شروط الاستخدام وسياسة الخصوصية");
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    if (!turnstileToken) {
      toast.error("يرجى تأكيد أنك لست روبوت!");
      return;
    }

    setLoading(true);

    try {
      const turnstileRes = await verifyTurnstileTokenFn({ data: turnstileToken } as any);
      if (!turnstileRes.success) {
        setLoading(false);
        toast.error("فشل التحقق من الأمان، يرجى إعادة المحاولة");
        setTurnstileToken(null);
        turnstileRef.current?.reset();
        return;
      }
    } catch (tErr) {
      console.warn("Turnstile check warning:", tErr);
    }

    const { error } = await signUp({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      password: parsed.data.password,
    });
    setLoading(false);
    if (error) {
      setTurnstileToken(null);
      turnstileRef.current?.reset();
      toast.error(error.includes("registered") ? "هذا البريد مسجل بالفعل، يمكنك تسجيل الدخول" : error);
      return;
    }
    toast.success("تم إنشاء حسابك بنجاح! مرحباً بك في Idea Courses");

    const { data: noAdmin } = await supabase.rpc("no_admin_exists");
    if (noAdmin) {
      nav({ to: "/admin-setup" });
    } else if (redirect) {
      nav({ to: redirect });
    } else {
      nav({ to: "/dashboard" });
    }
  };

  return (
    <SiteShell>
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#252121]">
        <div className="w-full max-w-[480px] space-y-6">
          {/* Card Container */}
          <div className="bg-[#2f2b2b] border border-[#443e3e] rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            {/* Top Accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#e50914] via-[#ff4d4d] to-[#e50914]" />

            {/* Header */}
            <div className="text-center mb-6">
              <Link to="/" className="inline-flex items-center justify-center mb-4 group">
                <img
                  src="/logo.png"
                  alt="Idea Courses"
                  className="h-14 w-auto object-contain transition-transform group-hover:scale-105"
                />
              </Link>
              <h1 className="text-2xl font-black text-white">إنشاء حساب جديد</h1>
              <p className="text-xs text-white/60 mt-1.5">
                سجّل الآن وانضم لأكثر من 15,000 طالب ومبدع عربي
              </p>
            </div>

            {/* Social Logins */}
            <div className="space-y-2.5 mb-5">
              <GoogleSignInButton redirectTo={redirect || "/dashboard"} />
            </div>

            {/* Divider */}
            <div className="relative my-5 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#443e3e]" />
              </div>
              <span className="relative bg-[#2f2b2b] px-3 text-xs text-white/50 font-medium">
                أو بالبريد الإلكتروني
              </span>
            </div>

            {/* Form */}
            <form onSubmit={onSubmit} className="space-y-3.5">
              {/* Full Name */}
              <div className="space-y-1.5 text-right">
                <label className="text-xs font-semibold text-white/80 block">
                  الاسم الكامل
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={form.name}
                    onChange={set("name")}
                    placeholder="مثال: أحمد محمد"
                    required
                    className="w-full h-11 px-4 text-right bg-[#635d5d] text-white placeholder-white/40 rounded-xl text-sm border border-transparent focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914] outline-none transition-all"
                  />
                  <User className="w-4 h-4 text-white/40 absolute left-3 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5 text-right">
                <label className="text-xs font-semibold text-white/80 block">
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={form.email}
                    onChange={set("email")}
                    placeholder="name@example.com"
                    required
                    dir="ltr"
                    className="w-full h-11 px-4 text-right bg-[#635d5d] text-white placeholder-white/40 rounded-xl text-sm border border-transparent focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914] outline-none transition-all"
                  />
                  <Mail className="w-4 h-4 text-white/40 absolute left-3 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-1.5 text-right">
                <label className="text-xs font-semibold text-white/80 block">
                  رقم الهاتف / الواتساب
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={set("phone")}
                    placeholder="+20 1xxxxxxxxx"
                    required
                    dir="ltr"
                    className="w-full h-11 px-4 text-right bg-[#635d5d] text-white placeholder-white/40 rounded-xl text-sm border border-transparent focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914] outline-none transition-all"
                  />
                  <Phone className="w-4 h-4 text-white/40 absolute left-3 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5 text-right">
                <label className="text-xs font-semibold text-white/80 block">
                  كلمة المرور
                </label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={form.password}
                    onChange={set("password")}
                    placeholder="6 أحرف على الأقل"
                    required
                    dir="ltr"
                    className="w-full h-11 px-4 text-right bg-[#635d5d] text-white placeholder-white/40 rounded-xl text-sm border border-transparent focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914] outline-none transition-all pl-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute left-3 top-3.5 text-white/60 hover:text-white transition-colors"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.password && (
                  <div className="mt-1 space-y-1">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded ${
                            i < pwStrength.score ? pwStrength.color : "bg-white/20"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="text-[11px] text-white/60 text-right">
                      قوة كلمة المرور: <span className="font-semibold text-white">{pwStrength.label}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5 text-right">
                <label className="text-xs font-semibold text-white/80 block">
                  تأكيد كلمة المرور
                </label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={form.confirmPassword}
                    onChange={set("confirmPassword")}
                    placeholder="أعد إدخال كلمة المرور"
                    required
                    dir="ltr"
                    className="w-full h-11 px-4 text-right bg-[#635d5d] text-white placeholder-white/40 rounded-xl text-sm border border-transparent focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914] outline-none transition-all pl-10"
                  />
                  <Lock className="w-4 h-4 text-white/40 absolute left-3 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Agree to terms */}
              <div className="flex items-start gap-2 pt-1 text-right">
                <input
                  type="checkbox"
                  id="agree"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="rounded border-[#443e3e] bg-[#635d5d] text-[#e50914] focus:ring-[#e50914] w-4 h-4 cursor-pointer accent-[#e50914] mt-0.5"
                />
                <label htmlFor="agree" className="text-xs text-white/70 select-none cursor-pointer leading-relaxed">
                  أوافق على{" "}
                  <Link to="/privacy" className="text-[#e50914] underline font-semibold">
                    سياسة الخصوصية
                  </Link>
                </label>
              </div>

              {/* Cloudflare Turnstile Verification */}
              <TurnstileWidget
                ref={turnstileRef}
                action="register"
                onVerify={(token) => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken(null)}
              />

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-[#e50914] to-[#b8050e] hover:from-[#f0131e] hover:to-[#9e040c] text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-[#e50914]/25 flex items-center justify-center gap-2 mt-2 disabled:opacity-60 cursor-pointer active:scale-98"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    جاري إنشاء الحساب…
                  </span>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>إنشاء حساب</span>
                  </>
                )}
              </button>
            </form>

            {/* Switch to Login */}
            <div className="mt-6 text-center pt-4 border-t border-[#443e3e]/60">
              <p className="text-xs text-white/60">
                لديك حساب بالفعل؟{" "}
                <Link
                  to="/login"
                  search={{ redirect: redirect || "/dashboard" }}
                  className="text-[#e50914] font-bold hover:underline"
                >
                  تسجيل الدخول
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
