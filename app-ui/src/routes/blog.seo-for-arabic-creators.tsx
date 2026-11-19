import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/SiteShell";

const URL = "https://fekradesign.shalaby3.online/blog/seo-for-arabic-creators";
const TITLE = "تحسين محركات البحث SEO للمصممين وصنّاع المحتوى العرب 2026";
const DESC =
  "دليل SEO عملي بالعربية للمصممين والمونتيرين: كلمات مفتاحية، تحسين البورتفوليو، السيو المحلي، ويوتيوب SEO، وباك لينكس لجلب عملاء حقيقيين.";
const IMAGE = "https://fekradesign.shalaby3.online/og-image.jpg";
const PUBLISHED = "2026-06-18T00:00:00Z";

export const Route = createFileRoute("/blog/seo-for-arabic-creators")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      {
        name: "keywords",
        content:
          "تحسين محركات البحث, SEO, سيو, سيو بالعربية, مصممين, صناع المحتوى, بورتفوليو, مونتاج فيديو, تصميم جرافيك, يوتيوب SEO",
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
      { property: "og:image:alt", content: TITLE },
      { property: "article:published_time", content: PUBLISHED },
      { property: "article:author", content: "فكرة ديزاين" },
      { property: "article:section", content: "SEO" },
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
          keywords:
            "تحسين محركات البحث, SEO, سيو بالعربية, مصممين, صناع المحتوى, بورتفوليو, يوتيوب SEO",
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
          <p className="text-gold text-sm font-medium mb-3">دليل SEO</p>
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight mb-4 text-foreground dark:text-white">{TITLE}</h1>
          <p className="text-muted-foreground dark:text-white/75 leading-relaxed">{DESC}</p>
        </div>
      </article>

      <div className="container-page py-12">
        <div className="prose prose-lg max-w-3xl mx-auto text-right leading-loose">
          <h2>ليه السيو مهم للمصمم وصانع المحتوى العربي؟</h2>
          <p>
            لو شغلك تصميم جرافيك، موشن، مونتاج، أو صناعة محتوى، أنت محتاج العملاء يلاقوك من جوجل ويوتيوب
            مش بس من الإعلانات. تحسين محركات البحث (SEO) هو الطريقة اللي تخلي بورتفوليوك وصفحاتك تظهر
            في النتائج الأولى لما حد يبحث عن "مصمم جرافيك مصر" أو "مونتير فيديو محترف" أو "تصميم لوجو احترافي".
          </p>

          <h2>1) ابحث عن الكلمات المفتاحية الصح بالعربية</h2>
          <p>
            أول خطوة هي إنك تعرف الناس بتبحث بإيه فعلاً. استخدم Google Suggest وأدوات زي Semrush
            وKeyword Planner. ركز على الكلمات اللي ليها <strong>نية شرائية</strong> زي:
          </p>
          <ul>
            <li>تصميم لوجو احترافي</li>
            <li>مونتاج فيديو إعلاني</li>
            <li>مصمم سوشيال ميديا مصر</li>
            <li>أسعار تصميم هوية بصرية</li>
          </ul>

          <h2>2) حسّن صفحات البورتفوليو</h2>
          <ul>
            <li>عنوان الصفحة (Title) يحتوي على الكلمة المفتاحية + اسمك.</li>
            <li>Meta description واضح يوصف الخدمة في 150 حرف.</li>
            <li>أسماء ملفات الصور بالإنجليزي ووصفية (logo-design-cairo.jpg).</li>
            <li>alt text عربي لكل صورة يوصف المحتوى.</li>
            <li>اضغط الصور بصيغة WebP عشان السرعة.</li>
          </ul>

          <h2>3) السيو المحلي (Local SEO)</h2>
          <p>
            لو بتشتغل في مصر أو الخليج، أنشئ حساب Google Business Profile واكتب البلد والمدينة في
            صفحاتك. الكلمات زي "مصمم جرافيك في القاهرة" أو "مونتير في الإسكندرية" منافستها أقل
            وبتجيب عملاء قريبين منك.
          </p>

          <h2>4) المحتوى اللي بيجيب عملاء</h2>
          <p>
            بدل ما تكتفي بصور أعمالك، اكتب مقالات قصيرة بتجاوب على أسئلة عملائك المحتملين:
          </p>
          <ul>
            <li>"كام سعر تصميم هوية بصرية في 2026؟"</li>
            <li>"إزاي تختار مونتير لقناتك على يوتيوب؟"</li>
            <li>"الفرق بين التصميم الاحترافي والمجاني"</li>
          </ul>
          <p>
            النوع ده من المحتوى بيرنك بسرعة لأنه طويل الذيل (long-tail) ومنافسته قليلة بالعربية.
          </p>

          <h2>5) السيو على يوتيوب للمونتيرين</h2>
          <ul>
            <li>اكتب عنوان فيه الكلمة المفتاحية في أول 60 حرف.</li>
            <li>وصف من 200 كلمة على الأقل فيه روابط لبورتفوليوك.</li>
            <li>أضف فصول (chapters) عشان جوجل تفهم محتوى الفيديو.</li>
            <li>thumbnail بجودة عالية بنسبة 16:9.</li>
          </ul>

          <h2>6) الباك لينكس (Backlinks)</h2>
          <p>
            خلي أعمالك تتنشر على Behance وDribbble وArtStation، وشارك في مجتمعات عربية زي
            مواقع المصممين والمدونات المتخصصة. كل لينك من موقع قوي بيرفع ترتيبك في جوجل.
          </p>

          <h2>7) قِس وحسّن باستمرار</h2>
          <p>
            ركّب Google Search Console وGoogle Analytics على موقعك. شوف الكلمات اللي بتجيبلك زيارات
            وحسّن الصفحات اللي قريبة من الصفحة الأولى (المراكز 4–10).
          </p>

          <h2>الخلاصة</h2>
          <p>
            تحسين محركات البحث مش سحر، هو شغل منظم على الكلمات المفتاحية، سرعة الموقع، جودة المحتوى،
            والروابط. لو طبقت الخطوات دي على بورتفوليوك، هتلاقي عملاء جداد بييجولك من جوجل من غير
            ما تدفع في إعلانات.
          </p>
        </div>
      </div>
    </SiteShell>
  );
}