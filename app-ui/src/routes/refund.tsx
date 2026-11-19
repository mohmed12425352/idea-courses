import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/SiteShell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: [
      { title: "سياسة الاسترداد — fekra Design" },
      { name: "description", content: "ضمان استرداد لمدة 7 أيام عبر بائع التجزئة المعتمد فكرة ديزاين." },
      { property: "og:title", content: "سياسة الاسترداد — fekra Design" },
      { property: "og:description", content: "كيفية طلب استرداد المبلغ خلال 7 أيام من الشراء." },
      { property: "og:url", content: "https://fekradesign.shalaby3.online/refund" },
    ],
    links: [
      { rel: "canonical", href: "https://fekradesign.shalaby3.online/refund" },
    ],
  }),
  component: RefundPage,
});

function RefundPage() {
  const { t, isEn } = useI18n();
  if (isEn) return <RefundEn />;
  return (
    <SiteShell>
      <div className="bg-gradient-to-b from-background via-secondary/30 to-background text-foreground dark:bg-navy-pattern dark:text-white border-b border-border/50 dark:border-none py-12 transition-colors duration-300">
        <div className="container-page text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground dark:text-white">{t("refund.title")}</h1>
          <p className="text-muted-foreground dark:text-white/70 mt-2 text-sm">{t("refund.subtitle")}</p>
        </div>
      </div>
      <article className="container-page py-12 max-w-3xl mx-auto leading-relaxed text-foreground/90 space-y-6">
        <section>
          <p>
            في <strong>فكرة ديزاين – Fekra Design</strong> نؤمن بجودة محتوانا التعليمي، ونسعى دائمًا لتقديم أفضل تجربة تعليمية لطلابنا. لذلك نوفر سياسة استرداد واضحة تضمن لك تجربة شراء آمنة ومرنة.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary mb-2">ضمان الاسترداد لمدة 7 أيام</h2>
          <p>
            نقدّم ضمان استرداد كامل لمدة <strong>7 أيام من تاريخ الشراء</strong>. إذا لم تكن راضيًا عن الكورس أو الباقة، يمكنك طلب استرداد المبلغ خلال هذه الفترة وفقًا للشروط الموضحة أدناه.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary mb-2">شروط الاسترداد العامة</h2>
          <p>لكي يكون طلب الاسترداد مؤهلًا، يجب توافر الشروط التالية:</p>
          <ol className="list-decimal pr-6 space-y-2 mt-3">
            <li>ألا يتجاوز طلب الاسترداد مدة <strong>7 أيام من تاريخ شراء الكورس أو الباقة</strong>.</li>
            <li>ألا تتجاوز نسبة مشاهدة محتوى الكورس أو الباقة <strong>30%</strong>.</li>
            <li>يمكن للمستخدم طلب استرداد المبلغ <strong>مرة واحدة فقط لكل طلب شراء</strong>.</li>
            <li>يتم تنفيذ الاسترداد بعد مراجعة الطلب والتأكد من مطابقته للشروط.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary mb-2">شروط الاسترداد الخاصة بالكورسات</h2>
          <p>يمكن استرداد قيمة الكورس في حال:</p>
          <ul className="list-disc pr-6 space-y-2 mt-3">
            <li>تم تقديم طلب الاسترداد خلال 7 أيام من تاريخ الشراء.</li>
            <li>لم تتجاوز نسبة مشاهدة الكورس 30%.</li>
          </ul>
          <p className="mt-3">في حال تجاوزت نسبة المشاهدة 30%، لا يكون الكورس مؤهلًا للاسترداد.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary mb-2">شروط الاسترداد الخاصة بالباقات</h2>
          <p>في حالة شراء باقة تحتوي على أكثر من كورس، يتم تطبيق الشروط التالية:</p>
          <ul className="list-disc pr-6 space-y-2 mt-3">
            <li>لا يمكن استرداد قيمة الباقة إذا تجاوزت نسبة مشاهدة أي كورس داخل الباقة 30%.</li>
            <li>لا يمكن استرداد قيمة كورس واحد فقط من باقة تحتوي على كورسين فقط.</li>
            <li>في حال كانت الباقة تحتوي على كورسين فقط، وتمت مشاهدة أكثر من 30% من أي كورس داخل الباقة، لا يحق للمستخدم استرداد قيمة الباقة بالكامل أو جزء منها.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary mb-2">طريقة استرداد المبلغ</h2>
          <p>يتم الاسترداد من خلال الوسائل التالية:</p>
          <ul className="list-disc pr-6 space-y-2 mt-3">
            <li>داخل مصر: عبر المحفظة الإلكترونية أو إنستاباي.</li>
            <li>خارج مصر: عبر PayPal أو وسيلة الدفع المتاحة وقت الشراء.</li>
            <li>في بعض الحالات، قد يتم رد المبلغ إلى وسيلة الدفع الأصلية حسب طريقة الدفع المستخدمة.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary mb-2">كيفية طلب الاسترداد</h2>
          <p>لطلب استرداد المبلغ، يرجى التواصل معنا من خلال إحدى الطرق التالية:</p>
          <ol className="list-decimal pr-6 space-y-2 mt-3">
            <li>التواصل مع خدمة العملاء وتقديم البريد الإلكتروني المستخدم في عملية الشراء.</li>
            <li>إرسال رقم الفاتورة أو إثبات الدفع.</li>
            <li>توضيح اسم الكورس أو الباقة المطلوب استردادها.</li>
          </ol>
          <p className="mt-3">يمكنك أيضًا مراسلتنا مباشرة عبر:</p>
          <p className="mt-2">
            <strong>البريد الإلكتروني:</strong>{" "}
            <a href="mailto:mohmedshalaby246@gmail.com" dir="ltr" className="text-gold underline">mohmedshalaby246@gmail.com</a>
          </p>
          <p className="mt-1">
            <strong>واتساب:</strong>{" "}
            <a href="https://wa.me/201026533835" target="_blank" rel="noopener noreferrer" dir="ltr" className="text-gold underline">01026533835</a>
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary mb-2">مدة مراجعة الطلب وتنفيذ الاسترداد</h2>
          <p>
            يتم مراجعة طلب الاسترداد خلال مدة تصل إلى <strong>5 أيام عمل</strong> من تاريخ تقديم الطلب.
          </p>
          <p className="mt-3">
            بعد الموافقة على الطلب، يتم تحويل المبلغ خلال مدة تتراوح من <strong>5 إلى 10 أيام عمل</strong>، وقد تختلف المدة حسب البنك أو شركة الدفع أو وسيلة التحويل المستخدمة.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary mb-2">ملاحظات مهمة</h2>
          <p>
            تحتفظ منصة <strong>Fekra Design</strong> بحق رفض طلب الاسترداد في حال عدم استيفاء الشروط المذكورة أعلاه، أو في حال وجود إساءة استخدام لسياسة الاسترداد.
          </p>
          <p className="mt-3">
            باستخدامك للمنصة وشراء أي كورس أو باقة، فإنك توافق على سياسة الاسترداد الموضحة في هذه الصفحة.
          </p>
        </section>
      </article>
    </SiteShell>
  );
}

function RefundEn() {
  return (
    <SiteShell>
      <div className="bg-gradient-to-b from-background via-secondary/30 to-background text-foreground dark:bg-navy-pattern dark:text-white border-b border-border/50 dark:border-none py-12 transition-colors duration-300">
        <div className="container-page text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground dark:text-white">Refund Policy</h1>
          <p className="text-muted-foreground dark:text-white/70 mt-2 text-sm">7-day money-back guarantee</p>
        </div>
      </div>
      <article className="container-page py-12 max-w-3xl mx-auto leading-relaxed text-foreground/90 space-y-6">
        <section>
          <p>At <strong>Fekra Design</strong> we stand behind the quality of our educational content and aim to give every student the best learning experience. That's why we offer a clear refund policy that keeps your purchase safe and flexible.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-primary mb-2">7-Day Refund Guarantee</h2>
          <p>We offer a full refund within <strong>7 days of the purchase date</strong>. If you're not satisfied with a course or bundle, you can request a refund during that window subject to the terms below.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-primary mb-2">General refund conditions</h2>
          <p>To be eligible, all of the following must apply:</p>
          <ol className="list-decimal ps-6 space-y-2 mt-3">
            <li>The refund request is made within <strong>7 days of the course or bundle purchase</strong>.</li>
            <li>Watched content of the course or bundle does not exceed <strong>30%</strong>.</li>
            <li>Only <strong>one refund per order</strong> is allowed.</li>
            <li>Refunds are issued after review and confirmation of eligibility.</li>
          </ol>
        </section>
        <section>
          <h2 className="text-xl font-bold text-primary mb-2">Course-specific refund terms</h2>
          <p>A course can be refunded if:</p>
          <ul className="list-disc ps-6 space-y-2 mt-3">
            <li>The request is filed within 7 days of purchase.</li>
            <li>Course watch time does not exceed 30%.</li>
          </ul>
          <p className="mt-3">If more than 30% of the course has been watched, it is no longer eligible for a refund.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-primary mb-2">Bundle-specific refund terms</h2>
          <p>When purchasing a bundle containing multiple courses, the following applies:</p>
          <ul className="list-disc ps-6 space-y-2 mt-3">
            <li>The bundle cannot be refunded if any course inside it has been watched more than 30%.</li>
            <li>You cannot refund a single course from a bundle that contains only two courses.</li>
            <li>If the bundle contains only two courses and more than 30% of any course has been watched, the bundle is not eligible for a full or partial refund.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-xl font-bold text-primary mb-2">Refund method</h2>
          <p>Refunds are issued via:</p>
          <ul className="list-disc ps-6 space-y-2 mt-3">
            <li>Inside Egypt: e-wallet or InstaPay.</li>
            <li>Outside Egypt: PayPal or the payment method available at purchase time.</li>
            <li>In some cases the amount is returned to the original payment method depending on the method used.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-xl font-bold text-primary mb-2">How to request a refund</h2>
          <p>To request a refund, contact us via one of the following methods:</p>
          <ol className="list-decimal ps-6 space-y-2 mt-3">
            <li>Contact customer support with the email used for the purchase.</li>
            <li>Send the invoice number or proof of payment.</li>
            <li>Specify the course or bundle to be refunded.</li>
          </ol>
          <p className="mt-3">You can also reach us directly at:</p>
          <p className="mt-2"><strong>Email:</strong> <a href="mailto:mohmedshalaby246@gmail.com" dir="ltr" className="text-gold underline">mohmedshalaby246@gmail.com</a></p>
          <p className="mt-1"><strong>WhatsApp:</strong> <a href="https://wa.me/201026533835" target="_blank" rel="noopener noreferrer" dir="ltr" className="text-gold underline">01026533835</a></p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-primary mb-2">Review and processing time</h2>
          <p>Refund requests are reviewed within up to <strong>5 business days</strong> of submission.</p>
          <p className="mt-3">Once approved, the amount is transferred within <strong>5 to 10 business days</strong>; timing may vary depending on your bank, payment provider, or transfer method.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-primary mb-2">Important notes</h2>
          <p><strong>Fekra Design</strong> reserves the right to decline refund requests that don't meet the above conditions or that involve abuse of this policy.</p>
          <p className="mt-3">By using the platform and purchasing any course or bundle, you agree to the refund policy described on this page.</p>
        </section>
      </article>
    </SiteShell>
  );
}