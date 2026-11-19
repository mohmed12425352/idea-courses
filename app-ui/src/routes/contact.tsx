import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/SiteShell";
import { Card } from "@/components/ui/card";
import { Mail, Phone, MapPin } from "lucide-react";
import { useI18n } from "@/lib/i18n";
export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "تواصل معنا — فكرة ديزاين" },
      { name: "description", content: "تواصل مع فريق فكرة ديزاين عبر البريد الإلكتروني أو الواتساب من الإسكندرية، مصر للحصول على الدعم أو الاستفسار عن الكورسات." },
      { property: "og:title", content: "تواصل معنا — فكرة ديزاين" },
      { property: "og:description", content: "تواصل معنا من الإسكندرية، مصر للحصول على الدعم أو الاستفسار عن الكورسات." },
      { property: "og:url", content: "https://fekradesign.shalaby3.online/contact" },
    ],
    links: [{ rel: "canonical", href: "https://fekradesign.shalaby3.online/contact" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: "فكرة ديزاين",
          email: "mohmedshalaby246@gmail.com",
          telephone: "+201026533835",
          url: "https://fekradesign.shalaby3.online",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Alexandria",
            addressCountry: "EG",
          },
        }),
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { t } = useI18n();
  const items = [
    {i:<Mail className="h-5 w-5"/>,t:t("contact.email"),v:"mohmedshalaby246@gmail.com",href:"mailto:mohmedshalaby246@gmail.com",ltr:true},
    {i:<Phone className="h-5 w-5"/>,t:t("contact.phone"),v:"01026533835",href:"https://wa.me/201026533835",ltr:true},
    {i:<MapPin className="h-5 w-5"/>,t:t("contact.address"),v:t("contact.addressValue"),href:null as string | null,ltr:false},
  ];
  return (
    <SiteShell>
      <div className="bg-gradient-to-b from-[#1c1818] via-[#161313] to-[#121212] border-b border-[#252121] py-16">
        <div className="container-page text-center">
          <h1 className="text-3xl md:text-5xl font-black text-white">{t("contact.title")}</h1>
        </div>
      </div>
      <div className="container-page py-12 grid md:grid-cols-3 gap-5 max-w-4xl mx-auto">
        {items.map((x,i)=>(
          <Card key={i} className="p-6 text-center hover:shadow-xl transition-all rounded-2xl bg-[#1c1818] border-[#342f2f]">
            <div className="grid h-12 w-12 mx-auto place-items-center rounded-xl bg-[#e50914]/15 text-[#e50914] mb-3">{x.i}</div>
            <div className="font-bold text-white mb-1">{x.t}</div>
            {x.href ? (
              <a href={x.href} target={x.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="text-sm text-white/70 mt-1 block hover:text-[#f5c518] transition-colors" dir={x.ltr ? "ltr" : undefined}>{x.v}</a>
            ) : (
              <div className="text-sm text-white/70 mt-1">{x.v}</div>
            )}
          </Card>
        ))}
      </div>
    </SiteShell>
  );
}
