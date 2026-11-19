import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Globe, CheckCircle2, AlertTriangle, XCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { checkDomainHealth } from "@/lib/dns-check.functions";

type Result = Awaited<ReturnType<typeof checkDomainHealth>>;

const PRESETS = [
  "shalaby3.online",
  "www.shalaby3.online",
  "fekradesign.shalaby3.online",
];

export function DomainHealthPanel() {
  const run = useServerFn(checkDomainHealth);
  const [domain, setDomain] = useState("fekradesign.shalaby3.online");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const check = async (d?: string) => {
    const target = (d ?? domain).trim();
    if (!target) return;
    setDomain(target);
    setLoading(true);
    setResult(null);
    try {
      const res = await run({ data: { domain: target } });
      setResult(res);
    } catch (e: any) {
      toast.error(e?.message || "فشل الفحص");
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم النسخ");
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <Globe className="h-4 w-4" /> فحص صحة الدومين و DNS
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
            className="flex-1 min-w-[220px]"
            dir="ltr"
          />
          <Button onClick={() => check()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
            افحص الآن
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p}
              size="sm"
              variant="outline"
              onClick={() => check(p)}
              disabled={loading}
            >
              {p}
            </Button>
          ))}
        </div>
      </Card>

      {result && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="font-semibold" dir="ltr">{result.domain}</div>
            <Badge variant="outline" className="text-xs">
              {new Date(result.checkedAt).toLocaleString("ar-EG")}
            </Badge>
          </div>

          <div className="space-y-2">
            {result.issues.map((it, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 rounded-md p-2 text-sm ${
                  it.level === "error"
                    ? "bg-destructive/10 text-destructive"
                    : it.level === "warn"
                      ? "bg-warning/10 text-warning-foreground"
                      : "bg-success/10 text-success-foreground"
                }`}
              >
                {it.level === "error" ? (
                  <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                ) : it.level === "warn" ? (
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                )}
                <span>{it.message}</span>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-3 text-xs" dir="ltr">
            <RecordRow label="A" values={result.records.a} expected={result.expected.ip} onCopy={copy} />
            <RecordRow label="www A" values={result.records.www_a} expected={result.expected.ip} onCopy={copy} />
            <RecordRow label="CNAME" values={result.records.cname} onCopy={copy} />
            <RecordRow label="TXT" values={result.records.txt} onCopy={copy} />
            <RecordRow label={`TXT ${result.expected.txt_name}`} values={result.records.lovable_txt} onCopy={copy} />
            <RecordRow
              label="HTTPS"
              values={[
                result.http.ok
                  ? `${result.http.status} • ${result.http.ms}ms`
                  : `FAIL • ${result.http.error || "timeout"}`,
              ]}
              onCopy={copy}
            />
          </div>

          <div className="rounded-md border p-3 text-xs space-y-1" dir="rtl">
            <div className="font-semibold">الإعدادات المتوقعة عند مزود الدومين:</div>
            <div dir="ltr">A @ → 185.158.133.1</div>
            <div dir="ltr">A www → 185.158.133.1</div>
            <div dir="ltr">TXT _lovable → (القيمة من Lovable)</div>
          </div>
        </Card>
      )}
    </div>
  );
}

function RecordRow({
  label,
  values,
  expected,
  onCopy,
}: {
  label: string;
  values: string[];
  expected?: string;
  onCopy: (s: string) => void;
}) {
  const isMatch = expected ? values.includes(expected) : undefined;
  return (
    <div className="rounded border p-2">
      <div className="text-muted-foreground mb-1 flex items-center justify-between">
        <span>{label}</span>
        {isMatch !== undefined && (
          <Badge variant={isMatch ? "default" : "destructive"} className="text-[10px]">
            {isMatch ? "OK" : "غير مطابق"}
          </Badge>
        )}
      </div>
      {values.length === 0 ? (
        <div className="text-muted-foreground italic">— لا يوجد —</div>
      ) : (
        <div className="space-y-1">
          {values.map((v, i) => (
            <div key={i} className="flex items-center justify-between gap-2 font-mono break-all">
              <span>{v}</span>
              <button
                type="button"
                onClick={() => onCopy(v)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}