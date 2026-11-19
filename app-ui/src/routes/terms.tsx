import { createFileRoute, redirect } from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/SiteShell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/terms")({
  beforeLoad: () => {
    throw redirect({ to: "/privacy" });
  },
  head: () => ({
    meta: [
      { title: "سياسة الخصوصية والاستخدام — Idea Courses" },
      { name: "description", content: "سياسة الخصوصية وحماية البيانات في منصة Idea Courses." },
    ],
  }),
  component: () => null,
});

function TermsPage() {
  const { t, isEn } = useI18n();
  if (isEn) return <TermsEn />;
  return (
    <SiteShell>
      <div className="bg-gradient-to-b from-background via-secondary/30 to-background text-foreground dark:bg-navy-pattern dark:text-white border-b border-border/50 dark:border-none py-12 transition-colors duration-300">
        <div className="container-page text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground dark:text-white">{t("terms.title")}</h1>
          <p className="text-muted-foreground dark:text-white/70 mt-2 text-sm">{t("terms.updated")}</p>
        </div>
      </div>
      <article className="container-page py-12 max-w-3xl mx-auto prose prose-sm md:prose-base prose-headings:text-primary prose-a:text-gold leading-relaxed text-foreground/90 space-y-6">
        <section>
          <h2 className="text-xl font-bold text-primary mb-2">1. الأطراف والقبول</h2>
          <p>
            باستخدامك لمنصة <strong>فكرة ديزاين (fekra Design)</strong> (المُشار إليها بـ "المنصة" أو "نحن")، فإنك تُبرم اتفاقاً مُلزِماً مع
            <strong> فكرة ديزاين</strong> — كيان فردي مُسجَّل في جمهورية مصر العربية — بصفتها بائع ومُقدّم الخدمة.
            استمرارك في استخدام المنصة يعني موافقتك الكاملة على هذه الشروط. إذا لم توافق، يُرجى التوقف عن استخدام الخدمة.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary mb-2">2. وصف الخدمة</h2>
          <p>
            توفّر فكرة ديزاين كورسات تعليمية رقمية باللغة العربية في مجالات التصميم، المونتاج، التسويق الرقمي، والذكاء الاصطناعي،
            مع إمكانية إصدار شهادات إتمام بعد إكمال متطلبات الكورس.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary mb-2">3. الأهلية والحساب</h2>
          <ul className="list-disc pr-6 space-y-1">
            <li>يجب أن تكون بالغاً قانونياً، أو تحت إشراف وليّ أمر، لاستخدام المنصة وإجراء عمليات الشراء.</li>
            <li>أنت مسؤول عن سرّية بيانات حسابك وعن جميع الأنشطة التي تتم من خلاله.</li>
            <li>يجب تقديم بيانات صحيحة وحديثة عند التسجيل.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary mb-2">4. الاستخدام المقبول</h2>
          <p>يحظر عليك استخدام المنصة لأي من الأغراض الآتية:</p>
          <ul className="list-disc pr-6 space-y-1">
            <li>أي نشاط غير قانوني أو احتيالي أو مضلِّل.</li>
            <li>انتهاك حقوق الملكية الفكرية أو إعادة بيع أو نشر المحتوى دون إذن.</li>
            <li>محاولات اختراق المنصة، إدخال برامج ضارة، أو فحص ثغرات أمنية، أو جمع البيانات تلقائياً (Scraping).</li>
            <li>مشاركة بيانات الحساب أو السماح لأشخاص آخرين باستخدام اشتراكك.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary mb-2">5. الملكية الفكرية</h2>
          <p>
            جميع محتويات المنصة (الفيديوهات، النصوص، التصاميم، البرمجيات، الشعارات، والشهادات) مملوكة لـ فكرة ديزاين ومحمية بموجب قوانين الملكية الفكرية.
            نمنحك ترخيصاً محدوداً وغير حصري وغير قابل للتحويل لاستخدام المحتوى لأغراض التعلّم الشخصي فقط.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary mb-2">6. الدفع والاشتراكات</h2>
          <p>
            تتم جميع عمليات الدفع عبر <strong>Paddle.com</strong> بصفته بائع التجزئة المعتمد (Merchant of Record). تتضمن المعاملة
            الأسعار والضرائب المعمول بها بحسب موقعك. للاطلاع على شروط الدفع التفصيلية، يُرجى مراجعة
            {" "}
            <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noopener noreferrer">شروط Paddle للمشتري</a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary mb-2">7. إفصاح بائع التجزئة (Merchant of Record)</h2>
          <p className="bg-secondary/50 border border-border rounded-lg p-4">
            تتم عملية الطلب الخاصة بنا عبر بائع التجزئة الإلكتروني <strong>فكرة ديزاين</strong>. تُعدّ فكرة ديزاين بائع التجزئة المُعتمد
            (Merchant of Record) لجميع طلباتنا. تتولّى جميع استفسارات خدمة العملاء المتعلقة بالفواتير والضرائب وعمليات الإرجاع والاسترداد.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary mb-2">8. الاسترداد</h2>
          <p>
            نوفّر ضمان استرداد لمدة 7 أيام من تاريخ الشراء. للاطلاع على التفاصيل وآلية الطلب، راجع{" "}
            <a href="/refund">سياسة الاسترداد</a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary mb-2">9. مستوى الخدمة وإخلاء المسؤولية</h2>
          <p>
            نسعى لتقديم خدمة مستقرة وعالية الجودة، لكنّنا لا نضمن أن تكون الخدمة خالية من الانقطاعات أو الأخطاء. تُقدَّم المنصة "كما هي"
            بدون أي ضمانات صريحة أو ضمنية إلى أقصى حد يسمح به القانون.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary mb-2">10. تحديد المسؤولية</h2>
          <p>
            لا تتحمل فكرة ديزاين أي مسؤولية عن الأضرار غير المباشرة أو التبعية أو الخاصة (كفقدان الأرباح أو البيانات). يقتصر سقف مسؤوليتنا الإجمالية
            على المبالغ التي دفعها المستخدم خلال الـ 12 شهراً السابقة للحادثة.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary mb-2">11. التعليق وإنهاء الحساب</h2>
          <p>
            يحق لنا تعليق أو إنهاء وصولك إلى المنصة في حال: المخالفة الجوهرية لهذه الشروط، عدم الدفع، الاشتباه في الاحتيال،
            أو تكرار انتهاكات سياسة الاستخدام. عند الإنهاء، يسقط حقك في استخدام المنصة فوراً.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary mb-2">12. التعويض</h2>
          <p>
            توافق على تعويض فكرة ديزاين عن أي مطالبات أو أضرار ناتجة عن استخدامك المخالف للمنصة أو انتهاكك لحقوق الغير.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary mb-2">13. القانون الحاكم</h2>
          <p>
            تخضع هذه الشروط لقوانين جمهورية مصر العربية، وتختص محاكم الإسكندرية بالنظر في أي نزاع ينشأ بشأنها.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary mb-2">14. التواصل</h2>
          <p>
            للاستفسارات المتعلقة بالخدمة: <a href="mailto:mohmedshalaby246@gmail.com" dir="ltr">mohmedshalaby246@gmail.com</a> — هاتف:{" "}
            <a href="https://wa.me/201026533835" target="_blank" rel="noopener noreferrer" dir="ltr">01026533835</a> — العنوان: مصر، الإسكندرية.
          </p>
        </section>
      </article>
    </SiteShell>
  );
}

function TermsEn() {
  return (
    <SiteShell>
      <div className="bg-gradient-to-b from-background via-secondary/30 to-background text-foreground dark:bg-navy-pattern dark:text-white border-b border-border/50 dark:border-none py-12 transition-colors duration-300">
        <div className="container-page text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground dark:text-white">Terms & Conditions</h1>
          <p className="text-muted-foreground dark:text-white/70 mt-2 text-sm">Last updated: May 2026</p>
        </div>
      </div>
      <article className="container-page py-12 max-w-3xl mx-auto prose prose-sm md:prose-base prose-headings:text-primary prose-a:text-gold leading-relaxed text-foreground/90 space-y-6">
        <section><h2 className="text-xl font-bold text-primary mb-2">1. Parties & Acceptance</h2><p>By using the <strong>Fekra Design</strong> platform ("the Platform" or "we"), you enter a binding agreement with <strong>Fekra Design</strong> — a sole proprietorship registered in the Arab Republic of Egypt — as the seller and service provider. Continued use means you fully accept these terms. If you disagree, please stop using the service.</p></section>
        <section><h2 className="text-xl font-bold text-primary mb-2">2. Service description</h2><p>Fekra Design provides Arabic-language digital courses covering design, video editing, digital marketing, and AI, with the ability to issue completion certificates.</p></section>
        <section><h2 className="text-xl font-bold text-primary mb-2">3. Eligibility & account</h2><ul className="list-disc ps-6 space-y-1"><li>You must be of legal age or supervised by a guardian to use the Platform and make purchases.</li><li>You are responsible for the confidentiality of your account and all activity under it.</li><li>Provide accurate and up-to-date information at registration.</li></ul></section>
        <section><h2 className="text-xl font-bold text-primary mb-2">4. Acceptable use</h2><p>You may not use the Platform to:</p><ul className="list-disc ps-6 space-y-1"><li>Conduct illegal, fraudulent, or misleading activity.</li><li>Infringe intellectual property or resell/redistribute content without permission.</li><li>Attempt to breach the Platform, inject malware, probe vulnerabilities, or scrape data.</li><li>Share account credentials or let others use your subscription.</li></ul></section>
        <section><h2 className="text-xl font-bold text-primary mb-2">5. Intellectual property</h2><p>All Platform content (videos, text, designs, software, logos, certificates) belongs to Fekra Design and is protected by IP laws. You receive a limited, non-exclusive, non-transferable license to use content for personal learning only.</p></section>
        <section><h2 className="text-xl font-bold text-primary mb-2">6. Payment & subscriptions</h2><p>Payments are processed through <strong>Paddle.com</strong> as the Merchant of Record. Prices include applicable taxes based on your location. See <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noopener noreferrer">Paddle buyer terms</a>.</p></section>
        <section><h2 className="text-xl font-bold text-primary mb-2">7. Merchant of Record disclosure</h2><p className="bg-secondary/50 border border-border rounded-lg p-4">Our order process is conducted by <strong>Fekra Design</strong>. Fekra Design is the Merchant of Record for all our orders and handles all customer service inquiries related to billing, taxes, returns, and refunds.</p></section>
        <section><h2 className="text-xl font-bold text-primary mb-2">8. Refunds</h2><p>We offer a 7-day money-back guarantee. For details and how to request, see the <a href="/refund">refund policy</a>.</p></section>
        <section><h2 className="text-xl font-bold text-primary mb-2">9. Service level & disclaimer</h2><p>We aim to deliver a stable, high-quality service but do not guarantee uninterrupted or error-free operation. The Platform is provided "as is" without express or implied warranties to the maximum extent permitted by law.</p></section>
        <section><h2 className="text-xl font-bold text-primary mb-2">10. Liability limits</h2><p>Fekra Design is not liable for indirect, consequential, or special damages (such as loss of profits or data). Our total liability is capped at amounts paid by the user during the 12 months preceding the incident.</p></section>
        <section><h2 className="text-xl font-bold text-primary mb-2">11. Suspension & termination</h2><p>We may suspend or terminate your access for material breach, non-payment, suspected fraud, or repeated usage-policy violations. Upon termination your right to use the Platform ends immediately.</p></section>
        <section><h2 className="text-xl font-bold text-primary mb-2">12. Indemnification</h2><p>You agree to indemnify Fekra Design for claims or damages arising from your unlawful use of the Platform or infringement of third-party rights.</p></section>
        <section><h2 className="text-xl font-bold text-primary mb-2">13. Governing law</h2><p>These terms are governed by the laws of the Arab Republic of Egypt, and the courts of Alexandria have jurisdiction over any disputes.</p></section>
        <section><h2 className="text-xl font-bold text-primary mb-2">14. Contact</h2><p>For service inquiries: <a href="mailto:mohmedshalaby246@gmail.com" dir="ltr">mohmedshalaby246@gmail.com</a> — Phone: <a href="https://wa.me/201026533835" target="_blank" rel="noopener noreferrer" dir="ltr">01026533835</a> — Address: Egypt, Alexandria.</p></section>
      </article>
    </SiteShell>
  );
}