import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/layout/SiteShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, UserX, RefreshCw, Trash2, Search, Download } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listInactiveUsers,
  deleteInactiveUsers,
} from "@/lib/inactive-users.functions";

export const Route = createFileRoute("/admin_/inactive-users")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login", search: { redirect: "/admin/inactive-users" } });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: session.user.id,
      _role: "admin",
    });
    if (!isAdmin) throw redirect({ to: "/" });
  },
  component: InactiveUsersPage,
});

type Row = {
  id: string;
  name: string | null;
  email: string | null;
  last_sign_in_at: string | null;
  last_active_at: string | null;
  created_at: string | null;
  reference_at: string | null;
};

type ReportItem = { userId: string; email: string | null; ok: boolean; error?: string };

function fmt(d: string | null) {
  if (!d) return "لم يسجّل دخول";
  try {
    return new Date(d).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "-";
  }
}

function InactiveUsersPage() {
  const list = useServerFn(listInactiveUsers);
  const del = useServerFn(deleteInactiveUsers);

  const [days, setDays] = useState<number>(90);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [report, setReport] = useState<ReportItem[] | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        (r.name ?? "").toLowerCase().includes(s) ||
        (r.email ?? "").toLowerCase().includes(s),
    );
  }, [rows, q]);

  const allChecked = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  const load = async () => {
    setLoading(true);
    setReport(null);
    setSelected(new Set());
    try {
      const res: any = await list({ data: { days } });
      setRows((res?.users ?? []) as Row[]);
      toast.success(`تم العثور على ${res?.users?.length ?? 0} حساب غير نشط`);
    } catch (e: any) {
      toast.error(e?.message ?? "فشل جلب الحسابات");
    } finally {
      setLoading(false);
    }
  };

  const toggleAll = (checked: boolean) => {
    const next = new Set(selected);
    filtered.forEach((r) => {
      if (checked) next.add(r.id);
      else next.delete(r.id);
    });
    setSelected(next);
  };

  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    setSelected(next);
  };

  const runDelete = async () => {
    if (selected.size === 0) {
      toast.error("اختر حسابات للحذف");
      return;
    }
    const ok = window.confirm(
      `سيتم حذف ${selected.size} حساب نهائيًا مع كل بياناته. المتابعة؟`,
    );
    if (!ok) return;
    setDeleting(true);
    try {
      const res: any = await del({
        data: { userIds: Array.from(selected), days },
      });
      setReport(res?.report ?? []);
      const done = res?.succeeded ?? 0;
      const failed = res?.failed ?? 0;
      toast.success(`تم حذف ${done} حساب${failed ? ` — فشل ${failed}` : ""}`);
      // Remove deleted from list
      const okIds = new Set(
        (res?.report ?? []).filter((r: ReportItem) => r.ok).map((r: ReportItem) => r.userId),
      );
      setRows((prev) => prev.filter((r) => !okIds.has(r.id)));
      setSelected(new Set());
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الحذف");
    } finally {
      setDeleting(false);
    }
  };

  const downloadReport = () => {
    if (!report) return;
    const header = "user_id,email,status,error\n";
    const body = report
      .map(
        (r) =>
          `${r.userId},${r.email ?? ""},${r.ok ? "deleted" : "failed"},"${(r.error ?? "").replace(/"/g, "'")}"`,
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inactive-users-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <SiteShell>
      <div className="container-page py-8 space-y-6" dir="rtl">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <UserX className="h-5 w-5" />
              <h1 className="text-2xl font-extrabold">الحسابات غير النشطة</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              اعرض واحذف الحسابات التي لم تسجّل دخولًا أو نشاطًا منذ فترة تحددها.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/admin">
              <ArrowRight className="h-4 w-4 ml-2" /> رجوع للإدارة
            </Link>
          </Button>
        </div>

        <Card className="p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] items-end">
            <div>
              <Label htmlFor="days">اعتبار الحساب غير نشط بعد (بالأيام)</Label>
              <Input
                id="days"
                type="number"
                min={1}
                max={3650}
                value={days}
                onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
                className="mt-1"
              />
              <div className="text-xs text-muted-foreground mt-1">
                اختصارات: 
                <button className="mx-1 underline" onClick={() => setDays(30)}>30 يوم</button>
                <button className="mx-1 underline" onClick={() => setDays(90)}>90 يوم</button>
                <button className="mx-1 underline" onClick={() => setDays(180)}>180 يوم</button>
                <button className="mx-1 underline" onClick={() => setDays(365)}>سنة</button>
              </div>
            </div>
            <Button onClick={load} disabled={loading} className="bg-gold text-gold-foreground hover:bg-gold/90">
              <RefreshCw className={`h-4 w-4 ml-2 ${loading ? "animate-spin" : ""}`} />
              {loading ? "جاري الفحص..." : "فحص الحسابات"}
            </Button>
            <Button
              variant="destructive"
              onClick={runDelete}
              disabled={deleting || selected.size === 0}
            >
              <Trash2 className="h-4 w-4 ml-2" />
              حذف المحدد ({selected.size})
            </Button>
          </div>
        </Card>

        {rows.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالاسم أو الإيميل..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-72"
                />
              </div>
              <Badge variant="secondary">
                إجمالي: {rows.length} • معروض: {filtered.length}
              </Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-right text-muted-foreground">
                    <th className="p-2 w-10">
                      <Checkbox
                        checked={allChecked}
                        onCheckedChange={(v) => toggleAll(!!v)}
                      />
                    </th>
                    <th className="p-2">الاسم</th>
                    <th className="p-2">الإيميل</th>
                    <th className="p-2">آخر دخول</th>
                    <th className="p-2">آخر نشاط</th>
                    <th className="p-2">تاريخ الإنشاء</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-muted/40">
                      <td className="p-2">
                        <Checkbox
                          checked={selected.has(r.id)}
                          onCheckedChange={(v) => toggleOne(r.id, !!v)}
                        />
                      </td>
                      <td className="p-2">{r.name || "—"}</td>
                      <td className="p-2 text-muted-foreground">{r.email || "—"}</td>
                      <td className="p-2">{fmt(r.last_sign_in_at)}</td>
                      <td className="p-2">{fmt(r.last_active_at)}</td>
                      <td className="p-2">{fmt(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {rows.length === 0 && !loading && (
          <Card className="p-8 text-center text-muted-foreground">
            اضغط "فحص الحسابات" لعرض الحسابات غير النشطة وفقًا للمدة المحددة.
          </Card>
        )}

        {report && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <UserX className="h-4 w-4" /> تقرير الحذف
              </div>
              <Button variant="outline" size="sm" onClick={downloadReport}>
                <Download className="h-4 w-4 ml-2" /> تنزيل CSV
              </Button>
            </div>
            <div className="flex gap-2 mb-3">
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                نجح: {report.filter((r) => r.ok).length}
              </Badge>
              <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                فشل: {report.filter((r) => !r.ok).length}
              </Badge>
              <Badge variant="secondary">الإجمالي: {report.length}</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-right text-muted-foreground">
                    <th className="p-2">الإيميل</th>
                    <th className="p-2">الحالة</th>
                    <th className="p-2">السبب</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map((r) => (
                    <tr key={r.userId} className="border-b">
                      <td className="p-2">{r.email || r.userId}</td>
                      <td className="p-2">
                        {r.ok ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">تم الحذف</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">فشل</Badge>
                        )}
                      </td>
                      <td className="p-2 text-muted-foreground">{r.error || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </SiteShell>
  );
}