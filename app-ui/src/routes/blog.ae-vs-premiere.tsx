import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/SiteShell";

const URL = "https://fekradesign.shalaby3.online/blog/ae-vs-premiere";
const TITLE = "After Effects أم Premiere Pro: أيهما تتعلم أولًا في 2026؟";
const DESC =
  "مقارنة عملية بين Adobe After Effects و Premiere Pro للمبتدئين العرب في المونتاج والموشن جرافيك — الاستخدامات، منحنى التعلم، متطلبات الجهاز، وأيهما يناسب هدفك المهني.";
const IMAGE = "https://fekradesign.shalaby3.online/og-image.jpg";
const PUBLISHED = "2026-07-24T00:00:00Z";

export const Route = createFileRoute("/blog/ae-vs-premiere")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      {
        name: "keywords",
        content:
          "افتر ايفكت, بريمير برو, After Effects, Premiere Pro, مونتاج فيديو, موشن جرافيك, تعلم المونتاج, الفرق بين افتر وبريمير",
      },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { name: "author", content: "فكرة ديزاين" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { property: "og:site_name", content: "فكرة ديزاين" },
      { property: "og:locale", content: "ar_AR" },
      { property: "og:image", content: IMAGE },
      { property: "article:published_time", content: PUBLISHED },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
      { name: "twitter:image", content: IMAGE },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: TITLE,
          description: DESC,
          inLanguage: "ar",
          datePublished: PUBLISHED,
          dateModified: PUBLISHED,
          image: [IMAGE],
          author: { "@type": "Organization", name: "فكرة ديزاين" },
          publisher: {
            "@type": "Organization",
            name: "فكرة ديزاين",
            logo: {
              "@type": "ImageObject",
              url: "https://fekradesign.shalaby3.online/favicon.ico",
            },
          },
          mainEntityOfPage: URL,
        }),
      },
    ],
  }),
  component: ArticlePage,
});

function ArticlePage() {
  return (
    <SiteShell>
      <article className="bg-gradient-to-b from-background via-secondary/30 to-background text-foreground dark:bg-navy-pattern dark:text-white border-b border-border/50 dark:border-none py-14 transition-colors duration-300">
        <div className="container-page text-center max-w-3xl mx-auto">
          <p className="text-gold text-sm font-medium mb-3">دليل مقارنة</p>
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight mb-4 text-foreground dark:text-white">{TITLE}</h1>
          <p className="text-muted-foreground dark:text-white/75 leading-relaxed">{DESC}</p>
        </div>
      </article>

      <div className="container-page py-12">
        <div className="prose prose-lg max-w-3xl mx-auto text-right leading-loose">
          <h2>الفرق الأساسي في سطر واحد</h2>
          <p>
            <strong>Premiere Pro</strong> برنامج مونتاج تايم لاين لتجميع اللقطات وترتيبها وإضافة صوت
            وانتقالات. <strong>After Effects</strong> برنامج موشن جرافيك وتأثيرات بصرية لتحريك النصوص
            والعناصر وإنشاء مقدمات وتأثيرات سينمائية.
          </p>

          <h2>متى تختار Premiere Pro؟</h2>
          <ul>
            <li>بتشتغل مونتاج فيديوهات يوتيوب أو ريلز أو أفلام قصيرة.</li>
            <li>محتاج تركّب مقاطع كتيرة وتضيف موسيقى وترجمة.</li>
            <li>عايز تخلص المشاريع بسرعة بأرباح شهرية أعلى في السوق العربي.</li>
            <li>هدفك تشتغل فريلانسر مونتير أو في شركة إنتاج.</li>
          </ul>

          <h2>متى تختار After Effects؟</h2>
          <ul>
            <li>بتحب تصمم مقدمات (Intros) وتأثيرات نصوص متحركة.</li>
            <li>عايز تشتغل موشن جرافيك للشركات والإعلانات.</li>
            <li>مهتم بالـ VFX والتأثيرات البصرية زي المحاكاة والـ Compositing.</li>
            <li>هدفك تشتغل مصمم موشن أو Motion Designer.</li>
          </ul>

          <h2>منحنى التعلم</h2>
          <p>
            Premiere أسهل بكتير للمبتدئ — تقدر تعمل مونتاج أول فيديو في أول أسبوع. أما After Effects
            محتاج فهم للطبقات (Layers)، مسارات الحركة (Keyframes)، والـ Expressions، وبياخد وقت
            أطول لإتقانه.
          </p>

          <h2>متطلبات الجهاز</h2>
          <ul>
            <li><strong>Premiere:</strong> يشتغل كويس على 16GB RAM وكارت شاشة متوسط.</li>
            <li><strong>After Effects:</strong> بيحب RAM أكتر (32GB مفضل) لأنه بيعمل Preview للفريمات في الذاكرة.</li>
          </ul>

          <h2>الترتيب المقترح للتعلم</h2>
          <p>
            ابدأ بـ <strong>Premiere Pro</strong> أول شهرين — هيدخّلك سوق الشغل بسرعة كمونتير. لما
            تتقنه، تعلم <strong>After Effects</strong> عشان تضيف موشن ومقدمات لشغلك وتزوّد سعر الساعة.
            الاتنين مع بعض بيخلوك مونتير موشن متكامل.
          </p>

          <h2>الخلاصة</h2>
          <p>
            مش لازم تختار واحد وتسيب التاني — بس ابدأ بواحد. لو عايز شغل ودخل سريع: Premiere. لو
            مهتم بالإبداع البصري والموشن: After Effects. الاتنين متكاملين وشغلهم مع بعض في نفس
            المشروع عبر Dynamic Link.
          </p>
        </div>
      </div>
    </SiteShell>
  );
}