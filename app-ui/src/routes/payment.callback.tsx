import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { SiteShell } from "@/components/layout/SiteShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { confirmKashierPayment } from "@/lib/kashier.functions";
import { fbqTrack } from "@/lib/pixel";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/use-cart";

type ConfirmPaymentResult = {
  ok?: boolean;
  amount?: number | string;
  courseId?: string;
  orderRef?: string;
  slug?: string;
  error?: string;
  pending?: boolean;
};

export const Route = createFileRoute("/payment/callback")({
  component: CallbackPage,
  validateSearch: (s: Record<string, unknown>) => s,
});

function CallbackPage() {
  const search = useSearch({ from: "/payment/callback" }) as Record<string, unknown>;
  const nav = useNavigate();
  const [status, setStatus] = useState<"checking" | "success" | "failed">("checking");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isPending, setIsPending] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [recheckCount, setRecheckCount] = useState(0);
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);
  const orderRef = (search.merchantOrderId || search.orderRef || search.orderId || "").toString();
  const confirmFn = useServerFn(confirmKashierPayment);
  const { clear: clearCart } = useCart();
  const isBundle = String(search.bundle ?? "") === "1" || orderRef.startsWith("BNDL-");

  const goToDashboard = (extraSearch?: Record<string, string | undefined>) =>
    nav({
      to: "/dashboard",
      search: {
        paid: "1",
        ref: orderRef || extraSearch?.ref,
        slug: extraSearch?.slug,
      },
    });

  const goToCourse = (slug: string) =>
    nav({ to: "/learn/$slug", params: { slug } });

  const runCheck = async (isRetry = false) => {
    if (isRetry) {
      setRechecking(true);
      setStatus("checking");
      setErrorMsg("");
      setIsPending(false);
    }
    if (isBundle && orderRef) {
      // Poll bundle_orders; the webhook flips status to 'approved' and enrolls.
      try {
        for (let i = 0; i < 8; i++) {
          const { data: row } = await supabase
            .from("bundle_orders" as never)
            .select("status, course_ids")
            .eq("transaction_ref", orderRef)
            .maybeSingle();
          const r = row as { status?: string } | null;
          if (r?.status === "approved") {
            clearCart();
            setStatus("success");
            fbqTrack("Purchase", { value: Number(search.amount ?? 0) || undefined, currency: "EGP" });
            window.setTimeout(() => goToDashboard({ ref: orderRef }), 1200);
            if (isRetry) { setRechecking(false); setRecheckCount((c) => c + 1); }
            return;
          }
          await new Promise((r) => setTimeout(r, 1500));
        }
        setStatus("failed");
        setIsPending(true);
        setErrorMsg("جاري التحقق من الدفع… لو خصم المبلغ، هيتفعّل الباكدج تلقائي خلال دقايق.");
      } catch (e) {
        setStatus("failed");
        setErrorMsg(e instanceof Error ? e.message : "");
      } finally {
        if (isRetry) { setRechecking(false); setRecheckCount((c) => c + 1); }
      }
      return;
    }
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(search)) {
      if (v != null) params[k] = String(v);
    }
    try {
      const res: ConfirmPaymentResult = await confirmFn({ data: { params } });
      if (res?.ok) {
        setStatus("success");
        const amount = Number(search.amount ?? res?.amount ?? 0) || undefined;
        fbqTrack("Purchase", {
          value: amount,
          currency: "EGP",
          content_ids: res?.courseId ? [res.courseId] : undefined,
          content_type: "product",
        });
        window.setTimeout(() => {
          if (res?.slug) goToCourse(res.slug);
          else goToDashboard({ ref: res?.orderRef });
        }, 1200);
      } else {
        setStatus("failed");
        setErrorMsg(res?.error || "");
        setIsPending(!!res?.pending);
        if (res?.pending) setTimeout(() => goToDashboard({ ref: res?.orderRef }), 1200);
      }
    } catch (e: unknown) {
      setStatus("failed");
      // requireSupabaseAuth middleware can throw a raw Response (401) when the
      // session isn't ready yet after redirect back from Kashier. Treat that as
      // pending so the user isn't dropped on a blank error screen.
      if (e instanceof Response || (typeof e === "object" && e !== null && "status" in (e as any) && !(e as any).message)) {
        setIsPending(true);
        setErrorMsg("جاري التحقق من الدفع…");
        setTimeout(() => goToDashboard(), 1500);
      } else {
        setErrorMsg(e instanceof Error ? e.message : "");
      }
    } finally {
      if (isRetry) {
        setRechecking(false);
        setRecheckCount((c) => c + 1);
      }
    }
  };

  useEffect(() => {
    runCheck(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const MAX_AUTO_RETRIES = 3;
  const AUTO_RETRY_SECONDS = 30;

  // Auto-retry: if check failed (non-pending) and we haven't exhausted retries,
  // start a 30s countdown then trigger another check.
  useEffect(() => {
    if (status !== "failed" || isPending || rechecking) {
      setAutoCountdown(null);
      return;
    }
    if (recheckCount >= MAX_AUTO_RETRIES) {
      setAutoCountdown(null);
      return;
    }
    setAutoCountdown(AUTO_RETRY_SECONDS);
    const interval = setInterval(() => {
      setAutoCountdown((s) => {
        if (s === null) return null;
        if (s <= 1) {
          clearInterval(interval);
          runCheck(true);
          return null;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isPending, rechecking, recheckCount]);

  return (
    <SiteShell>
      <div className="container-page py-20 max-w-xl">
        <Card className="p-8 text-center">
          {status === "checking" && (
            <>
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
              <h1 className="text-2xl font-bold mb-2">جاري تأكيد الدفع…</h1>
              <p className="text-muted-foreground">برجاء الانتظار، نتحقق من حالة طلبك.</p>
              {orderRef && (
                <p className="text-xs text-muted-foreground mt-3">رقم الطلب: {orderRef}</p>
              )}
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="h-14 w-14 mx-auto text-success mb-4" />
              <h1 className="text-2xl font-bold mb-2">تم الدفع بنجاح</h1>
              <p className="text-muted-foreground mb-5">تم تفعيل الكورس على حسابك.</p>
              <Button
                onClick={() => goToDashboard()}
                className="bg-gold text-gold-foreground hover:bg-gold/90"
              >
                الذهاب للوحة التحكم
              </Button>
            </>
          )}
          {status === "failed" && (
            <>
              {isPending ? (
                <Loader2 className="h-14 w-14 mx-auto text-primary mb-4 animate-spin" />
              ) : (
                <XCircle className="h-14 w-14 mx-auto text-destructive mb-4" />
              )}
              <h1 className="text-2xl font-bold mb-2">
                {isPending ? "جاري التحقق من الدفع" : "لم يتم إتمام الدفع"}
              </h1>
              <p className="text-muted-foreground mb-5">
                {errorMsg || "حدث خطأ أثناء معالجة الدفع. يمكنك إعادة المحاولة."}
              </p>
              {orderRef && (
                <p className="text-xs text-muted-foreground mb-4">رقم الطلب: {orderRef}</p>
              )}
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                {!isPending && (
                  <Button
                    onClick={() => runCheck(true)}
                    disabled={rechecking}
                    className="bg-gold text-gold-foreground hover:bg-gold/90"
                  >
                    {rechecking ? (
                      <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 ml-1" />
                    )}
                    إعادة فحص الدفع
                  </Button>
                )}
                <Button
                  onClick={() => (isPending ? goToDashboard() : nav({ to: "/courses" }))}
                  variant="outline"
                >
                  {isPending ? "الذهاب للوحة التحكم" : "العودة للكورسات"}
                </Button>
              </div>
              {recheckCount > 0 && !rechecking && status === "failed" && (
                <p className="text-xs text-muted-foreground mt-3">
                  تمت إعادة المحاولة {recheckCount} مرة. إن تم خصم المبلغ سيتم تفعيل الكورس تلقائياً.
                </p>
              )}
              {autoCountdown !== null && !rechecking && (
                <p className="text-xs text-muted-foreground mt-2">
                  إعادة فحص تلقائية خلال {autoCountdown} ثانية… ({recheckCount + 1}/{MAX_AUTO_RETRIES})
                </p>
              )}
            </>
          )}
        </Card>
      </div>
    </SiteShell>
  );
}
