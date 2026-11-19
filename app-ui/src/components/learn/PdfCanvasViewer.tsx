import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
// Vite serves the worker from node_modules with a stable URL.
// Using .mjs matches pdfjs-dist v6.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - vite handles ?url
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

type Props = {
  url: string;
  className?: string;
};

/**
 * Renders a PDF entirely on the client with pdf.js — no <iframe>, so it works
 * consistently in Chrome / Firefox / Safari even when the source URL has
 * headers (Content-Disposition: attachment, X-Frame-Options, etc.) that
 * would otherwise block inline preview.
 */
export function PdfCanvasViewer({ url, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";
    setLoading(true);
    setError(null);
    setNumPages(0);

    (async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({ url, withCredentials: false });
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        setNumPages(pdf.numPages);

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const containerWidth = container.clientWidth || 800;

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1 });
          const scale = (containerWidth / viewport.width) * 1.0;
          const scaledViewport = page.getViewport({ scale: scale * dpr });

          const canvas = document.createElement("canvas");
          canvas.width = scaledViewport.width;
          canvas.height = scaledViewport.height;
          canvas.style.width = `${scaledViewport.width / dpr}px`;
          canvas.style.height = `${scaledViewport.height / dpr}px`;
          canvas.style.display = "block";
          canvas.style.margin = "0 auto 12px";
          canvas.style.background = "#fff";
          canvas.style.boxShadow = "0 1px 3px rgba(0,0,0,0.3)";
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          container.appendChild(canvas);
          await page.render({ canvasContext: ctx, viewport: scaledViewport, canvas }).promise;
        }
        if (!cancelled) setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "فشل تحميل الملف");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className={className ?? "w-full h-full overflow-auto bg-neutral-100 p-4"}>
      {loading && (
        <div className="absolute inset-0 grid place-items-center text-slate-300 pointer-events-none">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}
      {error && (
        <div className="text-center text-slate-600 p-6">تعذّر عرض الملف: {error}</div>
      )}
      <div ref={containerRef} />
      {!loading && !error && numPages > 0 && (
        <div className="text-center text-[11px] text-slate-500 mt-2">
          {numPages} صفحة
        </div>
      )}
    </div>
  );
}