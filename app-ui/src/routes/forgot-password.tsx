import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/layout/SiteShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { KeyRound } from "lucide-react";
import { TurnstileWidget, TurnstileWidgetRef } from "@/components/common/TurnstileWidget";
import { verifyTurnstileTokenFn } from "@/lib/turnstile.functions";
import { toast } from "sonner";
import { z } from "zod";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
  head: () => ({
    meta: [
      { title: "استعادة كلمة المرور — فكرة ديزاين" },
      { name: "description", content: "أدخل بريدك الإلكتروني لإرسال رابط إعادة تعيين كلمة المرور لحسابك في أكاديمية فكرة ديزاين." },
      { property: "og:title", content: "استعادة كلمة المرور — فكرة ديزاين" },
      { property: "og:description", content: "أدخل بريدك الإلكتروني لإرسال رابط إعادة تعيين كلمة المرور لحسابك في أكاديمية فكرة ديزاين." },
      { property: "og:url", content: "https://fekradesign.shalaby3.online/forgot-password" },
    ],
    links: [
      { rel: "canonical", href: "https://fekradesign.shalaby3.online/forgot-password" },
    ],
  }),
});

const schema = z.object({ email: z.string().trim().email("بريد غير صحيح").max(255) });

function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }

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

    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setTurnstileToken(null);
      turnstileRef.current?.reset();
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("تم إرسال رابط الاستعادة");
  };

  return (
    <SiteShell>
      <div className="container-page py-16 max-w-md">
        <Card className="p-8">
          <div className="text-center mb-6">
            <div className="inline-grid h-12 w-12 place-items-center rounded-xl bg-primary text-gold mb-3">
              <KeyRound className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-extrabold text-primary">{t("forgot.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("forgot.subtitle")}</p>
          </div>
          {sent ? (
            <div className="text-center text-sm text-muted-foreground">{t("forgot.sent")}</div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">{t("common.email")}</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <TurnstileWidget
                ref={turnstileRef}
                action="forgot-password"
                onVerify={(token) => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken(null)}
              />
              <Button type="submit" disabled={loading} className="w-full bg-gold text-gold-foreground hover:bg-gold/90">
                {loading ? t("forgot.loading") : t("forgot.submit")}
              </Button>
            </form>
          )}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <Link to="/login" search={{ redirect: "/dashboard" }} className="text-primary font-semibold hover:text-gold">{t("forgot.back")}</Link>
          </div>
        </Card>
      </div>
    </SiteShell>
  );
}