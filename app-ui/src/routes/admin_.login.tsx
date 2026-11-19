import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ShieldCheck, Loader2, Eye, EyeOff, Lock, Mail, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin_/login")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: session.user.id,
      _role: "admin",
    });
    if (isAdmin === true) throw redirect({ to: "/admin" });
  },
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email.trim(), password);
    if (error) {
      setBusy(false);
      toast.error("بيانات الدخول غير صحيحة", { description: error });
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setBusy(false);
      toast.error("فشل التحقق من الجلسة");
      return;
    }
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: session.user.id,
      _role: "admin",
    });
    setBusy(false);
    if (isAdmin !== true) {
      await supabase.auth.signOut();
      toast.error("هذا الحساب لا يملك صلاحية الدخول لمركز الإدارة");
      return;
    }
    toast.success("مرحباً بك في مركز قيادة المنصة");
    navigate({ to: "/admin" });
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen flex items-center justify-center bg-[#0f0e11] text-white p-4 relative overflow-hidden"
    >
      <div className="pointer-events-none absolute -top-32 right-1/4 w-[480px] h-[480px] rounded-full bg-[#e50914]/15 blur-[130px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/4 w-[380px] h-[380px] rounded-full bg-[#f5c518]/10 blur-[130px]" />

      <div className="w-full max-w-[440px] relative z-10">
        <div className="rounded-3xl bg-[#18161b] border border-white/10 p-7 sm:p-9 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.85)] relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#e50914] via-[#f5c518] to-[#e50914]" />

          <div className="flex flex-col items-center text-center mb-7">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#e50914] to-[#99050d] text-white grid place-items-center mb-3.5 shadow-lg shadow-[#e50914]/30">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-black text-white">بوابة إدارة المنصة</h1>
            <p className="text-xs text-white/55 mt-1">دخول مخصص لمدراء ومشرفي Idea Courses</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-bold text-white/80 block">
                البريد الإلكتروني الإداري
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  dir="ltr"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@edunova.eg"
                  className="w-full h-11 px-4 pl-10 text-right bg-white/[0.06] text-white placeholder-white/35 rounded-xl text-sm border border-white/10 focus:border-[#e50914] outline-none transition-all"
                />
                <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-bold text-white/80 block">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  dir="ltr"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-4 pl-10 text-right bg-white/[0.06] text-white placeholder-white/35 rounded-xl text-sm border border-white/10 focus:border-[#e50914] outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute left-3.5 top-3.5 text-white/50 hover:text-white cursor-pointer"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#e50914] to-[#b80710] hover:from-[#ff1f2a] hover:to-[#d10813] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#e50914]/25 transition-all disabled:opacity-60 cursor-pointer mt-2"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>دخول مركز القيادة</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between text-xs text-white/55">
            <Link to="/" className="hover:text-white inline-flex items-center gap-1 font-semibold">
              <ArrowRight className="w-3.5 h-3.5" />
              <span>العودة للموقع الرئيسي</span>
            </Link>
            <Link to="/login" className="text-[#f5c518] hover:underline font-bold">
              دخول الطلاب
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
