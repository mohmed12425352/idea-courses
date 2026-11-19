import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/layout/SiteShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, DollarSign, Search, Send, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { sendBalanceReminders } from "@/lib/balance-notifications.functions";

export const Route = createFileRoute("/admin_/balance-notifications")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login", search: { redirect: "/admin/balance-notifications" } });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" });
    if (!isAdmin) throw redirect({ to: "/" });
  },
  component: BalanceNotificationsPage,
});

type Student = { id: string; name: string; email: string };
type Course = { id: string; title: string };
type BulkRow = {
  userId: string;
  amount: string;
  courseTitle: string;
  note: string;
  totalAmount: string;
  paidAmount: string;
  dueDate: string;
};

function BalanceNotificationsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const send = useServerFn(sendBalanceReminders);

  // Single
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [courseId, setCourseId] = useState<string>("");
  const [note, setNote] = useState<string>("");

  // Bulk
  const [rows, setRows] = useState<BulkRow[]>([]);
  // Bulk shared fields
  const [bulkCourseId, setBulkCourseId] = useState<string>("");
  const [bulkDueDate, setBulkDueDate] = useState<string>("");
  const [bulkNote, setBulkNote] = useState<string>("");
  const [bulkStudentQuery, setBulkStudentQuery] = useState<string>("");
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  const [bulkAmount, setBulkAmount] = useState<string>("");
  const [bulkTotalAmount, setBulkTotalAmount] = useState<string>("");
  const [bulkPaidAmount, setBulkPaidAmount] = useState<string>("");
  const [bulkEnrolledIds, setBulkEnrolledIds] = useState<string[] | null>(null);
  const [bulkEnrollLoading, setBulkEnrollLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [pp, cc] = await Promise.all([
        supabase.from("profiles").select("id, name, email").order("name"),
        supabase.from("courses").select("id, title").order("title"),
      ]);
      setStudents((pp.data ?? []) as Student[]);
      setCourses((cc.data ?? []) as Course[]);
      setLoading(false);
    })();
  }, []);

  // Load enrolled student IDs whenever the bulk course changes
  useEffect(() => {
    if (!bulkCourseId) { setBulkEnrolledIds(null); return; }
    let cancelled = false;
    (async () => {
      setBulkEnrollLoading(true);
      const { data, error } = await supabase
        .from("enrollments")
        .select("user_id")
        .eq("course_id", bulkCourseId);
      if (cancelled) return;
      if (error) {
        toast.error("تعذّر جلب طلاب الكورس");
        setBulkEnrolledIds([]);
      } else {
        setBulkEnrolledIds((data ?? []).map((r: any) => r.user_id));
      }
      setBulkSelectedIds([]);
      setBulkEnrollLoading(false);
    })();
    return () => { cancelled = true; };
  }, [bulkCourseId]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return students.slice(0, 30);
    return students
      .filter((s) => (s.name || "").toLowerCase().includes(t) || (s.email || "").toLowerCase().includes(t))
      .slice(0, 50);
  }, [q, students]);

  const submitSingle = async () => {
    const amt = Number(amount);
    if (!selectedId) return toast.error("اختر الطالب أولاً");
    if (!isFinite(amt) || amt <= 0) return toast.error("أدخل مبلغاً صحيحاً أكبر من صفر");
    const courseTitle = courses.find((c) => c.id === courseId)?.title || "";
    const total = totalAmount ? Number(totalAmount) : undefined;
    const paid = paidAmount ? Number(paidAmount) : undefined;
    setSending(true);
    try {
      const res: any = await send({
        data: {
          items: [{
            userId: selectedId, amount: amt, courseTitle, note,
            totalAmount: total, paidAmount: paid,
            dueDate: dueDate || undefined,
          }],
        },
      });
      if (res?.sent > 0) {
        toast.success("تم إرسال الفاتورة بنجاح");
        setAmount(""); setNote(""); setCourseId(""); setSelectedId("");
        setTotalAmount(""); setPaidAmount(""); setDueDate("");
      } else {
        toast.error("تعذّر إرسال التذكير — راجع البريد أو الصلاحيات");
      }
    } catch (e: any) {
      toast.error(e?.message || "فشل الإرسال");
    } finally {
      setSending(false);
    }
  };

  const addRow = (userId?: string) => {
    setRows((r) => [
      ...r,
      { userId: userId || "", amount: "", courseTitle: "", note: "", totalAmount: "", paidAmount: "", dueDate: "" },
    ]);
  };
  const updateRow = (i: number, patch: Partial<BulkRow>) => {
    setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  };
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  const bulkFiltered = useMemo(() => {
    const base = bulkEnrolledIds
      ? students.filter((s) => bulkEnrolledIds.includes(s.id))
      : students;
    const t = bulkStudentQuery.trim().toLowerCase();
    if (!t) return base.slice(0, 100);
    return base
      .filter((s) => (s.name || "").toLowerCase().includes(t) || (s.email || "").toLowerCase().includes(t))
      .slice(0, 200);
  }, [bulkStudentQuery, students, bulkEnrolledIds]);

  const toggleBulkStudent = (id: string) => {
    setBulkSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  const applyBulkSelectionToRows = () => {
    const courseTitle = courses.find((c) => c.id === bulkCourseId)?.title || "";
    const amt = bulkAmount;
    const total = bulkTotalAmount;
    const paid = bulkPaidAmount;
    if (bulkSelectedIds.length === 0) return toast.error("اختر طالباً واحداً على الأقل");
    setRows((r) => {
      const existing = new Set(r.map((x) => x.userId));
      const additions: BulkRow[] = bulkSelectedIds
        .filter((id) => !existing.has(id))
        .map((id) => ({
          userId: id,
          amount: amt,
          courseTitle,
          note: bulkNote,
          totalAmount: total,
          paidAmount: paid,
          dueDate: bulkDueDate,
        }));
      return [...r, ...additions];
    });
    toast.success(`تمت إضافة ${bulkSelectedIds.length} طالب`);
    setBulkSelectedIds([]);
  };

  const submitBulk = async () => {
    const items = rows
      .map((r) => ({
        userId: r.userId,
        amount: Number(r.amount),
        courseTitle: r.courseTitle,
        note: r.note,
        totalAmount: r.totalAmount ? Number(r.totalAmount) : undefined,
        paidAmount: r.paidAmount ? Number(r.paidAmount) : undefined,
        dueDate: r.dueDate || undefined,
      }))
      .filter((r) => r.userId && isFinite(r.amount) && r.amount > 0);
    if (items.length === 0) return toast.error("أضف صفاً واحداً على الأقل بمبلغ صحيح");
    setSending(true);
    try {
      const res: any = await send({ data: { items } });
      toast.success(`تم إرسال ${res?.sent ?? 0} من ${res?.total ?? items.length}`);
      if ((res?.sent ?? 0) === (res?.total ?? items.length)) setRows([]);
    } catch (e: any) {
      toast.error(e?.message || "فشل الإرسال");
    } finally {
      setSending(false);
    }
  };

  return (
    <SiteShell>
      <div className="container-page py-6 md:py-8 max-w-5xl">
        <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowRight className="h-4 w-4" /> العودة للوحة الأدمن
        </Link>
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-gold/15 text-gold grid place-items-center">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-primary">تذكير الطلاب بالمبلغ المتبقي</h1>
            <p className="text-xs text-muted-foreground">يوصل للطالب إشعار في المنصة + إيميل تلقائي.</p>
          </div>
        </div>

        <Tabs defaultValue="single" className="space-y-4">
          <TabsList>
            <TabsTrigger value="single"><Send className="h-4 w-4 ml-1" /> إرسال فردي</TabsTrigger>
            <TabsTrigger value="bulk"><Users className="h-4 w-4 ml-1" /> إرسال جماعي</TabsTrigger>
          </TabsList>

          {/* SINGLE */}
          <TabsContent value="single">
            <Card className="p-4 md:p-6 space-y-4">
              <div>
                <Label>ابحث عن الطالب</Label>
                <div className="relative mt-1">
                  <Search className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="اسم أو إيميل الطالب..."
                    className="pr-9"
                  />
                </div>
                {loading ? (
                  <div className="text-xs text-muted-foreground mt-2">جاري التحميل…</div>
                ) : (
                  <div className="mt-2 max-h-60 overflow-y-auto border rounded-lg divide-y">
                    {filtered.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">لا يوجد نتائج</div>
                    ) : (
                      filtered.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedId(s.id)}
                          className={`w-full text-right p-2.5 hover:bg-secondary/50 transition-colors flex items-center justify-between ${selectedId === s.id ? "bg-secondary/70" : ""}`}
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{s.name || "—"}</div>
                            <div className="text-xs text-muted-foreground truncate" dir="ltr">{s.email}</div>
                          </div>
                          {selectedId === s.id && <Badge className="bg-primary text-white">مختار</Badge>}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label>المبلغ المتبقي (ج.م)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="مثال: 500"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>الكورس (اختياري)</Label>
                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="اختر كورس..." /></SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <Label>إجمالي السعر (اختياري)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="مثال: 1500"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>المدفوع سابقاً (اختياري)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder="مثال: 1000"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>تاريخ الاستحقاق (اختياري)</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>ملاحظة إضافية (اختياري)</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="مثال: برجاء السداد خلال 3 أيام..."
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={submitSingle} disabled={sending || !selectedId}>
                  <Send className="h-4 w-4 ml-1" /> {sending ? "جاري الإرسال..." : "إرسال الفاتورة"}
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* BULK */}
          <TabsContent value="bulk">
            <Card className="p-4 md:p-6 space-y-4">
              {/* Shared defaults */}
              <div className="rounded-lg border p-3 md:p-4 space-y-3 bg-secondary/20">
                <div className="text-sm font-semibold">القيم المشتركة (تُطبَّق على الطلاب المختارين)</div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">الكورس</Label>
                    <Select value={bulkCourseId} onValueChange={setBulkCourseId}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="اختر كورس..." /></SelectTrigger>
                      <SelectContent>
                        {courses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">تاريخ الاستحقاق</Label>
                    <Input type="date" value={bulkDueDate} onChange={(e) => setBulkDueDate(e.target.value)} className="mt-1" />
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">إجمالي السعر</Label>
                    <Input type="number" inputMode="decimal" value={bulkTotalAmount}
                      onChange={(e) => setBulkTotalAmount(e.target.value)} placeholder="مثال: 1500" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">المدفوع</Label>
                    <Input type="number" inputMode="decimal" value={bulkPaidAmount}
                      onChange={(e) => setBulkPaidAmount(e.target.value)} placeholder="مثال: 1000" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">المتبقي</Label>
                    <Input type="number" inputMode="decimal" value={bulkAmount}
                      onChange={(e) => setBulkAmount(e.target.value)} placeholder="مثال: 500" className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">ملاحظة</Label>
                  <Textarea value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} rows={2}
                    placeholder="اختياري — تُطبَّق على كل الطلاب المضافين" className="mt-1" />
                </div>
              </div>

              {/* Student picker */}
              <div className="rounded-lg border p-3 md:p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">
                    اختر الطلاب
                    {bulkCourseId && (
                      <span className="text-xs font-normal text-muted-foreground mr-2">
                        (طلاب الكورس المختار فقط — {bulkEnrollLoading ? "جاري التحميل…" : `${bulkEnrolledIds?.length ?? 0} طالب`})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{bulkSelectedIds.length} محدد</div>
                </div>
                <div className="relative">
                  <Search className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={bulkStudentQuery} onChange={(e) => setBulkStudentQuery(e.target.value)}
                    placeholder="اسم أو إيميل..." className="pr-9" />
                </div>
                <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                  {bulkFiltered.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">لا يوجد نتائج</div>
                  ) : (
                    bulkFiltered.map((s) => {
                      const on = bulkSelectedIds.includes(s.id);
                      return (
                        <button key={s.id} type="button" onClick={() => toggleBulkStudent(s.id)}
                          className={`w-full text-right p-2.5 hover:bg-secondary/50 transition-colors flex items-center justify-between ${on ? "bg-secondary/70" : ""}`}>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{s.name || "—"}</div>
                            <div className="text-xs text-muted-foreground truncate" dir="ltr">{s.email}</div>
                          </div>
                          {on && <Badge className="bg-primary text-white">مختار</Badge>}
                        </button>
                      );
                    })
                  )}
                </div>
                <div className="flex flex-wrap gap-2 justify-between">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setBulkSelectedIds(bulkFiltered.map((s) => s.id))}>
                      تحديد كل الظاهر
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setBulkSelectedIds([])}>
                      مسح التحديد
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => addRow()}>
                      <Plus className="h-4 w-4 ml-1" /> صف فارغ
                    </Button>
                    <Button size="sm" onClick={applyBulkSelectionToRows} disabled={bulkSelectedIds.length === 0}>
                      <Plus className="h-4 w-4 ml-1" /> إضافة المختارين ({bulkSelectedIds.length})
                    </Button>
                  </div>
                </div>
              </div>

              {rows.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg">
                  حدد الطلاب من الأعلى واضغط "إضافة المختارين"
                </div>
              ) : (
                <div className="space-y-3">
                  {rows.map((r, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start border rounded-lg p-3">
                      <div className="md:col-span-3">
                        <Label className="text-xs">الطالب</Label>
                        <Select value={r.userId} onValueChange={(v) => updateRow(i, { userId: v })}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="اختر طالب..." /></SelectTrigger>
                          <SelectContent className="max-h-72">
                            {students.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.name} — {s.email}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs">المتبقي</Label>
                        <Input
                          type="number"
                          value={r.amount}
                          onChange={(e) => updateRow(i, { amount: e.target.value })}
                          placeholder="0"
                          className="mt-1"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <Label className="text-xs">الإجمالي</Label>
                        <Input type="number" value={r.totalAmount}
                          onChange={(e) => updateRow(i, { totalAmount: e.target.value })} placeholder="0" className="mt-1" />
                      </div>
                      <div className="md:col-span-1">
                        <Label className="text-xs">المدفوع</Label>
                        <Input type="number" value={r.paidAmount}
                          onChange={(e) => updateRow(i, { paidAmount: e.target.value })} placeholder="0" className="mt-1" />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs">الاستحقاق</Label>
                        <Input type="date" value={r.dueDate}
                          onChange={(e) => updateRow(i, { dueDate: e.target.value })} className="mt-1" />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs">الكورس</Label>
                        <Input
                          value={r.courseTitle}
                          onChange={(e) => updateRow(i, { courseTitle: e.target.value })}
                          placeholder="اسم الكورس"
                          className="mt-1"
                        />
                      </div>
                      <div className="md:col-span-12">
                        <Label className="text-xs">ملاحظة</Label>
                        <Input
                          value={r.note}
                          onChange={(e) => updateRow(i, { note: e.target.value })}
                          placeholder="اختياري"
                          className="mt-1"
                        />
                      </div>
                      <div className="md:col-span-12 flex justify-end">
                        <Button variant="ghost" size="icon" onClick={() => removeRow(i)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <div className="text-xs text-muted-foreground">{rows.length} صف</div>
                <Button onClick={submitBulk} disabled={sending || rows.length === 0}>
                  <Send className="h-4 w-4 ml-1" /> {sending ? "جاري الإرسال..." : `إرسال للكل (${rows.length})`}
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SiteShell>
  );
}