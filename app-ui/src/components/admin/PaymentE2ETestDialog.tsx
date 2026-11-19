import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, FlaskConical, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { runPaymentE2ETest } from "@/lib/payment-e2e.functions";
import { toast } from "sonner";

export function PaymentE2ETestDialog({ courses }: { courses: { id: string; title: string; slug: string }[] }) {
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState<string>("");
  const [cleanup, setCleanup] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const runTest = useServerFn(runPaymentE2ETest);

  useEffect(() => {
    if (open && !courseId && courses.length) setCourseId(courses[0].id);
  }, [open, courses, courseId]);

  const run = async () => {
    if (!courseId) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await runTest({ data: { courseId, cleanup } });
      setResult(res);
      if (res.ok) toast.success("نجح اختبار E2E");
      else toast.error("فشل اختبار E2E — راجع التفاصيل");
    } catch (e: any) {
      toast.error(e?.message ?? "خطأ غير متوقع");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <FlaskConical className="h-4 w-4 ml-1" /> اختبار الدفع E2E
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>اختبار سيناريو الدفع الكامل</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-sm">الكورس المراد اختباره</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="اختر كورس" /></SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded border p-2">
            <Label htmlFor="e2e-cleanup" className="text-sm">حذف بيانات الاختبار بعد الانتهاء</Label>
            <Switch id="e2e-cleanup" checked={cleanup} onCheckedChange={setCleanup} />
          </div>

          <Button onClick={run} disabled={running || !courseId} className="w-full">
            {running ? "جاري التشغيل…" : "تشغيل الاختبار"}
          </Button>

          {result && (
            <div className="space-y-2">
              <ul className="space-y-1">
                {result.steps.map((s: any, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    {s.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                    )}
                    <span className="flex-1">
                      <span className="font-medium">{s.name}</span>
                      {s.detail && (
                        <span className="text-xs text-muted-foreground block">{s.detail}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              {result.ok && result.courseSlug && !cleanup && (
                <Button asChild className="w-full" variant="default">
                  <Link to="/learn/$slug" params={{ slug: result.courseSlug }}>
                    <ExternalLink className="h-4 w-4 ml-1" />
                    افتح صفحة الكورس للتحقق
                  </Link>
                </Button>
              )}
              {result.ok && cleanup && (
                <p className="text-xs text-muted-foreground text-center">
                  ✓ النتيجة: لو كان الاختبار بدون تنظيف، كنت ستُوجَّه تلقائياً لصفحة الكورس بعد الدفع.
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
