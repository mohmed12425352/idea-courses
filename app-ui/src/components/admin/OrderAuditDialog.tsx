import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { History, CheckCircle2, XCircle, Webhook, AlertTriangle, Clock } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getOrderAudit } from "@/lib/order-audit.functions";
import { toast } from "sonner";

export function OrderAuditDialog({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const fetchAudit = useServerFn(getOrderAudit);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchAudit({ data: { orderId } });
      setEvents(res.events ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر تحميل السجل");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) load();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" title="سجل التدقيق">
          <History className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>سجل تدقيق الطلب</DialogTitle>
        </DialogHeader>
        {loading && <div className="text-sm text-muted-foreground">جاري التحميل…</div>}
        {!loading && events.length === 0 && (
          <div className="text-sm text-muted-foreground">لا توجد أحداث بعد.</div>
        )}
        <ol className="relative border-r-2 border-border pr-4 space-y-4">
          {events.map((ev, i) => (
            <li key={i} className="relative">
              <span className="absolute -right-[26px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background border-2 border-border">
                {ev.kind === "created" && <Clock className="h-3 w-3 text-warning" />}
                {ev.kind === "webhook" && <Webhook className="h-3 w-3 text-primary" />}
                {ev.kind === "failure" && <AlertTriangle className="h-3 w-3 text-destructive" />}
                {ev.kind === "reviewed" && ev.status === "approved" && (
                  <CheckCircle2 className="h-3 w-3 text-success" />
                )}
                {ev.kind === "reviewed" && ev.status === "rejected" && (
                  <XCircle className="h-3 w-3 text-destructive" />
                )}
              </span>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="font-semibold text-sm">{ev.title}</div>
                  {ev.description && (
                    <div className="text-xs text-muted-foreground mt-0.5">{ev.description}</div>
                  )}
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {new Date(ev.at).toLocaleString("ar-EG")}
                </Badge>
              </div>
              {ev.payload && (
                <details className="mt-2">
                  <summary className="text-xs cursor-pointer text-primary">
                    عرض Webhook payload
                  </summary>
                  <pre className="mt-1 text-[10px] bg-muted p-2 rounded overflow-x-auto max-h-64">
                    {JSON.stringify(ev.payload, null, 2)}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
