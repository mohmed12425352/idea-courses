import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SiteShell } from "@/components/layout/SiteShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin-setup")({ component: AdminSetupPage });

function AdminSetupPage() {
  const { user, isAdmin, loading: authLoading, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [checking, setChecking] = useState(true);
  const [adminExists, setAdminExists] = useState<boolean | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("no_admin_exists");
      if (error) {
        toast.error("تعذر التحقق من حالة النظام");
      } else {
        setAdminExists(!data);
      }
      setChecking(false);
    })();
  }, []);

  const claim = async () => {
    if (!user) {
      nav({ to: "/login", search: { redirect: "/admin-setup" } });
      return;
    }
    setWorking(true);
    const { data, error } = await supabase.rpc("claim_first_admin");
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    if (!data) { toast.error("الترقية غير متاحة — يوجد أدمن بالفعل"); setAdminExists(true); return; }
    toast.success("تمت الترقية! أهلاً بك في لوحة التحكم");
    await refreshProfile();
    nav({ to: "/admin" });
  };

  return (
    <SiteShell>
      <div className="container-page py-16 max-w-xl">
        <Card className="p-8 text-center">
          <div className="inline-grid h-14 w-14 place-items-center rounded-2xl bg-primary text-gold mx-auto mb-4">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-primary mb-2">إعداد حساب الأدمن الأول</h1>
          <p className="text-sm text-muted-foreground mb-6">
            هذه الصفحة تعمل مرة واحدة فقط لتعيين أول مدير للمنصة. بعد ذلك، يمكن للأدمن إدارة باقي المديرين من لوحة التحكم.
          </p>

          {checking || authLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : isAdmin ? (
            <div className="rounded-lg bg-success/10 border border-success/30 p-4 text-sm">
              <div className="font-semibold text-success mb-2">أنت أدمن بالفعل ✓</div>
              <Link to="/admin" className="text-primary font-semibold hover:text-gold underline">الانتقال إلى لوحة التحكم</Link>
            </div>
          ) : adminExists ? (
            <div className="rounded-lg bg-warning/10 border border-warning/30 p-4 text-sm flex gap-3 items-start text-right">
              <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold mb-1">الإعداد مكتمل</div>
                <div className="text-muted-foreground">
                  يوجد أدمن مُعيّن بالفعل لهذه المنصة. لطلب صلاحيات إدارية، تواصل مع المدير الحالي ليرفّعك من تبويب "الأدمنز".
                </div>
              </div>
            </div>
          ) : !user ? (
            <div className="space-y-3">
              <p className="text-sm">سجّل دخول أولاً، ثم ارجع لهذه الصفحة لترقية حسابك.</p>
              <div className="flex gap-2 justify-center">
                <Link to="/login" search={{ redirect: "/admin-setup" }}>
                  <Button className="bg-gold text-gold-foreground hover:bg-gold/90">تسجيل الدخول</Button>
                </Link>
                <Link to="/register">
                  <Button variant="outline">إنشاء حساب</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-secondary p-3 text-sm">
                ستتم ترقية الحساب: <span className="font-semibold">{user.email}</span>
              </div>
              <Button onClick={claim} disabled={working} className="w-full bg-gold text-gold-foreground hover:bg-gold/90">
                {working ? "جاري الترقية…" : "ترقية حسابي إلى أدمن"}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </SiteShell>
  );
}
