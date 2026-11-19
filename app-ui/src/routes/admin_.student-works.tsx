import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/layout/SiteShell";
import { StudentWorksManager } from "@/components/admin/StudentWorksManager";
import { Button } from "@/components/ui/button";
import { ArrowRight, ExternalLink, ImageIcon } from "lucide-react";

export const Route = createFileRoute("/admin_/student-works")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login", search: { redirect: "/admin/student-works" } });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" });
    if (!isAdmin) throw redirect({ to: "/" });
  },
  component: AdminStudentWorksPage,
});

function AdminStudentWorksPage() {
  return (
    <SiteShell>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gold/15 text-gold grid place-items-center">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-primary">أعمال الطلاب</h1>
              <p className="text-xs text-muted-foreground">ارفع فيديوهات أعمال الطلاب أو اربطها بلينك، وتظهر مباشرة في صفحة الأعمال.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="/student-works" target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 ml-1" /> عرض الصفحة العامة
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin">
                <ArrowRight className="h-4 w-4 ml-1" /> رجوع للوحة
              </Link>
            </Button>
          </div>
        </div>

        <StudentWorksManager />
      </div>
    </SiteShell>
  );
}