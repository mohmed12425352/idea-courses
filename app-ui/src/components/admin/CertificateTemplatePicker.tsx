import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, CheckCheck } from "lucide-react";
import type { CertState } from "./CertificatePositionEditor";

type SourceCourse = { id: string; title: string; certificate_config: Record<string, unknown> | null };

const EMPTY: CertState = {
  template_url: "", name_x: "", name_y: "", name_size: "", name_color: "",
  date_x: "", date_y: "", date_size: "", date_color: "", date_format: "",
  name_font: "", date_font: "",
  course_x: "", course_y: "", course_size: "", course_color: "", course_font: "", show_course: true,
  certid_x: "", certid_y: "", certid_size: "", certid_color: "", certid_font: "", show_certid: true,
  qr_x: "", qr_y: "", qr_size: "", show_qr: true,
};

export function certConfigToState(cfg: Record<string, any> | null | undefined): CertState {
  const c = cfg ?? {};
  const out: any = { ...EMPTY };
  for (const k of Object.keys(EMPTY) as (keyof CertState)[]) {
    if (k === "show_course" || k === "show_certid" || k === "show_qr") out[k] = c[k] !== false;
    else out[k] = c[k] ?? "";
  }
  return out as CertState;
}

export function certStateToConfig(cert: CertState) {
  const payload: Record<string, unknown> = {};
  for (const k of Object.keys(cert) as (keyof CertState)[]) {
    const v = cert[k];
    if (v === "" || v === null || v === undefined) continue;
    if (typeof v === "boolean") payload[k] = v;
    else if (String(k).endsWith("_color") || String(k).endsWith("_font") || k === "date_format" || k === "template_url") payload[k] = String(v);
    else payload[k] = Number(v);
  }
  return payload;
}

export function CertificateTemplatePicker({
  cert,
  setCert,
  currentCourseId,
}: {
  cert: CertState;
  setCert: (c: CertState) => void;
  currentCourseId?: string;
}) {
  const [sources, setSources] = useState<SourceCourse[]>([]);
  const [selected, setSelected] = useState("");
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("courses")
        .select("id,title,certificate_config")
        .not("certificate_config", "is", null)
        .order("title", { ascending: true });
      setSources(((data ?? []) as any[]).filter((c) => c.certificate_config?.template_url) as SourceCourse[]);
    })();
  }, []);

  const copyFrom = () => {
    const src = sources.find((s) => s.id === selected);
    if (!src) { toast.error("اختر كورس أولاً"); return; }
    setCert(certConfigToState(src.certificate_config as any));
    toast.success(`تم نسخ إعدادات الشهادة من: ${src.title}`);
  };

  const applyToAll = async () => {
    const payload = certStateToConfig(cert);
    if (!payload.template_url) { toast.error("لازم يكون فيه قالب شهادة أولاً"); return; }
    if (!confirm("تطبيق نفس الشهادة ونفس الإعدادات على كل الكورسات؟ ده هيستبدل إعدادات الشهادة الحالية في كل الكورسات.")) return;
    setApplying(true);
    try {
      let q = supabase.from("courses").update({ certificate_config: payload as never });
      q = currentCourseId ? q.neq("id", currentCourseId) : q.not("id", "is", null);
      const { error } = await q.select("id");
      if (error) throw error;
      toast.success("تم تطبيق نفس الشهادة على كل الكورسات");
    } catch (e: any) {
      toast.error(e?.message || "فشل التطبيق");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="mb-4 rounded-md border bg-muted/30 p-3 space-y-2">
      <Label className="font-semibold text-sm">استخدام قالب شهادة من كورس آخر</Label>
      <p className="text-xs text-muted-foreground">
        اختر كورس معدّ شهادته صح (مثلاً كورس الذكاء الاصطناعي) وانسخ منه القالب وكل الإعدادات، أو طبّق الإعدادات الحالية على كل الكورسات دفعة واحدة.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">— اختر كورس كقالب —</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
        <Button type="button" variant="outline" onClick={copyFrom} disabled={!selected}>
          <Copy className="h-4 w-4 ml-1" /> نسخ الإعدادات
        </Button>
        <Button type="button" variant="gold" onClick={applyToAll} disabled={applying}>
          <CheckCheck className="h-4 w-4 ml-1" /> {applying ? "..." : "تطبيق على كل الكورسات"}
        </Button>
      </div>
    </div>
  );
}
