import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, Bot, UserCog, CheckCircle2, Paperclip, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export type Conv = {
  id: string;
  visitor_name: string;
  visitor_email: string | null;
  visitor_phone?: string | null;
  status: "bot" | "waiting_human" | "human" | "closed";
  assigned_to: string | null;
  last_message_at: string;
  created_at: string;
  closed_reason?: string | null;
  closed_at?: string | null;
  closed_by?: string | null;
};

export type Msg = {
  id: string;
  conversation_id: string;
  sender_role: "visitor" | "bot" | "moderator";
  sender_name: string | null;
  content: string;
  created_at: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
};

export function SupportInbox({ heightClass = "h-[calc(100vh-200px)]" }: { heightClass?: string }) {
  const { user, profile } = useAuth();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [closing, setClosing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visitorTyping, setVisitorTyping] = useState(false);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const clearTypingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentTypingRef = useRef<number>(0);

  const loadConvs = async () => {
    const { data } = await supabase
      .from("support_conversations")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(200);
    setConvs((data ?? []) as Conv[]);
  };

  useEffect(() => { loadConvs(); }, []);

  useEffect(() => {
    const ch = supabase
      .channel("support-inbox-convs")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_conversations" }, () => loadConvs())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("support_messages")
        .select("*")
        .eq("conversation_id", activeId)
        .order("created_at");
      if (!cancelled) setMessages((data ?? []) as Msg[]);
    })();
    const ch = supabase
      .channel(`support-inbox-msgs-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          const m = payload.new as Msg;
          setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
        },
      )
      .subscribe();
    const typingCh = supabase.channel(`support-typing-${activeId}`, { config: { broadcast: { self: false } } });
    typingCh.on("broadcast", { event: "typing" }, ({ payload }) => {
      if (payload?.role === "visitor") {
        setVisitorTyping(true);
        if (clearTypingRef.current) clearTimeout(clearTypingRef.current);
        clearTypingRef.current = setTimeout(() => setVisitorTyping(false), 2500);
      }
    }).subscribe();
    typingChannelRef.current = typingCh;
    setVisitorTyping(false);
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
      if (clearTypingRef.current) clearTimeout(clearTypingRef.current);
      supabase.removeChannel(typingCh);
      typingChannelRef.current = null;
    };
  }, [activeId]);

  const broadcastTyping = () => {
    const ch = typingChannelRef.current;
    if (!ch || !active || active.status === "closed") return;
    const now = Date.now();
    if (now - lastSentTypingRef.current < 1500) return;
    lastSentTypingRef.current = now;
    ch.send({ type: "broadcast", event: "typing", payload: { role: "moderator" } });
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, visitorTyping]);

  const claim = async (id: string) => {
    const { error } = await supabase
      .from("support_conversations")
      .update({ status: "human", assigned_to: user!.id })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    setActiveId(id);
  };

  const send = async () => {
    if (!input.trim() || !activeId || sending || !user) return;
    setSending(true);
    const text = input.trim();
    setInput("");
    const { error } = await supabase.from("support_messages").insert({
      conversation_id: activeId,
      sender_role: "moderator",
      sender_id: user.id,
      sender_name: profile?.name ?? "موظف الدعم",
      content: text,
    });
    if (error) { toast.error(error.message); setInput(text); }
    setSending(false);
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !activeId || !user) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("الحد الأقصى 10 ميجا"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() || "bin";
    const path = `${activeId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("support-attachments")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) { setUploading(false); toast.error(upErr.message); return; }
    const { data: pub } = supabase.storage.from("support-attachments").getPublicUrl(path);
    const { error } = await supabase.from("support_messages").insert({
      conversation_id: activeId,
      sender_role: "moderator",
      sender_id: user.id,
      sender_name: profile?.name ?? "موظف الدعم",
      content: file.name,
      attachment_url: pub.publicUrl,
      attachment_name: file.name,
      attachment_type: file.type || "application/octet-stream",
    });
    setUploading(false);
    if (error) toast.error(error.message);
  };

  const openCloseDialog = () => {
    setCloseReason("");
    setCloseOpen(true);
  };

  const confirmClose = async () => {
    if (!activeId || !user) return;
    const reason = closeReason.trim();
    if (reason.length < 2) { toast.error("اكتب سبب مختصر للإنهاء"); return; }
    setClosing(true);
    const { error } = await supabase
      .from("support_conversations")
      .update({
        status: "closed",
        closed_reason: reason,
        closed_at: new Date().toISOString(),
        closed_by: user.id,
      })
      .eq("id", activeId);
    if (error) { toast.error(error.message); setClosing(false); return; }
    // Post a system message so the visitor sees the closure + reason
    await supabase.from("support_messages").insert({
      conversation_id: activeId,
      sender_role: "moderator",
      sender_id: user.id,
      sender_name: profile?.name ?? "موظف الدعم",
      content: `✅ تم إنهاء المحادثة كـ "محلولة".\nالسبب: ${reason}`,
    });
    toast.success("تم إنهاء المحادثة");
    setCloseOpen(false);
    setClosing(false);
    setActiveId(null);
    loadConvs();
  };

  const active = convs.find((c) => c.id === activeId);
  const waiting = convs.filter((c) => c.status === "waiting_human");
  const inHuman = convs.filter((c) => c.status === "human");
  const inBot = convs.filter((c) => c.status === "bot");
  const closed = convs.filter((c) => c.status === "closed");

  return (
    <div className={`grid lg:grid-cols-[320px_1fr] gap-4 ${heightClass}`}>
      <Card className="flex flex-col overflow-hidden">
        <div className="border-b p-3 grid grid-cols-4 gap-1 text-center text-xs">
          <div className="bg-destructive/10 text-destructive rounded p-1.5"><div className="font-bold text-base">{waiting.length}</div>في الانتظار</div>
          <div className="bg-success/10 text-success rounded p-1.5"><div className="font-bold text-base">{inHuman.length}</div>مع موظف</div>
          <div className="bg-muted rounded p-1.5"><div className="font-bold text-base">{inBot.length}</div>مع البوت</div>
          <div className="bg-muted rounded p-1.5"><div className="font-bold text-base">{closed.length}</div>محلولة</div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {convs.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">لا توجد محادثات</div>
          )}
          {[...waiting, ...inHuman, ...inBot, ...closed].map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`w-full text-right p-3 border-b hover:bg-muted/50 transition ${activeId === c.id ? "bg-muted" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-sm truncate">{c.visitor_name}</div>
                {c.status === "waiting_human" && <Badge variant="destructive" className="text-[10px]">في الانتظار</Badge>}
                {c.status === "human" && <Badge className="text-[10px] bg-success">جاري</Badge>}
                {c.status === "bot" && <Badge variant="secondary" className="text-[10px]"><Bot className="h-3 w-3" /></Badge>}
                {c.status === "closed" && <Badge variant="outline" className="text-[10px]">محلولة</Badge>}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {c.visitor_email || c.visitor_phone || "—"}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5" dir="ltr">
                {new Date(c.last_message_at).toLocaleString("ar-EG", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col overflow-hidden">
        {!active ? (
          <div className="flex-1 grid place-items-center text-muted-foreground text-sm">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-30" />
              اختر محادثة من القائمة
            </div>
          </div>
        ) : (
          <>
            <div className="border-b p-3 flex items-center justify-between">
              <div>
                <div className="font-bold">{active.visitor_name}</div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                  {active.visitor_email && <span>📧 {active.visitor_email}</span>}
                  {active.visitor_phone && <span dir="ltr">📱 {active.visitor_phone}</span>}
                  {!active.visitor_email && !active.visitor_phone && <span className="italic">بدون وسيلة تواصل</span>}
                </div>
              </div>
              <div className="flex gap-2">
                {active.status === "waiting_human" && (
                  <Button size="sm" onClick={() => claim(active.id)}>استلام المحادثة</Button>
                )}
                {(active.status === "human" || active.status === "waiting_human") && (
                  <Button size="sm" variant="outline" onClick={openCloseDialog}>
                    <CheckCircle2 className="h-3.5 w-3.5 ml-1" /> إنهاء كمحلولة
                  </Button>
                )}
              </div>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-background">
              {messages.map((m) => {
                const isMod = m.sender_role === "moderator";
                const isImage = m.attachment_type?.startsWith("image/");
                return (
                  <div key={m.id} className={`flex ${isMod ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      isMod ? "bg-primary text-primary-foreground"
                      : m.sender_role === "bot" ? "bg-muted text-foreground"
                      : "bg-secondary text-foreground"
                    }`}>
                      <div className="text-[10px] font-bold opacity-70 mb-0.5 flex items-center gap-1">
                        {m.sender_role === "bot" && <Bot className="h-3 w-3" />}
                        {m.sender_role === "moderator" && <UserCog className="h-3 w-3" />}
                        {m.sender_name ?? (m.sender_role === "bot" ? "البوت" : m.sender_role === "moderator" ? "موظف" : "زائر")}
                      </div>
                      {m.attachment_url ? (
                        isImage ? (
                          <a href={m.attachment_url} target="_blank" rel="noopener noreferrer">
                            <img src={m.attachment_url} alt={m.attachment_name ?? ""} className="rounded-lg max-h-56 w-auto border border-border/30 mb-1" loading="lazy" />
                          </a>
                        ) : (
                          <a href={m.attachment_url} target="_blank" rel="noopener noreferrer"
                             className={`flex items-center gap-2 rounded-md px-2 py-1.5 border mb-1 ${isMod ? "bg-white/15 border-white/20" : "bg-card border-border"}`}>
                            <FileText className="h-4 w-4 shrink-0" />
                            <span className="text-xs truncate underline">{m.attachment_name ?? "ملف"}</span>
                          </a>
                        )
                      ) : null}
                      {m.content && m.content !== m.attachment_name && (
                        <div className="whitespace-pre-wrap break-words">{m.content}</div>
                      )}
                      <div className="text-[9px] opacity-60 mt-1" dir="ltr">
                        {new Date(m.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                );
              })}
              {visitorTyping && (
                <div className="flex justify-start">
                  <div className="bg-secondary text-foreground rounded-2xl px-3 py-2 text-sm inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); send(); }}
              className="border-t p-3 flex gap-2"
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,application/pdf,.doc,.docx,.zip,.txt"
                onChange={onPickFile}
              />
              <Button type="button" size="icon" variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || sending}
                aria-label="إرفاق ملف">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              </Button>
              <Input
                value={input}
                onChange={(e) => { setInput(e.target.value); broadcastTyping(); }}
                placeholder={active.status === "bot" ? "البوت يرد حالياً — اضغط استلام لو محتاج تتدخل" : "اكتب رسالتك..."}
                maxLength={2000}
                disabled={sending}
                autoFocus
              />
              <Button type="submit" disabled={sending || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </>
        )}
      </Card>

      <Dialog open={closeOpen} onOpenChange={(o) => !closing && setCloseOpen(o)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إنهاء المحادثة كمحلولة</DialogTitle>
            <DialogDescription>
              اكتب سبب مختصر للإنهاء (هيظهر للزائر داخل الشات).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={closeReason}
            onChange={(e) => setCloseReason(e.target.value)}
            placeholder="مثال: تم الرد على استفسار الكورس وإرسال رابط الدفع."
            maxLength={500}
            rows={4}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)} disabled={closing}>إلغاء</Button>
            <Button onClick={confirmClose} disabled={closing || closeReason.trim().length < 2}>
              <CheckCircle2 className="h-4 w-4 ml-1" /> تأكيد الإنهاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
