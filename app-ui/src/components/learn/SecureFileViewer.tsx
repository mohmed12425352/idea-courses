import { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EyeOff, Loader2, Maximize2, Minimize2, Download, FileText, Code2, BookOpen, Shield, AlertCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const PdfCanvasViewer = lazy(() =>
  import("./PdfCanvasViewer").then((m) => ({ default: m.PdfCanvasViewer }))
);

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  signedUrl: string | null;
  fileName?: string | null;
  title?: string | null;
  watermark?: string | null; // user email/name overlay
  allowDownload?: boolean;
};

function detectKind(url: string, name?: string | null): "pdf" | "image" | "text" | "other" {
  const s = ((name || "") + " " + url).toLowerCase();
  if (/\.pdf(\?|$|#)/.test(s)) return "pdf";
  if (/\.(png|jpe?g|gif|webp|bmp|svg|avif)(\?|$|#)/.test(s)) return "image";
  if (/\.(txt|md|markdown|json|js|ts|tsx|jsx|html|css|scss|xml|yaml|yml|sql|py|sh|bat|ini|env|csv|log|rtf|c|cpp|cs|php|java|rb|go|rs)(\?|$|#)/.test(s)) return "text";
  return "other";
}

function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.substring(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(<strong key={match.index} className="text-yellow-400 font-bold">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(<em key={match.index} className="italic text-slate-300">{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code key={match.index} className="px-1.5 py-0.5 rounded bg-[#070b14] border border-slate-700/60 text-amber-300 font-mono text-[11px]">
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < text.length) {
    parts.push(text.substring(lastIdx));
  }
  return parts.length ? parts : [text];
}

function FormattedTextViewer({ content, fileName }: { content: string; fileName?: string | null }) {
  const { isEn } = useI18n();
  const isMd = useMemo(() => {
    const fn = (fileName || "").toLowerCase();
    return fn.endsWith(".md") || fn.endsWith(".markdown") || content.includes("# ") || content.includes("```");
  }, [fileName, content]);

  const [mode, setMode] = useState<"formatted" | "raw">(isMd ? "formatted" : "raw");
  const lines = useMemo(() => content.split("\n"), [content]);

  if (mode === "raw") {
    return (
      <div className="flex flex-col h-full bg-[#080d1a] select-none text-right" dir="auto">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-[#0d1527] text-xs text-slate-400 shrink-0">
          <span className="font-mono text-[11px] text-slate-400">
            {lines.length} {isEn ? "lines" : "أسطر"} • {content.length} {isEn ? "chars" : "حرف"}
          </span>
          {isMd && (
            <button
              type="button"
              onClick={() => setMode("formatted")}
              className="inline-flex items-center gap-1.5 text-xs bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2.5 py-1 rounded-md font-semibold transition-all"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{isEn ? "Formatted View" : "عرض منسق"}</span>
            </button>
          )}
        </div>
        <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-200">
          <pre className="table w-full">
            {lines.map((line, idx) => (
              <div key={idx} className="table-row hover:bg-slate-800/40">
                <span className="table-cell select-none pr-4 text-slate-600 text-left w-10 text-[11px] font-mono border-r border-slate-800/60">
                  {idx + 1}
                </span>
                <span className="table-cell whitespace-pre-wrap break-all px-3">
                  {line || "\u00A0"}
                </span>
              </div>
            ))}
          </pre>
        </div>
      </div>
    );
  }

  // Parse markdown blocks
  const blocks: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeBlockLang = "";

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        blocks.push(
          <div key={`code-${i}`} className="my-3 rounded-xl overflow-hidden border border-slate-800 bg-[#070b14] text-left" dir="ltr">
            {codeBlockLang && (
              <div className="px-3 py-1 bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                {codeBlockLang}
              </div>
            )}
            <pre className="p-3 text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {codeBlockLines.join("\n")}
            </pre>
          </div>
        );
        inCodeBlock = false;
        codeBlockLines = [];
        codeBlockLang = "";
      } else {
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    if (!trimmed) {
      blocks.push(<div key={`empty-${i}`} className="h-2" />);
      continue;
    }

    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h3 key={i} className="text-sm md:text-base font-bold text-yellow-400 mt-4 mb-2 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-yellow-500 rounded-full shrink-0" />
          {parseInline(trimmed.slice(4))}
        </h3>
      );
    } else if (trimmed.startsWith("## ")) {
      blocks.push(
        <h2 key={i} className="text-base md:text-lg font-extrabold text-white mt-5 mb-2 pb-1 border-b border-slate-800 flex items-center gap-2">
          <span className="w-2 h-5 bg-yellow-500 rounded-full shrink-0" />
          {parseInline(trimmed.slice(3))}
        </h2>
      );
    } else if (trimmed.startsWith("# ")) {
      blocks.push(
        <h1 key={i} className="text-lg md:text-xl font-black text-yellow-400 mt-6 mb-3 pb-2 border-b-2 border-yellow-500/30 flex items-center gap-2.5">
          {parseInline(trimmed.slice(2))}
        </h1>
      );
    } else if (trimmed.startsWith("> ")) {
      blocks.push(
        <blockquote key={i} className="border-r-4 border-yellow-500 bg-yellow-500/5 px-4 py-2 my-2 rounded-l-lg text-slate-300 text-xs italic">
          {parseInline(trimmed.slice(2))}
        </blockquote>
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      blocks.push(
        <div key={i} className="flex items-start gap-2 my-1 text-xs text-slate-200 pr-2">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-1.5 shrink-0" />
          <span className="flex-1 leading-relaxed">{parseInline(trimmed.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s(.*)$/);
      blocks.push(
        <div key={i} className="flex items-start gap-2 my-1 text-xs text-slate-200 pr-2">
          <span className="text-[11px] font-bold text-yellow-500 min-w-4 text-right shrink-0">{match ? match[1] : ""}.</span>
          <span className="flex-1 leading-relaxed">{parseInline(match ? match[2] : trimmed)}</span>
        </div>
      );
    } else if (trimmed === "---" || trimmed === "***") {
      blocks.push(<hr key={i} className="border-slate-800 my-4" />);
    } else {
      blocks.push(
        <p key={i} className="text-xs md:text-sm text-slate-200 leading-relaxed my-1.5">
          {parseInline(rawLine)}
        </p>
      );
    }
  }

  if (inCodeBlock && codeBlockLines.length) {
    blocks.push(
      <div key="code-end" className="my-3 rounded-xl overflow-hidden border border-slate-800 bg-[#070b14] text-left" dir="ltr">
        <pre className="p-3 text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
          {codeBlockLines.join("\n")}
        </pre>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0f1d] select-none text-right" dir="auto">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-[#0d1527] text-xs text-slate-400 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-slate-300">{isEn ? "Formatted Markdown Preview" : "معاينة منسقة (Markdown)"}</span>
        </div>
        <button
          type="button"
          onClick={() => setMode("raw")}
          className="inline-flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-md font-semibold transition-all"
        >
          <Code2 className="w-3.5 h-3.5 text-yellow-400" />
          <span>{isEn ? "Raw Text / Code" : "عرض النص الخام / كود"}</span>
        </button>
      </div>
      <div className="flex-1 overflow-auto p-5 md:p-6 space-y-1">
        {blocks}
      </div>
    </div>
  );
}

export function SecureFileViewer({ open, onOpenChange, signedUrl, fileName, title, watermark, allowDownload = false }: Props) {
  const { isEn, dir } = useI18n();
  const kind = useMemo(() => (signedUrl ? detectKind(signedUrl, fileName) : "other"), [signedUrl, fileName]);
  const [hidden, setHidden] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFs, setIsFs] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  // Fetch PDF as blob or Text as string
  useEffect(() => {
    setBlobUrl(null);
    setTextContent(null);
    setLoadError(null);
    setLoadingContent(false);

    if (!open || !signedUrl) return;

    let cancelled = false;
    let createdUrl: string | null = null;

    if (kind === "pdf") {
      setLoadingContent(true);
      (async () => {
        try {
          const res = await fetch(signedUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buf = await res.blob();
          const pdfBlob = buf.type === "application/pdf" ? buf : new Blob([buf], { type: "application/pdf" });
          createdUrl = URL.createObjectURL(pdfBlob);
          if (!cancelled) {
            setBlobUrl(createdUrl);
            setLoadingContent(false);
          }
        } catch (e) {
          if (!cancelled) {
            setLoadError(e instanceof Error ? e.message : (isEn ? "Failed to load file" : "فشل تحميل الملف"));
            setLoadingContent(false);
          }
        }
      })();
    } else if (kind === "text") {
      setLoadingContent(true);
      (async () => {
        try {
          const res = await fetch(signedUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const text = await res.text();
          if (!cancelled) {
            setTextContent(text);
            setLoadingContent(false);
          }
        } catch (e) {
          if (!cancelled) {
            setLoadError(e instanceof Error ? e.message : (isEn ? "Failed to load text file" : "فشل تحميل محتوى الملف"));
            setLoadingContent(false);
          }
        }
      })();
    }

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [open, signedUrl, kind, isEn]);

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch { /* noop */ }
  };

  // Hide content when tab/window loses focus — best-effort anti-screenshot
  useEffect(() => {
    if (!open) return;
    const onVis = () => setHidden(document.visibilityState !== "visible");
    const onBlur = () => setHidden(true);
    const onFocus = () => setHidden(document.visibilityState !== "visible");
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [open]);

  // Block common shortcuts: Ctrl/Cmd+S, Ctrl+P, PrintScreen
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (k === "s" || k === "p" || k === "u")) {
        e.preventDefault();
        setHidden(true);
        setTimeout(() => setHidden(document.visibilityState !== "visible"), 1500);
      }
      if (k === "printscreen") {
        try { navigator.clipboard.writeText(""); } catch { /* noop */ }
        setHidden(true);
        setTimeout(() => setHidden(document.visibilityState !== "visible"), 1500);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Block browser print (Ctrl/Cmd+P, menu Print) while viewer is open
  useEffect(() => {
    if (!open) return;
    const onBeforePrint = (e: Event) => {
      e.preventDefault?.();
      setHidden(true);
    };
    const onAfterPrint = () => setHidden(document.visibilityState !== "visible");
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);

    const style = document.createElement("style");
    style.setAttribute("data-secure-viewer-print", "1");
    style.textContent = `@media print { html, body { display: none !important; visibility: hidden !important; } }`;
    document.head.appendChild(style);

    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
      style.remove();
    };
  }, [open]);

  const noSelect: React.CSSProperties = {
    userSelect: "none",
    WebkitUserSelect: "none",
    WebkitTouchCallout: "none",
    // @ts-expect-error vendor
    WebkitUserDrag: "none",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden bg-[#0B1220] border-slate-800" dir={dir}>
        <DialogHeader className="px-5 pt-4 pb-2 flex flex-row items-center justify-between gap-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 flex items-center justify-center shrink-0">
              {kind === "text" ? <FileText className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className={`text-slate-100 text-sm md:text-base font-bold truncate ${dir === "rtl" ? "text-right" : "text-left"}`}>
                {title || fileName || (isEn ? "File Preview" : "معاينة الملف")}
              </DialogTitle>
              {fileName && title && fileName !== title && (
                <p className="text-[11px] text-slate-400 truncate">{fileName}</p>
              )}
            </div>
          </div>

          {allowDownload && signedUrl && (
            <a
              href={signedUrl}
              download={fileName || "download"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition-all shadow-sm active:scale-95 shrink-0 ml-4"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isEn ? "Download" : "تحميل"}</span>
            </a>
          )}
        </DialogHeader>

        <div
          ref={containerRef}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          onCopy={(e) => e.preventDefault()}
          style={noSelect}
          className="relative w-full bg-black"
        >
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFs ? (isEn ? "Exit fullscreen" : "خروج من ملء الشاشة") : (isEn ? "Fullscreen" : "ملء الشاشة")}
            className="absolute top-2 left-2 z-30 rounded-md bg-black/60 hover:bg-black/80 text-white p-2 backdrop-blur-sm"
          >
            {isFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <div className="relative w-full" style={{ height: isFs ? "100vh" : "min(78vh, 900px)" }}>
            {(!signedUrl || loadingContent) && (
              <div className="absolute inset-0 grid place-items-center text-slate-300">
                <Loader2 className="h-7 w-7 animate-spin text-yellow-500" />
              </div>
            )}

            {signedUrl && kind === "pdf" && (
              <Suspense
                fallback={
                  <div className="w-full h-full min-h-[300px] grid place-items-center text-slate-300">
                    <Loader2 className="h-8 w-8 animate-spin text-gold" />
                  </div>
                }
              >
                {!blobUrl && !loadError && (
                  <div className="absolute inset-0 grid place-items-center text-slate-300">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                )}
                {loadError && (
                  <PdfCanvasViewer url={signedUrl} className="w-full h-full overflow-auto bg-neutral-100 p-4" />
                )}
                {blobUrl && (
                  <PdfCanvasViewer url={blobUrl} className="w-full h-full overflow-auto bg-neutral-100 p-4" />
                )}
              </Suspense>
            )}

            {signedUrl && kind === "image" && (
              <div className="w-full h-full overflow-auto flex items-center justify-center bg-black">
                <img
                  src={signedUrl}
                  alt={title || fileName || ""}
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  style={noSelect}
                  className="max-w-full max-h-full object-contain pointer-events-none"
                />
              </div>
            )}

            {signedUrl && kind === "text" && !loadingContent && (
              <div className="w-full h-full overflow-hidden">
                {loadError ? (
                  <div className="h-full flex items-center justify-center text-red-400 p-6 text-center text-sm">
                    <AlertCircle className="w-5 h-5 ml-2 shrink-0" />
                    <span>{loadError}</span>
                  </div>
                ) : (
                  <FormattedTextViewer content={textContent ?? ""} fileName={fileName} />
                )}
              </div>
            )}

            {signedUrl && kind === "other" && (
              <div className="absolute inset-0 grid place-items-center text-slate-300 text-center p-6">
                <div className="bg-[#161e2d] border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                  <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 flex items-center justify-center mx-auto shadow-inner">
                    <FileText className="h-7 w-7" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white mb-1.5 truncate px-2">{fileName || title || (isEn ? "Attached File" : "ملف مرفق")}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {allowDownload
                        ? (isEn
                            ? "This file format is ready for direct download to use on your computer."
                            : "هذا الملف جاهز للتحميل المباشر على جهازك لاستخدامه في البرامج والتطبيقات المخصصة.")
                        : (isEn
                            ? "This file is protected (View Only). This format cannot be previewed in the browser directly."
                            : "هذا الملف محمي للمعاينة فقط. هذه الصيغة غير قابلة للعرض المباشر في المتصفح ومحمية ضد التنزيل.")}
                    </p>
                  </div>
                  {allowDownload ? (
                    <a
                      href={signedUrl}
                      download={fileName || "download"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-yellow-500/20 active:scale-95"
                    >
                      <Download className="h-4 w-4" />
                      <span>{isEn ? "Download File Now" : "تحميل الملف الآن"}</span>
                    </a>
                  ) : (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-amber-300 text-xs font-semibold flex items-center justify-center gap-2">
                      <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{isEn ? "Protected by instructor" : "محمي من قِبل المحاضر (معاينة فقط)"}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Watermark overlay — tiled, low opacity, blocks clicks */}
            {signedUrl && watermark && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 overflow-hidden select-none"
                style={{
                  backgroundImage:
                    `repeating-linear-gradient(-30deg, transparent 0 120px, rgba(0,0,0,0) 120px 121px)`,
                }}
              >
                <div
                  className="absolute inset-0 flex flex-wrap content-around justify-around opacity-30 text-[11px] font-bold text-white mix-blend-difference"
                  style={{ transform: "rotate(-30deg)", padding: 40 }}
                >
                  {Array.from({ length: 40 }).map((_, i) => (
                    <span key={i} className="whitespace-nowrap px-6 py-2">
                      {watermark}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Privacy shield when tab hidden or window blurred */}
            {hidden && (
              <div className="absolute inset-0 bg-black/95 grid place-items-center text-slate-300 gap-2 z-20">
                <EyeOff className="h-8 w-8" />
                <div className="text-sm">{isEn ? "Preview paused temporarily to protect content" : "المعاينة موقوفة مؤقتاً لحماية المحتوى"}</div>
              </div>
            )}
          </div>

          <div className="px-4 py-2 text-[11px] text-slate-400 text-center border-t border-slate-800">
            {allowDownload
              ? (isEn ? "File downloaded via Edunova Academy" : "الملف متاح للتحميل والدراسة — منصة فكرة ديزاين")
              : (isEn
                  ? "Protected content — Downloading, printing and copying are prohibited. Any screen recording attempt is logged."
                  : "محتوى محمي — التنزيل والطباعة والنسخ غير مسموح. أي محاولة تصوير للشاشة مسجَّلة باسم حسابك.")}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}