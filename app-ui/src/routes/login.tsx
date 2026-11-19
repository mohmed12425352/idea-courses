import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { resolveSessionForGuard } from "@/lib/auth-guard";
import { SiteShell } from "@/components/layout/SiteShell";
import { Eye, EyeOff, Mail, Lock, LogIn, ArrowRight } from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { TurnstileWidget, TurnstileWidgetRef } from "@/components/common/TurnstileWidget";
import { verifyTurnstileTokenFn } from "@/lib/turnstile.functions";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — فكرة كورسات Idea Courses" },
      { name: "description", content: "سجّل دخولك إلى حسابك للوصول إلى كورساتك وشهاداتك ومتابعة تقدمك في منصة فكرة كورسات." },
      { property: "og:title", content: "تسجيل الدخول — فكرة كورسات Idea Courses" },
      { property: "og:description", content: "سجّل دخولك إلى حسابك للوصول إلى كورساتك وشهاداتك ومتابعة تقدمك." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof s.redirect === "string" && s.redirect.trim() ? (s.redirect as string) : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const session = await resolveSessionForGuard();
    if (session) throw redirect({ to: (search.redirect as string) || "/dashboard" });
  },
});

const schema = z.object({
  email: z.string().trim().email("بريد إلكتروني غير صحيح").max(255),
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل").max(72),
});

function LoginPage() {
  const { signIn, user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  useEffect(() => {
    if (!authLoading && user) {
      nav({ to: redirect || "/dashboard", replace: true });
    }
  }, [authLoading, user, redirect, nav]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
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

    const { error } = await signIn(parsed.data.email, parsed.data.password);
    if (error) {
      setLoading(false);
      setTurnstileToken(null);
      turnstileRef.current?.reset();
      const lower = error.toLowerCase();
      if (lower.includes("invalid")) {
        toast.error("بيانات الدخول غير صحيحة، يرجى التأكد من البريد وكلمة المرور");
      } else if (lower.includes("network") || lower.includes("fetch")) {
        toast.error("مشكلة في الاتصال بالإنترنت، يرجى المحاولة لاحقاً");
      } else {
        toast.error("تعذر تسجيل الدخول", { description: error });
      }
      return;
    }

    toast.success("أهلاً بك مجدداً!");

    const { data: { session } } = await supabase.auth.getSession();
    let isAdmin = false;
    if (session?.user) {
      const { data } = await supabase.rpc("has_role", {
        _user_id: session.user.id,
        _role: "admin",
      });
      isAdmin = data === true;
    }
    setLoading(false);
    nav({ to: isAdmin ? "/admin" : (redirect || "/dashboard") });
  };

  return (
    <SiteShell>
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#252121]">
        <div className="w-full max-w-[460px] space-y-6">
          {/* Card Container */}
          <div className="bg-[#2f2b2b] border border-[#443e3e] rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            {/* Top Accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#e50914] via-[#ff4d4d] to-[#e50914]" />

            {/* Header */}
            <div className="text-center mb-7">
              <Link to="/" className="inline-flex items-center justify-center mb-4 group">
                <img
                  src="/logo.png"
                  alt="Idea Courses"
                  className="h-14 w-auto object-contain transition-transform group-hover:scale-105"
                />
              </Link>
              <h1 className="text-2xl font-black text-white">تسجيل الدخول</h1>
              <p className="text-xs text-white/60 mt-1.5">
                مرحباً بعودتك! سجّل دخولك لمتابعة دروسك
              </p>
            </div>

            {/* Social Logins */}
            <div className="space-y-2.5 mb-6">
              <GoogleSignInButton redirectTo={redirect || "/dashboard"} />
            </div>

            {/* Divider */}
            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#443e3e]" />
              </div>
              <span className="relative bg-[#2f2b2b] px-3 text-xs text-white/50 font-medium">
                أو من خلال البريد الإلكتروني
              </span>
            </div>

            {/* Form */}
            <form onSubmit={onSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5 text-right">
                <label className="text-xs font-semibold text-white/80 block">
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    dir="ltr"
                    className="w-full h-11 px-4 text-right bg-[#635d5d] text-white placeholder-white/40 rounded-xl text-sm border border-transparent focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914] outline-none transition-all"
                  />
                  <Mail className="w-4 h-4 text-white/40 absolute left-3 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5 text-right">
                <div className="flex items-center justify-between">
                  <Link
                    to="/forgot-password"
                    className="text-xs text-[#e50914] hover:underline"
                  >
                    نسيت كلمة المرور؟
                  </Link>
                  <label className="text-xs font-semibold text-white/80">
                    كلمة المرور
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    dir="ltr"
                    className="w-full h-11 px-4 text-right bg-[#635d5d] text-white placeholder-white/40 rounded-xl text-sm border border-transparent focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914] outline-none transition-all pl-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-3.5 text-white/60 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-start gap-2 pt-1 text-right">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-[#443e3e] bg-[#635d5d] text-[#e50914] focus:ring-[#e50914] w-4 h-4 cursor-pointer accent-[#e50914]"
                />
                <label htmlFor="remember" className="text-xs text-white/70 select-none cursor-pointer">
                  تذكرني على هذا الجهاز
                </label>
              </div>

              {/* Cloudflare Turnstile Verification */}
              <TurnstileWidget
                ref={turnstileRef}
                action="login"
                onVerify={(token) => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken(null)}
              />

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-[#e50914] to-[#b8050e] hover:from-[#f0131e] hover:to-[#9e040c] text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-[#e50914]/25 flex items-center justify-center gap-2 mt-2 disabled:opacity-60 cursor-pointer active:scale-98"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    جاري تسجيل الدخول…
                  </span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>دخول</span>
                  </>
                )}
              </button>
            </form>

            {/* Switch to Register */}
            <div className="mt-7 text-center pt-5 border-t border-[#443e3e]/60">
              <p className="text-xs text-white/60">
                ليس لديك حساب؟{" "}
                <Link
                  to="/register"
                  search={{ redirect: redirect || "/dashboard" }}
                  className="text-[#e50914] font-bold hover:underline"
                >
                  إنشاء حساب جديد
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
