import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/SiteShell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "سياسة الخصوصية — fekra Design" },
      { name: "description", content: "تعرّف كيف تجمع منصة فكرة ديزاين (fekra Design) بياناتك الشخصية وتستخدمها وتحميها وفقاً للوائح حماية البيانات." },
      { property: "og:title", content: "سياسة الخصوصية — fekra Design" },
      { property: "og:description", content: "تعرّف على ممارسات حماية الخصوصية والبيانات الشخصية في منصة fekra Design." },
      { property: "og:url", content: "https://fekradesign.shalaby3.online/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://fekradesign.shalaby3.online/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { t, isEn } = useI18n();
  if (isEn) return <PrivacyEn />;
  return (
    <SiteShell>
      <div className="bg-gradient-to-b from-[#1c1818] via-[#161313] to-[#121212] border-b border-[#252121] py-14 md:py-20">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e50914]/15 border border-[#e50914]/30 text-[#e50914] text-xs font-bold mb-4">
            منصة فكرة ديزاين — Idea Courses
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            سياسة الخصوصية
          </h1>
          <p className="text-white/60 mt-3 text-sm md:text-base">
            آخر تحديث: مايو 2026 — نلتزم بأعلى معايير الشفافية وحماية بياناتك الشخصية
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 md:py-16 max-w-4xl">
        <div className="space-y-6 text-white/90">
          {/* 1 */}
          <div className="bg-[#1c1818] border border-[#2d2828] rounded-2xl p-6 md:p-8 shadow-xl">
            <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
              <span className="w-8 h-8 rounded-xl bg-[#e50914]/15 text-[#e50914] flex items-center justify-center text-sm font-bold shrink-0">1</span>
              <span>من نحن</span>
            </h2>
            <p className="leading-relaxed text-sm md:text-base text-white/80">
              <strong>فكرة ديزاين (fekra Design)</strong> — كيان فردي مُسجَّل في جمهورية مصر العربية — هي الجهة المُشغِّلة للمنصة وتعمل بصفتها المتحكّم في البيانات (Data Controller) للبيانات الشخصية التي تُجمع من خلال الموقع.
            </p>
          </div>

          {/* 2 */}
          <div className="bg-[#1c1818] border border-[#2d2828] rounded-2xl p-6 md:p-8 shadow-xl">
            <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
              <span className="w-8 h-8 rounded-xl bg-[#e50914]/15 text-[#e50914] flex items-center justify-center text-sm font-bold shrink-0">2</span>
              <span>البيانات التي نجمعها</span>
            </h2>
            <ul className="space-y-2.5 text-sm md:text-base text-white/80 pr-2">
              <li className="flex items-start gap-2">
                <span className="text-[#f5c518] mt-1">•</span>
                <span><strong>بيانات الحساب:</strong> الاسم، البريد الإلكتروني، رقم الهاتف، كلمة المرور المُشفّرة.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#f5c518] mt-1">•</span>
                <span><strong>بيانات الاستخدام:</strong> الكورسات المسجَّل بها، التقدّم في الدروس، الشهادات الصادرة.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#f5c518] mt-1">•</span>
                <span><strong>بيانات تقنية:</strong> عنوان IP، نوع المتصفح، نظام التشغيل، سجلّات الدخول لأغراض الأمان.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#f5c518] mt-1">•</span>
                <span><strong>رسائل الدعم:</strong> ما تُرسله إلينا عبر نماذج التواصل أو البريد أو الواتساب.</span>
              </li>
            </ul>
            <div className="mt-4 p-3.5 rounded-xl bg-[#252121] border border-[#393434] text-xs md:text-sm text-white/70">
              <strong className="text-[#f5c518]">ملاحظة:</strong> بيانات الدفع (رقم البطاقة، تفاصيل الفاتورة) تُجمَع وتُعالَج مباشرةً من قِبل مزوّد الدفع Paddle ولا نحتفظ نحن بنسخة منها.
            </div>
          </div>

          {/* 3 */}
          <div className="bg-[#1c1818] border border-[#2d2828] rounded-2xl p-6 md:p-8 shadow-xl">
            <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
              <span className="w-8 h-8 rounded-xl bg-[#e50914]/15 text-[#e50914] flex items-center justify-center text-sm font-bold shrink-0">3</span>
              <span>أغراض المعالجة والأساس القانوني</span>
            </h2>
            <ul className="space-y-2 text-sm md:text-base text-white/80 pr-2">
              <li className="flex items-start gap-2"><span className="text-[#f5c518] mt-1">•</span><span>إنشاء حسابك وتقديم الخدمة (تنفيذ العقد).</span></li>
              <li className="flex items-start gap-2"><span className="text-[#f5c518] mt-1">•</span><span>معالجة المدفوعات والاشتراكات (تنفيذ العقد + التزام قانوني).</span></li>
              <li className="flex items-start gap-2"><span className="text-[#f5c518] mt-1">•</span><span>الأمان والوقاية من الاحتيال (مصلحة مشروعة).</span></li>
              <li className="flex items-start gap-2"><span className="text-[#f5c518] mt-1">•</span><span>تحسين المنتج وتحليل الاستخدام (مصلحة مشروعة).</span></li>
              <li className="flex items-start gap-2"><span className="text-[#f5c518] mt-1">•</span><span>إرسال رسائل تسويقية أو نشرة بريدية (موافقتك الصريحة، يمكنك سحبها في أي وقت).</span></li>
            </ul>
          </div>

          {/* 4 */}
          <div className="bg-[#1c1818] border border-[#2d2828] rounded-2xl p-6 md:p-8 shadow-xl">
            <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
              <span className="w-8 h-8 rounded-xl bg-[#e50914]/15 text-[#e50914] flex items-center justify-center text-sm font-bold shrink-0">4</span>
              <span>مع مَن نشارك بياناتك</span>
            </h2>
            <ul className="space-y-2.5 text-sm md:text-base text-white/80 pr-2">
              <li className="flex items-start gap-2"><span className="text-[#f5c518] mt-1">•</span><span><strong>مزوّدو الخدمة:</strong> استضافة، تخزين الفيديوهات، أدوات التحليلات والدعم الفني.</span></li>
              <li className="flex items-start gap-2"><span className="text-[#f5c518] mt-1">•</span><span><strong>بائع التجزئة المعتمد (Paddle):</strong> لإتمام عمليات البيع، إدارة الاشتراكات، الفواتير، والامتثال الضريبي.</span></li>
              <li className="flex items-start gap-2"><span className="text-[#f5c518] mt-1">•</span><span><strong>المستشارون المهنيون:</strong> محامون ومحاسبون عند الحاجة.</span></li>
              <li className="flex items-start gap-2"><span className="text-[#f5c518] mt-1">•</span><span><strong>السلطات المختصة:</strong> عند وجود التزام قانوني صريح.</span></li>
            </ul>
          </div>

          {/* 5 */}
          <div className="bg-[#1c1818] border border-[#2d2828] rounded-2xl p-6 md:p-8 shadow-xl">
            <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
              <span className="w-8 h-8 rounded-xl bg-[#e50914]/15 text-[#e50914] flex items-center justify-center text-sm font-bold shrink-0">5</span>
              <span>مدة الاحتفاظ بالبيانات</span>
            </h2>
            <p className="leading-relaxed text-sm md:text-base text-white/80">
              نحتفظ ببياناتك طوال فترة استخدامك للحساب، ولفترة معقولة بعد إغلاقه (لا تتجاوز عادةً 5 سنوات) لأغراض المحاسبة والامتثال القانوني، ثم نحذفها أو نُجهّلها.
            </p>
          </div>

          {/* 6 */}
          <div className="bg-[#1c1818] border border-[#2d2828] rounded-2xl p-6 md:p-8 shadow-xl">
            <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
              <span className="w-8 h-8 rounded-xl bg-[#e50914]/15 text-[#e50914] flex items-center justify-center text-sm font-bold shrink-0">6</span>
              <span>حقوقك</span>
            </h2>
            <p className="text-sm md:text-base text-white/80 mb-3">وفقاً للقوانين السارية، يحقّ لك:</p>
            <ul className="space-y-2 text-sm md:text-base text-white/80 pr-2">
              <li className="flex items-start gap-2"><span className="text-[#f5c518] mt-1">•</span><span>الوصول إلى بياناتك الشخصية وطلب نسخة منها.</span></li>
              <li className="flex items-start gap-2"><span className="text-[#f5c518] mt-1">•</span><span>تصحيح أي بيانات غير دقيقة.</span></li>
              <li className="flex items-start gap-2"><span className="text-[#f5c518] mt-1">•</span><span>طلب حذف بياناتك ("الحق في النسيان") ضمن حدود القانون.</span></li>
              <li className="flex items-start gap-2"><span className="text-[#f5c518] mt-1">•</span><span>تقييد المعالجة أو الاعتراض عليها.</span></li>
              <li className="flex items-start gap-2"><span className="text-[#f5c518] mt-1">•</span><span>سحب موافقتك على المعالجة المبنية على الموافقة.</span></li>
              <li className="flex items-start gap-2"><span className="text-[#f5c518] mt-1">•</span><span>تقديم شكوى للجهة الرقابية المختصة في بلدك.</span></li>
            </ul>
            <div className="mt-4 p-3.5 rounded-xl bg-[#252121] border border-[#393434] text-xs md:text-sm text-white/80">
              لممارسة أي من هذه الحقوق، راسلنا على{" "}
              <a href="mailto:mohmedshalaby246@gmail.com" className="text-[#f5c518] underline font-bold" dir="ltr">
                mohmedshalaby246@gmail.com
              </a>
              . سنردّ خلال 30 يوماً.
            </div>
          </div>

          {/* 7 */}
          <div className="bg-[#1c1818] border border-[#2d2828] rounded-2xl p-6 md:p-8 shadow-xl">
            <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
              <span className="w-8 h-8 rounded-xl bg-[#e50914]/15 text-[#e50914] flex items-center justify-center text-sm font-bold shrink-0">7</span>
              <span>الأمان</span>
            </h2>
            <p className="leading-relaxed text-sm md:text-base text-white/80">
              نطبّق إجراءات تقنية وتنظيمية مناسبة لحماية بياناتك (تشفير الاتصال HTTPS، تشفير كلمات المرور، صلاحيات وصول مُقيّدة، نسخ احتياطية).
            </p>
          </div>

          {/* 8 */}
          <div className="bg-[#1c1818] border border-[#2d2828] rounded-2xl p-6 md:p-8 shadow-xl">
            <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
              <span className="w-8 h-8 rounded-xl bg-[#e50914]/15 text-[#e50914] flex items-center justify-center text-sm font-bold shrink-0">8</span>
              <span>ملفات تعريف الارتباط (Cookies)</span>
            </h2>
            <p className="leading-relaxed text-sm md:text-base text-white/80">
              نستخدم ملفات تعريف الارتباط الأساسية لتشغيل الموقع (تسجيل الدخول، التفضيلات)، وقد نستخدم ملفات تحليلية لقياس الأداء. يمكنك إدارة تفضيلات الكوكيز من خلال إعدادات متصفحك.
            </p>
          </div>

          {/* 9 */}
          <div className="bg-[#1c1818] border border-[#2d2828] rounded-2xl p-6 md:p-8 shadow-xl">
            <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
              <span className="w-8 h-8 rounded-xl bg-[#e50914]/15 text-[#e50914] flex items-center justify-center text-sm font-bold shrink-0">9</span>
              <span>النقل الدولي للبيانات</span>
            </h2>
            <p className="leading-relaxed text-sm md:text-base text-white/80">
              قد تُعالَج بياناتك على خوادم خارج بلدك. في هذه الحالة نتأكد من وجود ضمانات قانونية مناسبة (مثل البنود التعاقدية القياسية) لحماية البيانات.
            </p>
          </div>

          {/* 10 */}
          <div className="bg-[#1c1818] border border-[#2d2828] rounded-2xl p-6 md:p-8 shadow-xl">
            <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
              <span className="w-8 h-8 rounded-xl bg-[#e50914]/15 text-[#e50914] flex items-center justify-center text-sm font-bold shrink-0">10</span>
              <span>التعديلات على هذه السياسة</span>
            </h2>
            <p className="leading-relaxed text-sm md:text-base text-white/80">
              قد نُحدّث هذه السياسة من حين لآخر. سيتم نشر النسخة المحدّثة على هذه الصفحة مع تاريخ التحديث.
            </p>
          </div>

          {/* 11 */}
          <div className="bg-[#1c1818] border border-[#e50914]/30 rounded-2xl p-6 md:p-8 shadow-2xl bg-gradient-to-br from-[#1c1818] to-[#251b1b]">
            <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
              <span className="w-8 h-8 rounded-xl bg-[#e50914] text-white flex items-center justify-center text-sm font-bold shrink-0">11</span>
              <span>التواصل</span>
            </h2>
            <p className="leading-relaxed text-sm md:text-base text-white/80">
              للاستفسارات المتعلقة بالخصوصية:{" "}
              <a href="mailto:mohmedshalaby246@gmail.com" className="text-[#f5c518] underline font-bold" dir="ltr">
                mohmedshalaby246@gmail.com
              </a>{" "}
              — هاتف:{" "}
              <a href="https://wa.me/201026533835" target="_blank" rel="noopener noreferrer" className="text-[#25D366] underline font-bold" dir="ltr">
                01026533835
              </a>{" "}
              — العنوان: <span className="text-white font-semibold">مصر، الإسكندرية</span>.
            </p>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}

function PrivacyEn() {
  return (
    <SiteShell>
      <div className="bg-gradient-to-b from-background via-secondary/30 to-background text-foreground dark:bg-navy-pattern dark:text-white border-b border-border/50 dark:border-none py-12 transition-colors duration-300">
        <div className="container-page text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground dark:text-white">Privacy Policy</h1>
          <p className="text-muted-foreground dark:text-white/70 mt-2 text-sm">Last updated: May 2026</p>
        </div>
      </div>
      <article className="container-page py-12 max-w-3xl mx-auto prose prose-sm md:prose-base prose-headings:text-primary prose-a:text-gold leading-relaxed text-foreground/90 space-y-6">
        <section><h2 className="text-xl font-bold text-primary mb-2">1. Who we are</h2><p><strong>Fekra Design</strong> — a sole proprietorship registered in the Arab Republic of Egypt — operates the Platform and acts as the <em>Data Controller</em> for personal data collected through the site.</p></section>
        <section><h2 className="text-xl font-bold text-primary mb-2">2. Data we collect</h2><ul className="list-disc ps-6 space-y-1"><li><strong>Account data:</strong> name, email, phone, hashed password.</li><li><strong>Usage data:</strong> enrolled courses, lesson progress, issued certificates.</li><li><strong>Technical data:</strong> IP address, browser, OS, login logs for security.</li><li><strong>Support messages:</strong> anything you send via contact forms, email, or WhatsApp.</li></ul><p className="text-sm text-muted-foreground mt-2">Note: payment data (card number, invoice details) is collected and processed directly by Paddle; we do not retain a copy.</p></section>
        <section><h2 className="text-xl font-bold text-primary mb-2">3. Purposes & legal basis</h2><ul className="list-disc ps-6 space-y-1"><li>Creating your account and delivering the service (contract).</li><li>Processing payments and subscriptions (contract + legal obligation).</li><li>Security and fraud prevention (legitimate interest).</li><li>Product improvement and usage analytics (legitimate interest).</li><li>Marketing emails or newsletter (explicit consent — you can withdraw anytime).</li></ul></section>
        <section><h2 className="text-xl font-bold text-primary mb-2">4. Who we share data with</h2><ul className="list-disc ps-6 space-y-1"><li><strong>Service providers:</strong> hosting, video storage, analytics and support tools.</li><li><strong>Merchant of Record (Paddle):</strong> to complete sales, manage subscriptions, invoices, and tax compliance.</li><li><strong>Professional advisors:</strong> lawyers and accountants when needed.</li><li><strong>Authorities:</strong> where required by law.</li></ul></section>
        <section><h2 className="text-xl font-bold text-primary mb-2">5. Retention</h2><p>We keep your data for as long as you use the account and for a reasonable period afterwards (usually no more than 5 years) for accounting and legal compliance, then we delete or anonymize it.</p></section>
        <section><h2 className="text-xl font-bold text-primary mb-2">6. Your rights</h2><p>Under applicable law you may:</p><ul className="list-disc ps-6 space-y-1"><li>Access your personal data and request a copy.</li><li>Correct inaccurate data.</li><li>Request deletion ("right to be forgotten") within legal limits.</li><li>Restrict or object to processing.</li><li>Withdraw consent for consent-based processing.</li><li>File a complaint with the competent authority in your country.</li></ul><p className="mt-2">To exercise these rights, email <a href="mailto:mohmedshalaby246@gmail.com" dir="ltr">mohmedshalaby246@gmail.com</a>. We respond within 30 days.</p></section>
        <section><h2 className="text-xl font-bold text-primary mb-2">7. Security</h2><p>We apply appropriate technical and organizational measures (HTTPS, password hashing, restricted access, backups) to protect your data.</p></section>
        <section><h2 className="text-xl font-bold text-primary mb-2">8. Cookies</h2><p>We use essential cookies to operate the site (login, preferences) and may use analytics cookies to measure performance. Manage cookie preferences in your browser.</p></section>
        <section><h2 className="text-xl font-bold text-primary mb-2">9. International data transfers</h2><p>Your data may be processed on servers outside your country. In that case we ensure appropriate legal safeguards (such as standard contractual clauses).</p></section>
        <section><h2 className="text-xl font-bold text-primary mb-2">10. Updates to this policy</h2><p>We may update this policy from time to time. The updated version will appear on this page with the update date.</p></section>
        <section><h2 className="text-xl font-bold text-primary mb-2">11. Contact</h2><p>Privacy inquiries: <a href="mailto:mohmedshalaby246@gmail.com" dir="ltr">mohmedshalaby246@gmail.com</a> — Phone: <a href="https://wa.me/201026533835" target="_blank" rel="noopener noreferrer" dir="ltr">01026533835</a> — Address: Egypt, Alexandria.</p></section>
      </article>
    </SiteShell>
  );
}