import { Outlet, Link, createRootRoute, HeadContent } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { PricingProvider } from "@/lib/pricing";
import { Toaster } from "@/components/ui/sonner";
import { useEffect } from "react";
import { BroadcastAnnouncementModal } from "@/components/common/BroadcastAnnouncementModal";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">الرابط الذي تبحث عنه غير متوفر.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

function GlobalPendingComponent() {
  return null;
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { title: "Idea Courses — المنصة الرائدة لتعلم الموشن جرافيك، التصميم، المونتاج، والذكاء الاصطناعي" },
      { name: "description", content: "Idea Courses المنصة الرائدة لتعلم الموشن جرافيك، التصميم، المونتاج، والذكاء الاصطناعي" },
      { property: "og:title", content: "Idea Courses — المنصة الرائدة لتعلم الموشن جرافيك، التصميم، المونتاج، والذكاء الاصطناعي" },
      { property: "og:description", content: "Idea Courses المنصة الرائدة لتعلم الموشن جرافيك، التصميم، المونتاج، والذكاء الاصطناعي" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/logo.png" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  pendingComponent: GlobalPendingComponent,
});

function RootComponent() {
  useEffect(() => {
    let cancelled = false;
    const apiBase = ((import.meta as any).env?.VITE_API_URL || "").replace(/\/$/, "");
    fetch(`${apiBase}/api/public/meta-pixel-ids`)
      .then((r) => (r.ok ? r.json() : { ids: [] }))
      .then((data: { ids?: string[] }) => {
        if (cancelled) return;
        const ids = Array.isArray(data?.ids) ? data.ids.filter((v) => /^\d{6,20}$/.test(String(v))) : [];
        if (ids.length === 0) return;
        const w = window as unknown as { fbq?: any; _fbq?: any };
        if (!w.fbq) {
          const n: any = function () {
            n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
          };
          w.fbq = n;
          if (!w._fbq) w._fbq = n;
          n.push = n;
          n.loaded = true;
          n.version = "2.0";
          n.queue = [];
          const s = document.createElement("script");
          s.async = true;
          s.src = "https://connect.facebook.net/en_US/fbevents.js";
          document.head.appendChild(s);
        }
        for (const id of ids) w.fbq("init", id);
        w.fbq("track", "PageView");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <I18nProvider>
      <PricingProvider>
        <AuthProvider>
          <HeadContent />
          <BroadcastAnnouncementModal />
          <Outlet />
          <Toaster position="top-center" richColors />
        </AuthProvider>
      </PricingProvider>
    </I18nProvider>
  );
}
