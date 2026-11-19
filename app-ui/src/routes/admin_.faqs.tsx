import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/layout/SiteShell";
import { FaqsManager } from "@/components/admin/FaqsManager";
import { Button } from "@/components/ui/button";
import { ArrowRight, HelpCircle } from "lucide-react";

export const Route = createFileRoute("/admin_/faqs")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login", search: { redirect: "/admin/faqs" } });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" });
    if (!isAdmin) throw redirect({ to: "/" });
  },
  component: AdminFaqsPage,
});

function AdminFaqsPage() {
  return (
    <SiteShell>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gold/15 text-gold grid place-items-center">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-primary">الأسئلة الشائعة</h1>
              <p className="text-xs text-muted-foreground">أضف، عدّل، أو احذف الأسئلة اللي تظهر في صفحة الكورس.</p>
            </div>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin">
              <ArrowRight className="h-4 w-4 ml-1" /> رجوع للوحة
            </Link>
          </Button>
        </div>

        <FaqsManager />
      </div>
    </SiteShell>
  );
}