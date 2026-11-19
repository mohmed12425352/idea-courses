import { sendPlatformEmail } from "@/lib/transactional-email.functions";
import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SiteShell } from "@/components/layout/SiteShell";
import { SupportInbox } from "@/components/support/SupportInbox";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Headphones, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { adminCreateModerator } from "@/lib/admin-moderator.functions";

export const Route = createFileRoute("/admin_/support")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login", search: { redirect: "/admin/support" } });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" });
    if (isAdmin !== true) {
      // Moderators belong to /moderator workspace, not /admin
      const { data: isMod } = await supabase.rpc("has_role", { _user_id: session.user.id, _role: "moderator" });
      throw redirect({ to: "/" });
    }
  },
  component: SupportPage,
});

function SupportPage() {
  const { isAdmin } = useAuth();
  return (
    <SiteShell>
      <div className="container-page py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
              <Headphones className="h-6 w-6" /> دعم العملاء
            </h1>
            <p className="text-xs text-muted-foreground">المحادثات في انتظار الرد + المحادثات الجارية</p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <ModeratorManager />
              <Link to="/admin"><Button variant="outline" size="sm">العودة للإدارة</Button></Link>
            </div>
          )}
        </div>
        <SupportInbox />
      </div>
    </SiteShell>
  );
}

function ModeratorManager() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [mods, setMods] = useState<Array<{ user_id: string; name?: string; email?: string }>>([]);
  const createMod = useServerFn(adminCreateModerator);

  const load = async () => {
    const { data } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "moderator");
    const ids = (data ?? []).map((r) => r.user_id);
    if (ids.length === 0) { setMods([]); return; }
    const { data: profs } = await supabase.from("profiles").select("id,name,email").in("id", ids);
    setMods((profs ?? []).map((p: any) => ({ user_id: p.id, name: p.name, email: p.email })));
  };

  useEffect(() => { if (open) load(); }, [open]);

  const createModerator = async () => {
    const e = email.trim().toLowerCase();
    const n = name.trim();
    if (!n) { toast.error("ادخل الاسم"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { toast.error("ادخل بريد صحيح"); return; }
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess.session?.access_token;
      if (!accessToken) throw new Error("لازم تسجل دخول");
      const res: any = await createMod({ data: { email: e, name: n } });
      // Send credentials email
      const loginUrl = `${window.location.origin}/moderator/login`;
      const mailRes: any = await sendPlatformEmail({
        data: {
          templateName: "moderator-credentials",
          recipientEmail: e,
          templateData: { name: n, email: e, password: res.password, loginUrl },
        },
      }).catch(() => ({ ok: false }));
      if (mailRes?.ok) {
        toast.success(res.created ? "تم إنشاء حساب المودريتور وإرسال البيانات على البريد" : "تم تفعيل صلاحية المودريتور وإرسال بيانات الدخول الجديدة");
      } else {
        toast.warning(`تم إنشاء الحساب لكن فشل إرسال البريد. كلمة السر: ${res.password}`);
      }

      setEmail(""); setName("");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "فشل إنشاء الحساب");
    } finally {
      setBusy(false);
    }
  };

  const demote = async (uid: string) => {
    if (!confirm("إزالة صلاحيات المودريتور؟")) return;
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", uid)
      .eq("role", "moderator");
    if (error) toast.error(error.message);
    else { toast.success("تمت الإزالة"); load(); }
  };

  if (!open) {
    return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
      <ShieldCheck className="h-3.5 w-3.5 ml-1" /> إدارة المودريتورز
    </Button>;
  }

  return (
    <Card className="fixed inset-0 z-50 m-auto h-fit max-w-md p-4 bg-card border shadow-2xl" style={{ maxHeight: "80vh" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-primary">إدارة المودريتورز</h3>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>إغلاق</Button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        ادخل اسم وإيميل المودريتور، وهيتم إنشاء الحساب تلقائياً وإرسال بيانات الدخول له على البريد. لو الإيميل مسجل من قبل، هيتم إعادة تعيين كلمة السر ومنحه صلاحية المودريتور.
      </p>
      <div className="grid gap-2 mb-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المودريتور" />
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" type="email" dir="ltr" />
        <Button onClick={createModerator} disabled={busy}>
          {busy ? "جاري الإنشاء..." : "إنشاء حساب مودريتور وإرسال البيانات"}
        </Button>
      </div>
      <div className="border rounded divide-y max-h-60 overflow-y-auto">
        {mods.length === 0 && <div className="p-3 text-xs text-center text-muted-foreground">لا يوجد مودريتورز بعد</div>}
        {mods.map((m) => (
          <div key={m.user_id} className="p-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{m.name ?? "—"}</div>
              <div className="text-[11px] text-muted-foreground truncate">{m.email}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => demote(m.user_id)}>إزالة</Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
