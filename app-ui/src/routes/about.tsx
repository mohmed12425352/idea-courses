import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/SiteShell";
import { useI18n } from "@/lib/i18n";
export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "من نحن — فكرة ديزاين" },
      { name: "description", content: "فكرة ديزاين منصة تعليمية مصرية متخصصة في تقديم كورسات احترافية بالعربية في الذكاء الاصطناعي، التسويق الرقمي، التصميم وصناعة المحتوى." },
      { property: "og:title", content: "من نحن — فكرة ديزاين" },
      { property: "og:description", content: "تعرّف على رسالة فكرة ديزاين في تمكين الشباب العربي من المهارات الرقمية المطلوبة لسوق العمل الحديث." },
      { property: "og:url", content: "https://fekradesign.shalaby3.online/about" },
    ],
    links: [{ rel: "canonical", href: "https://fekradesign.shalaby3.online/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  const { t, isAr } = useI18n();
  return (
    <SiteShell>
      <div className="bg-gradient-to-b from-background via-secondary/30 to-background text-foreground dark:bg-navy-pattern dark:text-white border-b border-border/50 dark:border-none py-16 transition-colors duration-300"><div className="container-page text-center"><h1 className="text-4xl font-extrabold mb-3 text-foreground dark:text-white">{t("about.title")}</h1><p className="text-muted-foreground dark:text-white/70">{t("about.hero")}</p></div></div>
      <div className={`container-page py-12 prose prose-lg max-w-3xl mx-auto ${isAr ? "text-right" : "text-left"}`}>
        <p className="leading-loose">{t("about.p1")}</p>
        <p className="leading-loose mt-4">{t("about.p2")}</p>
      </div>
    </SiteShell>
  );
}
