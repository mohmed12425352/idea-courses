import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Award } from "lucide-react";

type Cert = {
  cert_code: string;
  student_name: string;
  course_title: string;
  course_slug: string | null;
  issued_at: string;
};

export const Route = createFileRoute("/verify/$certCode")({
  head: ({ params }) => ({
    meta: [
      { title: `التحقق من الشهادة ${params.certCode} — فكرة ديزاين` },
      { name: "description", content: "صفحة التحقق الرسمية من شهادات إتمام الكورسات في فكرة ديزاين." },
    ],
  }),
  component: VerifyPage,
  errorComponent: () => <VerifyState status="error" />,
  notFoundComponent: () => <VerifyState status="missing" />,
});

function VerifyPage() {
  const { certCode } = useParams({ from: "/verify/$certCode" });
  const [cert, setCert] = useState<Cert | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.rpc("verify_certificate", { _code: certCode });
      const row = Array.isArray(data) ? data[0] : null;
      if (alive) setCert((row as Cert) ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [certCode]);

  if (cert === undefined) return <VerifyState status="loading" />;
  if (!cert) return <VerifyState status="missing" />;

  const issued = new Date(cert.issued_at).toLocaleDateString("ar-EG", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <main dir="rtl" className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
      <Card className="w-full max-w-xl border-emerald-500/40 shadow-xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <Badge variant="secondary" className="mx-auto bg-emerald-500/15 text-emerald-500 border-emerald-500/40">
            شهادة موثّقة
          </Badge>
          <CardTitle className="text-2xl">تم التحقق من صحة الشهادة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-right">
          <Row label="اسم الطالب" value={cert.student_name} />
          <Row label="الكورس" value={cert.course_title} />
          <Row label="تاريخ الإصدار" value={issued} />
          <Row label="كود الشهادة" value={cert.cert_code} mono />

          <div className="flex items-center justify-center pt-4 gap-2 text-muted-foreground text-sm">
            <Award className="h-4 w-4" /> صادرة من منصة فكرة ديزاين
          </div>

          <div className="flex justify-center pt-2">
            <Link to="/">
              <Button variant="outline">العودة للرئيسية</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${mono ? "font-mono tracking-wider" : ""}`}>{value}</span>
    </div>
  );
}

import { MascotLoader } from "@/components/common/MascotLoader";

function VerifyState({ status }: { status: "loading" | "missing" | "error" }) {
  if (status === "loading") {
    return (
      <main dir="rtl" className="min-h-screen bg-background flex items-center justify-center px-4">
        <MascotLoader size="md" />
      </main>
    );
  }

  const map = {
    missing: {
      title: "الشهادة غير موجودة",
      desc: "الكود ده مش مرتبط بأي شهادة صادرة من فكرة ديزاين.",
      icon: <XCircle className="h-8 w-8 text-destructive" />,
    },
    error: { title: "تعذر التحقق", desc: "حصل خطأ مؤقت، حاول تاني بعد شوية.", icon: <XCircle className="h-8 w-8 text-destructive" /> },
  } as const;
  const s = map[status];
  return (
    <main dir="rtl" className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-3">
          <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center">{s.icon}</div>
          <CardTitle>{s.title}</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">{s.desc}</CardContent>
      </Card>
    </main>
  );
}