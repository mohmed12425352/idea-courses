import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/layout/SiteShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "تعيين كلمة مرور جديدة — فكرة ديزاين" },
      { name: "description", content: "أنشئ كلمة مرور جديدة لحسابك في أكاديمية فكرة ديزاين بعد استلام رابط إعادة التعيين." },
      { property: "og:title", content: "تعيين كلمة مرور جديدة — فكرة ديزاين" },
      { property: "og:description", content: "أنشئ كلمة مرور جديدة لحسابك في أكاديمية فكرة ديزاين بعد استلام رابط إعادة التعيين." },
      { property: "og:url", content: "https://fekradesign.shalaby3.online/reset-password" },
      { name: "robots", content: "noindex,nofollow" },
    ],
    links: [
      { rel: "canonical", href: "https://fekradesign.shalaby3.online/reset-password" },
    ],
  }),
});

const schema = z.object({
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل").max(72),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "كلمتا المرور غير متطابقتين", path: ["confirm"] });

function ResetPasswordPage() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase auto-handles the recovery token from the URL hash and emits PASSWORD_RECOVERY event
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => { if (session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم تحديث كلمة المرور بنجاح");
    nav({ to: "/dashboard" });
  };

  return (
    <SiteShell>
      <div className="container-page py-16 max-w-md">
        <Card className="p-8">
          <div className="text-center mb-6">
            <div className="inline-grid h-12 w-12 place-items-center rounded-xl bg-primary text-gold mb-3">
              <KeyRound className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-extrabold text-primary">{t("reset.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("reset.subtitle")}</p>
          </div>
          {!ready ? (
            <div className="text-center text-sm text-muted-foreground">{t("reset.checking")}</div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label htmlFor="pw">{t("reset.newPw")}</Label>
                <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div>
                <Label htmlFor="pw2">{t("reset.confirmPw")}</Label>
                <Input id="pw2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-gold text-gold-foreground hover:bg-gold/90">
                {loading ? t("reset.loading") : t("reset.submit")}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </SiteShell>
  );
}