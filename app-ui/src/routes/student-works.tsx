import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/SiteShell";
import { StudentWorksShowcase } from "@/components/common/StudentWorksShowcase";
import { Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/student-works")({
  head: () => ({
    meta: [
      { title: "أعمال الطلاب — فكرة ديزاين" },
      { name: "description", content: "مجموعة مختارة من أعمال طلاب أكاديمية فكرة ديزاين في التصميم والموشن والمواقع." },
      { property: "og:title", content: "أعمال الطلاب — فكرة ديزاين" },
      { property: "og:description", content: "شوف أحدث أعمال طلابنا وإبداعاتهم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudentWorksPage,
});

function StudentWorksPage() {
  const { t } = useI18n();
  return (
    <SiteShell>
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="container mx-auto px-4 py-14 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-sm text-gold">
            <Sparkles className="h-4 w-4" />
            <span>{t("works.badge")}</span>
          </div>
          <h1 className="mt-4 text-3xl md:text-5xl font-extrabold text-primary">{t("works.title")}</h1>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">{t("works.subtitle")}</p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-10">
        <StudentWorksShowcase />
      </section>
    </SiteShell>
  );
}