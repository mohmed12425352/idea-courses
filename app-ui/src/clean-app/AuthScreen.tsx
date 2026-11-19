import { useState } from "react";
import { Shield, Lock, Mail, User, Phone, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, getDeviceIdentity, setToken } from "./api";

interface Props {
  appName: string;
  instructorName: string;
  subtitle: string;
  onAuthed: (user: any) => void;
}

export function AuthScreen({ appName, instructorName, subtitle, onAuthed }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const dev = getDeviceIdentity();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const res = await apiFetch("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
            deviceId: dev.deviceId,
            userAgent: dev.userAgent,
          }),
        });
        setToken(res.token);
        toast.success(`أهلاً بك يا ${res.user.name} 👋`);
        onAuthed(res.user);
      } else {
        const res = await apiFetch("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            name,
            phone,
            email,
            password,
            deviceId: dev.deviceId,
            userAgent: dev.userAgent,
          }),
        });
        setToken(res.token);
        toast.success("تم إنشاء حسابك بنجاح! 🎉");
        onAuthed(res.user);
      }
    } catch (err: any) {
      toast.error(err?.message || "تعذّر إتمام العملية");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#0b090d] text-white flex flex-col items-center justify-center px-4 py-6 relative overflow-hidden"
      style={{
        paddingTop: "calc(1.25rem + env(safe-area-inset-top))",
        paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))",
      }}
    >
      <div className="pointer-events-none absolute -top-28 -right-28 w-80 h-80 rounded-full bg-rose-600/20 blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-28 -left-28 w-80 h-80 rounded-full bg-amber-500/15 blur-[110px]" />

      <div className="w-full max-w-[400px] relative z-10">
        {/* Compact Brand Identity */}
        <div className="text-center mb-5 space-y-1.5">
          <div className="w-16 h-16 mx-auto mb-2.5 rounded-2xl bg-gradient-to-br from-[#1f141a] to-[#0f0c12] border border-rose-500/35 p-2 shadow-[0_12px_30px_rgba(225,29,72,0.28)] flex items-center justify-center">
            <img src="/logo.png" alt={appName} className="w-full h-full object-contain" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
            <Shield className="w-3 h-3" />
            <span>منصة محمية • {dev.label}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">{appName}</h1>
          <p className="text-xs sm:text-sm font-extrabold text-amber-400">{instructorName}</p>
          <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">{subtitle}</p>
        </div>

        {/* Sleek Glass Card */}
        <div className="rounded-3xl bg-[#151119]/95 backdrop-blur-xl border border-white/10 p-5 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-black/45 border border-white/5 mb-5">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                mode === "login"
                  ? "bg-gradient-to-l from-rose-600 to-rose-500 text-white shadow-md shadow-rose-900/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                mode === "register"
                  ? "bg-gradient-to-l from-rose-600 to-rose-500 text-white shadow-md shadow-rose-900/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              حساب طالب جديد
            </button>
          </div>

          <form onSubmit={submit} className="space-y-3.5">
            {mode === "register" && (
              <>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 block">الاسم الثلاثي للطالب</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="مثال: محمد أحمد علي"
                      className="w-full rounded-xl bg-black/50 border border-white/10 focus:border-rose-500 pr-10 pl-3 py-2.5 text-xs sm:text-sm text-white outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 block">رقم الموبايل (واتساب)</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
                    <input
                      required
                      dir="ltr"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="01012345678"
                      className="w-full rounded-xl bg-black/50 border border-white/10 focus:border-rose-500 pr-10 pl-3 py-2.5 text-xs sm:text-sm text-right text-white outline-none"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 block">البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
                <input
                  required
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@example.com"
                  className="w-full rounded-xl bg-black/50 border border-white/10 focus:border-rose-500 pr-10 pl-3 py-2.5 text-xs sm:text-sm text-right text-white outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 block">كلمة المرور</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
                <input
                  required
                  type="password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl bg-black/50 border border-white/10 focus:border-rose-500 pr-10 pl-3 py-2.5 text-xs sm:text-sm text-right text-white outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 rounded-xl bg-gradient-to-l from-rose-600 via-rose-500 to-amber-500 hover:brightness-110 disabled:opacity-60 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري التحقق...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{mode === "login" ? "دخول للمنصة الآن" : "إنشاء حسابي والدخول"}</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400">
            <span>بصمة الجهاز الموثّقة:</span>
            <code className="font-mono text-amber-300 bg-black/40 px-2 py-0.5 rounded">{dev.shortCode}</code>
          </div>
        </div>
      </div>
    </div>
  );
}
