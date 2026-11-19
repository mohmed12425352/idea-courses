import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function GoogleSignInButton({ redirectTo }: { redirectTo?: string }) {
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    const nextPath = redirectTo?.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/dashboard";
    setLoading(true);
    try {
      const apiBase = ((import.meta as any).env?.VITE_API_URL || "").replace(/\/$/, "");
      const checkRes = await fetch(`${apiBase}/api/auth/google?redirect=${encodeURIComponent(nextPath)}`, {
        redirect: "manual",
      });
      if (checkRes.status === 501) {
        setLoading(false);
        const body = await checkRes.json().catch(() => ({}));
        toast.info("تسجيل الدخول بجوجل غير مفعّل بعد", {
          description: body?.message || "استخدم البريد الإلكتروني وكلمة المرور، أو أضف GOOGLE_CLIENT_ID في server/.env.",
        });
        return;
      }
      window.location.assign(`${apiBase}/api/auth/google?redirect=${encodeURIComponent(nextPath)}`);
    } catch {
      setLoading(false);
      toast.error("تعذر الاتصال بخدمة جوجل حالياً");
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={loading}
      className="w-full gap-2"
    >
      <GoogleIcon className="h-4 w-4" />
      {loading ? "جاري التحويل…" : "الدخول باستخدام جوجل"}
    </Button>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.45c-.28 1.45-1.12 2.68-2.39 3.51v2.92h3.86c2.26-2.08 3.57-5.14 3.57-8.67z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.92l-3.86-2.92c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.11C3.26 21.31 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.35c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.68H1.29C.47 8.31 0 10.1 0 12s.47 3.69 1.29 5.32l3.98-2.97z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.68l3.98 3.11C6.22 6.88 8.87 4.77 12 4.77z"
      />
    </svg>
  );
}
