import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { renderCertificatePreviewDataUrl } from "@/lib/certificate";
import { toast } from "sonner";
import type { CertState } from "./CertificatePositionEditor";

export function CertificateLivePreview({
  cert,
  courseTitle,
  courseSlug,
}: {
  cert: CertState;
  courseTitle: string;
  courseSlug: string;
}) {
  const [sampleName, setSampleName] = useState("محمد أحمد علي");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const buildOverrides = () => {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(cert) as (keyof CertState)[]) {
      const v = cert[k];
      if (v === "" || v === null || v === undefined) continue;
      if (typeof v === "boolean") {
        o[k] = v;
      } else if (k.endsWith("_color") || k.endsWith("_font") || k === "date_format" || k === "template_url") {
        o[k] = String(v);
      } else {
        o[k] = Number(v);
      }
    }
    return o as never;
  };

  const run = async () => {
    if (!sampleName.trim()) return;
    setLoading(true);
    try {
      const url = await renderCertificatePreviewDataUrl({
        studentName: sampleName.trim(),
        courseTitle: courseTitle || "دورة تجريبية",
        courseSlug: courseSlug || undefined,
        overrides: buildOverrides(),
        certCode: "CERT-DEMO-1234",
        verifyUrl: `https://fekradesign.shalaby3.online/verify/CERT-DEMO-1234`,
      });
      setPreviewUrl(url);
    } catch (e) {
      toast.error("فشل توليد المعاينة. تأكد من رابط القالب.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 rounded-md border p-3 space-y-3 bg-muted/30">
      <Label className="font-semibold">معاينة الشهادة الحقيقية (قبل الحفظ)</Label>
      <p className="text-xs text-muted-foreground">
        هذه المعاينة تستخدم نفس محرك توليد ملف PDF للطالب — اللي تشوفه هنا هو اللي هيتولّد فعلاً.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="اسم تجريبي للطالب"
          value={sampleName}
          onChange={(e) => setSampleName(e.target.value)}
        />
        <Button type="button" onClick={run} disabled={loading} variant="gold">
          {loading ? "...جاري التوليد" : "توليد المعاينة"}
        </Button>
      </div>
      {previewUrl ? (
        <img
          src={previewUrl}
          alt="معاينة الشهادة"
          className="w-full h-auto rounded-md border shadow-sm"
        />
      ) : (
        <p className="text-xs text-muted-foreground">اضغط «توليد المعاينة» لرؤية الشكل النهائي بأسم تجريبي.</p>
      )}
    </div>
  );
}