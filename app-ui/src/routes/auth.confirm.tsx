import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/layout/SiteShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ShieldCheck, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

type VerifyType =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "email";

const ALLOWED_TYPES: VerifyType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

export const Route = createFileRoute("/auth/confirm")({
  component: ConfirmPage,
  head: () => ({
    meta: [
      { title: "تأكيد البريد الإلكتروني — فكرة ديزاين" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    token_hash: typeof s.token_hash === "string" ? s.token_hash : "",
    type: typeof s.type === "string" ? (s.type as string) : "",
    redirect_to:
      typeof s.redirect_to === "string" ? (s.redirect_to as string) : "/dashboard",
  }),
});

function ConfirmPage() {
  const { token_hash, type, redirect_to } = Route.useSearch();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isValidParams =
    !!token_hash && ALLOWED_TYPES.includes(type as VerifyType);

  const handleConfirm = async () => {
    if (!isValidParams) {
      setErrorMsg("الرابط غير صالح أو منتهي الصلاحية.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setErrorMsg(null);
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as VerifyType,
    });
    if (error) {
      console.error("[auth/confirm] verifyOtp failed", error);
      setErrorMsg(
        error.message?.toLowerCase().includes("expired")
          ? "انتهت صلاحية الرابط. يرجى طلب رابط جديد."
          : "تعذّر التحقق من الرمز. تأكد من فتح أحدث رسالة وصلتك.",
      );
      setStatus("error");
      return;
    }
    setStatus("success");
    toast.success("تم تأكيد بريدك الإلكتروني بنجاح");
    const target =
      type === "recovery" ? "/reset-password" : redirect_to || "/dashboard";
    setTimeout(() => navigate({ to: target }), 1200);
  };

  return (
    <SiteShell>
      <div className="container mx-auto max-w-xl px-4 py-16">
        <Card className="p-8 text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            {status === "success" ? (
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            ) : status === "error" ? (
              <AlertTriangle className="w-7 h-7 text-destructive" />
            ) : (
              <ShieldCheck className="w-7 h-7 text-primary" />
            )}
          </div>

          {status === "success" ? (
            <>
              <h1 className="text-2xl font-bold">تم التأكيد بنجاح ✅</h1>
              <p className="text-muted-foreground">
                جارٍ تحويلك الآن...
              </p>
            </>
          ) : status === "error" ? (
            <>
              <h1 className="text-2xl font-bold">تعذّر التحقق</h1>
              <p className="text-muted-foreground">{errorMsg}</p>
              <Button variant="outline" onClick={() => setStatus("idle")}>
                إعادة المحاولة
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">خطوة تحقق إضافية</h1>
              <p className="text-muted-foreground leading-relaxed">
                لحماية حسابك، يرجى الضغط على الزر بالأسفل لتأكيد أن هذا أنت من
                فتح هذا الرابط، ثم سيتم التحقق من صحة الرمز وتفعيل حسابك.
              </p>
              {!isValidParams && (
                <p className="text-sm text-destructive">
                  الرابط غير مكتمل. تأكد من نسخه بالكامل من البريد.
                </p>
              )}
              <Button
                size="lg"
                onClick={handleConfirm}
                disabled={!isValidParams || status === "loading"}
                className="min-w-[200px]"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جارٍ التحقق...
                  </>
                ) : (
                  "تأكيد وتفعيل الحساب"
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                إذا لم تكن أنت من طلب ذلك، يمكنك تجاهل هذه الصفحة بأمان.
              </p>
            </>
          )}
        </Card>
      </div>
    </SiteShell>
  );
}
