import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Pipette, QrCode } from "lucide-react";
import { toast } from "sonner";

export type CertState = {
  template_url: string;
  name_x: number | string;
  name_y: number | string;
  name_size: number | string;
  name_color: string;
  date_x: number | string;
  date_y: number | string;
  date_size: number | string;
  date_color: string;
  date_format: string;
  name_font: string;
  date_font: string;
  // Course title
  course_x: number | string;
  course_y: number | string;
  course_size: number | string;
  course_color: string;
  course_font: string;
  show_course: boolean;
  // Cert ID
  certid_x: number | string;
  certid_y: number | string;
  certid_size: number | string;
  certid_color: string;
  certid_font: string;
  show_certid: boolean;
  // QR
  qr_x: number | string;
  qr_y: number | string;
  qr_size: number | string;
  show_qr: boolean;
  show_name?: boolean;
};

export const ARABIC_FONTS = [
  { value: "", label: "افتراضي (Cairo)" },
  { value: "Cairo", label: "Cairo — كايرو" },
  { value: "Tajawal", label: "Tajawal — تجوال" },
  { value: "Almarai", label: "Almarai — المرعى" },
  { value: "Amiri", label: "Amiri — أميري (تقليدي)" },
  { value: "Reem Kufi", label: "Reem Kufi — ريم كوفي" },
  { value: "Markazi Text", label: "Markazi Text — مركزي" },
  { value: "Aref Ruqaa", label: "Aref Ruqaa — عارف رقعة" },
  { value: "Noto Naskh Arabic", label: "Noto Naskh — نسخ" },
  { value: "Lateef", label: "Lateef — لطيف" },
  { value: "Scheherazade New", label: "Scheherazade — شهرزاد" },
];

export function CertificatePositionEditor({
  cert,
  setCert,
}: {
  cert: CertState;
  setCert: (c: CertState) => void;
}) {
  // Lazy-load wide Arabic font set only when the cert editor is open.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "cert-arabic-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Almarai:wght@400;700;800&family=Amiri:wght@400;700&family=Reem+Kufi:wght@400;500;600;700&family=Markazi+Text:wght@400;500;600;700&family=Aref+Ruqaa:wght@400;700&family=Noto+Naskh+Arabic:wght@400;500;700&family=Lateef&family=Scheherazade+New:wght@400;700&display=swap";
    document.head.appendChild(link);
  }, []);

  type ElKind = "name" | "date" | "course" | "qr";
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<ElKind | null>(null);
  const pickCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imgDim, setImgDim] = useState<{ w: number; h: number } | null>(null);
  const [dragging, setDragging] = useState<ElKind | null>(null);
  const [pickingFor, setPickingFor] = useState<"name" | "date" | "course" | null>(null);

  const round = (v: number) => Math.round(v * 1000) / 1000;

  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

  const clampRange = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

  const keepInsideStyle = (fx: number, fy: number, insetX = 48, insetY = 24): React.CSSProperties => ({
    left: `clamp(${insetX}px, ${fx * 100}%, calc(100% - ${insetX}px))`,
    top: `clamp(${insetY}px, ${fy * 100}%, calc(100% - ${insetY}px))`,
  });

  const toFrac = (v: number | string, fallback: number, axis: "w" | "h") => {
    if (v === "" || v === null || v === undefined) return fallback;
    const n = Number(v);
    if (!isFinite(n)) return fallback;
    if (n > 1 && !imgDim) return fallback;
    if (n > 1 && imgDim) return clamp01(n / (axis === "w" ? imgDim.w : imgDim.h));
    return clamp01(n);
  };
  const toSizeFrac = (v: number | string, fallback: number) => {
    if (v === "" || v === null || v === undefined) return fallback;
    const n = Number(v);
    if (!isFinite(n)) return fallback;
    if (n > 1 && imgDim) return n / imgDim.h;
    return n;
  };

  const nameFx = toFrac(cert.name_x, 0.5, "w");
  const nameFy = toFrac(cert.name_y, 0.376, "h");
  const dateFx = toFrac(cert.date_x, 0.716, "w");
  const dateFy = toFrac(cert.date_y, 0.884, "h");
  const nameSizeFrac = toSizeFrac(cert.name_size, 0.0664);
  const dateSizeFrac = toSizeFrac(cert.date_size, 0.0254);
  const courseFx = toFrac(cert.course_x, 0.5, "w");
  const courseFy = toFrac(cert.course_y, 0.574, "h");
  const courseSizeFrac = toSizeFrac(cert.course_size, 0.043);
  const qrFx = toFrac(cert.qr_x, 0.892, "w");
  const qrFy = toFrac(cert.qr_y, 0.825, "h");
  const qrSizeFrac = toSizeFrac(cert.qr_size, 0.132);

  useEffect(() => {
    const safeNameX = round(clampRange(nameFx, 0.1, 0.9));
    // Keep the name pin in the upper-middle band of the certificate
    // so it never drifts below the visible template area.
    const safeNameY = round(clampRange(nameFy, 0.2, 0.75));
    if (safeNameX !== nameFx || safeNameY !== nameFy) {
      setCert({ ...cert, name_x: safeNameX, name_y: safeNameY });
    }
  }, [nameFx, nameFy]);

  const updateDragPosition = (e: React.PointerEvent, which = dragRef.current) => {
    if (!which || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const minX = which === "name" ? 0.1 : 0;
    const maxX = which === "name" ? 0.9 : 1;
    const minY = which === "name" ? 0.2 : 0;
    const maxY = which === "name" ? 0.75 : 1;
    const x = clampRange((e.clientX - rect.left) / rect.width, minX, maxX);
    const y = clampRange((e.clientY - rect.top) / rect.height, minY, maxY);
    const rx = round(x);
    const ry = round(y);
    if (which === "name") setCert({ ...cert, name_x: rx, name_y: ry });
    else if (which === "date") setCert({ ...cert, date_x: rx, date_y: ry });
    else if (which === "course") setCert({ ...cert, course_x: rx, course_y: ry });
    else if (which === "qr") setCert({ ...cert, qr_x: rx, qr_y: ry });
  };

  const onPointerDown = (which: ElKind) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = which;
    setDragging(which);
    updateDragPosition(e, which);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.preventDefault();
    updateDragPosition(e);
  };
  const onPointerUp = () => {
    dragRef.current = null;
    setDragging(null);
  };

  const ensurePickCanvas = () => {
    if (pickCanvasRef.current || !cert.template_url) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      pickCanvasRef.current = c;
    };
    img.onerror = () => {};
    img.src = cert.template_url;
  };

  const handlePickClick = (e: React.MouseEvent) => {
    if (!pickingFor || !imgRef.current) return;
    const canvas = pickCanvasRef.current;
    if (!canvas) {
      ensurePickCanvas();
      return;
    }
    const rect = imgRef.current.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    const x = Math.floor(Math.min(0.9999, Math.max(0, fx)) * canvas.width);
    const y = Math.floor(Math.min(0.9999, Math.max(0, fy)) * canvas.height);
    try {
      const ctx = canvas.getContext("2d")!;
      const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
      const hex = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
      if (pickingFor === "name") setCert({ ...cert, name_color: hex });
      else if (pickingFor === "date") setCert({ ...cert, date_color: hex });
      else if (pickingFor === "course") setCert({ ...cert, course_color: hex });
      toast.success(`تم اختيار اللون ${hex}`);
    } catch {
      toast.error("تعذّر قراءة اللون من الصورة (حماية CORS). استخدم منتقي الألوان اليدوي.");
    }
    setPickingFor(null);
  };

  const startPicking = (which: "name" | "date" | "course") => {
    ensurePickCanvas();
    setPickingFor(which);
  };

  const sampleDate = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        className={`relative w-full max-w-2xl mx-auto rounded-md border bg-muted select-none touch-none ${pickingFor ? "ring-4 ring-primary cursor-crosshair" : ""}`}
        style={{ containerType: "size" } as React.CSSProperties}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={handlePickClick}
      >
        <img
          ref={imgRef}
          src={cert.template_url}
          alt="قالب الشهادة"
          className="w-full h-auto block pointer-events-none rounded-md"
          onLoad={(e) => {
            const el = e.currentTarget;
            setImgDim({ w: el.naturalWidth, h: el.naturalHeight });
            ensurePickCanvas();
          }}
        />
        {pickingFor && (
          <div className="absolute inset-x-0 top-0 z-[95] bg-primary text-primary-foreground text-center text-xs font-bold py-2 pointer-events-none">
            🎯 اضغط على أي مكان في الشهادة لاختيار لون «{pickingFor === "name" ? "الاسم" : pickingFor === "date" ? "التاريخ" : "عنوان الكورس"}»
          </div>
        )}
        <div className="absolute left-3 top-3 z-[80] flex flex-col gap-2 text-xs font-bold pointer-events-none">
          <span className="rounded-full bg-red-600 px-3 py-1 text-white shadow-[0_4px_16px_rgba(0,0,0,0.45)] ring-2 ring-white">اسحب علامة الاسم</span>
          <span className="rounded-full bg-yellow-400 px-3 py-1 text-black shadow-[0_4px_16px_rgba(0,0,0,0.45)] ring-2 ring-white">اسحب علامة التاريخ</span>
          {cert.show_qr !== false && (
            <span className="rounded-full bg-slate-700 px-3 py-1 text-white shadow-[0_4px_16px_rgba(0,0,0,0.45)] ring-2 ring-white">اسحب علامة الباركود</span>
          )}
        </div>

        {/* Name label + drag pin */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 px-3 py-1 rounded-md ring-2 ring-primary/70 bg-white/95 backdrop-blur whitespace-nowrap font-bold pointer-events-none z-20"
          style={{
            ...keepInsideStyle(nameFx, nameFy, 58, 26),
            color: cert.name_color || "#1a1a1a",
            fontSize: `${nameSizeFrac * 100}cqh`,
            fontFamily: cert.name_font ? `'${cert.name_font}', 'Cairo', sans-serif` : undefined,
            maxWidth: "calc(100% - 24px)",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          اسم الطالب
        </div>
        <div
          onPointerDown={onPointerDown("name")}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          title="اسحبني لتحديد موضع الاسم"
          className={`absolute -translate-x-1/2 -translate-y-1/2 h-11 min-w-24 rounded-full shadow-xl flex items-center justify-center gap-1 px-3 text-white text-sm font-black ${dragging === "name" ? "scale-125 cursor-grabbing" : "cursor-grab hover:scale-110"} transition-transform`}
          style={{
            ...keepInsideStyle(nameFx, nameFy, 58, 26),
            touchAction: "none",
            zIndex: 90,
            background: "#ef4444",
            border: "3px solid #ffffff",
            boxShadow: "0 0 0 3px #ef4444, 0 8px 24px rgba(0,0,0,0.65)",
          }}
        >
          ↕ الاسم
        </div>
        {/* Date label + drag pin */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded-md ring-2 ring-gold/80 bg-white/95 backdrop-blur whitespace-nowrap font-bold pointer-events-none z-20"
          style={{
            left: `${dateFx * 100}%`,
            top: `${dateFy * 100}%`,
            color: cert.date_color || "#333333",
            fontSize: `${dateSizeFrac * 100}cqh`,
            fontFamily: cert.date_font ? `'${cert.date_font}', 'Cairo', sans-serif` : undefined,
          }}
        >
          {sampleDate}
        </div>
        <div
          onPointerDown={onPointerDown("date")}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          title="اسحبني لتحديد موضع التاريخ"
          className={`absolute -translate-x-1/2 -translate-y-1/2 h-11 min-w-24 rounded-full shadow-xl flex items-center justify-center gap-1 px-3 text-black text-sm font-black ${dragging === "date" ? "scale-125 cursor-grabbing" : "cursor-grab hover:scale-110"} transition-transform`}
          style={{
            left: `${dateFx * 100}%`,
            top: `${dateFy * 100}%`,
            touchAction: "none",
            zIndex: 90,
            background: "#eab308",
            border: "3px solid #ffffff",
            boxShadow: "0 0 0 3px #eab308, 0 8px 24px rgba(0,0,0,0.65)",
          }}
        >
          ↕ التاريخ
        </div>
        {/* Course title pin */}
        {cert.show_course !== false && (
          <>
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded-md ring-2 ring-blue-500/70 bg-white/95 backdrop-blur whitespace-nowrap font-bold pointer-events-none z-20"
              style={{
                left: `${courseFx * 100}%`,
                top: `${courseFy * 100}%`,
                color: cert.course_color || "#B0202E",
                fontSize: `${courseSizeFrac * 100}cqh`,
                fontFamily: cert.course_font ? `'${cert.course_font}', 'Cairo', sans-serif` : undefined,
              }}
            >
              عنوان الكورس
            </div>
            <div
              onPointerDown={onPointerDown("course")}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className={`absolute -translate-x-1/2 -translate-y-1/2 h-10 min-w-24 rounded-full shadow-xl flex items-center justify-center px-3 text-white text-xs font-black ${dragging === "course" ? "scale-125 cursor-grabbing" : "cursor-grab hover:scale-110"} transition-transform`}
              style={{ left: `${courseFx * 100}%`, top: `${courseFy * 100}%`, touchAction: "none", zIndex: 90, background: "#3b82f6", border: "3px solid #fff", boxShadow: "0 0 0 3px #3b82f6, 0 8px 24px rgba(0,0,0,0.6)" }}
            >↕ الكورس</div>
          </>
        )}
        {/* QR pin */}
        {cert.show_qr !== false && (
          <div
            onPointerDown={onPointerDown("qr")}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            title="اسحبني لتحديد موضع الباركود"
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full shadow-xl flex items-center justify-center px-2 py-1 text-white text-xs font-black ${dragging === "qr" ? "scale-125 cursor-grabbing" : "cursor-grab hover:scale-110"} transition-transform`}
            style={{
              left: `${qrFx * 100}%`,
              top: `${qrFy * 100}%`,
              touchAction: "none",
              zIndex: 90,
              background: "#0f172a",
              border: "3px solid #fff",
              boxShadow: "0 0 0 3px #0f172a, 0 8px 24px rgba(0,0,0,0.6)",
            }}
          >
            <QrCode className="w-4 h-4" />
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        اسحب المقبض الأحمر المكتوب عليه الاسم أو الأصفر المكتوب عليه التاريخ فوق الشهادة. القيم تتحدّث تلقائيًا.
      </p>

      <div className="rounded-md border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="font-semibold">تاريخ الإتمام</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={pickingFor === "date" ? "default" : "outline"}
              size="sm"
              onClick={() => startPicking("date")}
              title="اسحب لون من الشهادة"
              className="h-8 px-2"
            >
              <Pipette className="h-4 w-4" />
            </Button>
            <input
              type="color"
              value={cert.date_color || "#333333"}
              onChange={(e) => setCert({ ...cert, date_color: e.target.value })}
              className="h-9 w-14 rounded-md border-2 border-border cursor-pointer p-0"
              style={{ background: cert.date_color || "#333333" }}
              title="اختر لون التاريخ"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">نوع الخط</Label>
          <select
            className="w-full h-9 rounded-md border bg-background px-2 text-sm"
            value={cert.date_font || ""}
            onChange={(e) => setCert({ ...cert, date_font: e.target.value })}
            style={{ fontFamily: cert.date_font ? `'${cert.date_font}', 'Cairo', sans-serif` : undefined }}
          >
            {ARABIC_FONTS.map((f) => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value ? `'${f.value}', sans-serif` : undefined }}>{f.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">حجم خط التاريخ: {Math.round(dateSizeFrac * 1000) / 10}% من ارتفاع الصورة</Label>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-9 w-9 p-0 text-lg font-bold"
              onClick={() => setCert({ ...cert, date_size: round(Math.max(0.003, dateSizeFrac - 0.003)) })}>−</Button>
            <input
              type="range"
              min={0.3}
              max={20}
              step={0.1}
              value={dateSizeFrac * 100}
              onChange={(e) => setCert({ ...cert, date_size: round(Number(e.target.value) / 100) })}
              className="flex-1"
            />
            <Button type="button" variant="outline" size="sm" className="h-9 w-9 p-0 text-lg font-bold"
              onClick={() => setCert({ ...cert, date_size: round(Math.min(0.5, dateSizeFrac + 0.003)) })}>+</Button>
            <Input type="number" step="0.1" min={0.3} max={50}
              value={Number.isFinite(dateSizeFrac) ? Math.round(dateSizeFrac * 1000) / 10 : 2.5}
              onChange={(e) => setCert({ ...cert, date_size: round(Number(e.target.value) / 100) })}
              className="w-20 h-9 text-center" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">X (0-1)</Label>
            <Input type="number" step="0.001" value={cert.date_x} onChange={(e) => setCert({ ...cert, date_x: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Y (0-1)</Label>
            <Input type="number" step="0.001" value={cert.date_y} onChange={(e) => setCert({ ...cert, date_y: e.target.value })} />
          </div>
        </div>
        <div>
          <Label className="text-xs">تنسيق التاريخ</Label>
          <select
            className="w-full h-9 rounded-md border bg-background px-2 text-sm"
            value={cert.date_format}
            onChange={(e) => setCert({ ...cert, date_format: e.target.value })}
          >
            <option value="">افتراضي القالب</option>
            <option value="full">تاريخ كامل (10 May 2026)</option>
            <option value="day-month">يوم / شهر فقط (10 / 05)</option>
          </select>
        </div>

        {/* Quick access: name size + both colors right under date controls */}
        <div className="mt-2 rounded-md border-2 border-dashed border-primary/40 bg-primary/5 p-3 space-y-3">
          <Label className="text-xs font-bold text-primary">⚡ تحكّم سريع</Label>

          <div>
            <Label className="text-xs">حجم خط الاسم: {Math.round(nameSizeFrac * 1000) / 10}%</Label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="h-9 w-9 p-0 text-lg font-bold"
                onClick={() => setCert({ ...cert, name_size: round(Math.max(0.005, nameSizeFrac - 0.005)) })}>−</Button>
              <input
                type="range" min={0.5} max={25} step={0.1}
                value={nameSizeFrac * 100}
                onChange={(e) => setCert({ ...cert, name_size: round(Number(e.target.value) / 100) })}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" className="h-9 w-9 p-0 text-lg font-bold"
                onClick={() => setCert({ ...cert, name_size: round(Math.min(0.5, nameSizeFrac + 0.005)) })}>+</Button>
              <Input type="number" step="0.1" min={0.5} max={50}
                value={Number.isFinite(nameSizeFrac) ? Math.round(nameSizeFrac * 1000) / 10 : 6}
                onChange={(e) => setCert({ ...cert, name_size: round(Number(e.target.value) / 100) })}
                className="w-20 h-9 text-center" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">لون الاسم</Label>
              <div className="flex items-center gap-2 mt-1">
                <Button type="button" variant={pickingFor === "name" ? "default" : "outline"} size="sm"
                  onClick={() => startPicking("name")} title="اسحب لون من الشهادة" className="h-9 px-2">
                  <Pipette className="h-4 w-4" />
                </Button>
                <input
                  type="color"
                  value={cert.name_color || "#1a1a1a"}
                  onChange={(e) => setCert({ ...cert, name_color: e.target.value })}
                  className="h-9 flex-1 rounded-md border-2 border-border cursor-pointer p-0"
                  style={{ background: cert.name_color || "#1a1a1a" }}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">لون التاريخ</Label>
              <div className="flex items-center gap-2 mt-1">
                <Button type="button" variant={pickingFor === "date" ? "default" : "outline"} size="sm"
                  onClick={() => startPicking("date")} title="اسحب لون من الشهادة" className="h-9 px-2">
                  <Pipette className="h-4 w-4" />
                </Button>
                <input
                  type="color"
                  value={cert.date_color || "#333333"}
                  onChange={(e) => setCert({ ...cert, date_color: e.target.value })}
                  className="h-9 flex-1 rounded-md border-2 border-border cursor-pointer p-0"
                  style={{ background: cert.date_color || "#333333" }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Student name settings (moved below date format for clarity) ===== */}
      <div className="rounded-md border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="font-semibold">اسم الطالب</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCert({ ...cert, name_x: 0.5, name_y: 0.55 })}
              className="h-8 px-2 text-xs"
              title="إعادة الزر لمنتصف الشهادة"
            >
              إعادة الموضع
            </Button>
            <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={cert.show_name !== false}
                onChange={(e) => setCert({ ...cert, show_name: e.target.checked })}
              />
              ظاهر
            </label>
            <Button
              type="button"
              variant={pickingFor === "name" ? "default" : "outline"}
              size="sm"
              onClick={() => startPicking("name")}
              title="اسحب لون من الشهادة"
              className="h-8 px-2"
            >
              <Pipette className="h-4 w-4" />
            </Button>
            <input
              type="color"
              value={cert.name_color || "#1a1a1a"}
              onChange={(e) => setCert({ ...cert, name_color: e.target.value })}
              className="h-9 w-14 rounded-md border-2 border-border cursor-pointer p-0"
              style={{ background: cert.name_color || "#1a1a1a" }}
              title="اختر لون الاسم"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">نوع الخط</Label>
          <select
            className="w-full h-9 rounded-md border bg-background px-2 text-sm"
            value={cert.name_font || ""}
            onChange={(e) => setCert({ ...cert, name_font: e.target.value })}
            style={{ fontFamily: cert.name_font ? `'${cert.name_font}', 'Cairo', sans-serif` : undefined }}
          >
            {ARABIC_FONTS.map((f) => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value ? `'${f.value}', sans-serif` : undefined }}>{f.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">حجم خط الاسم: {Math.round(nameSizeFrac * 1000) / 10}% من ارتفاع الصورة</Label>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-9 w-9 p-0 text-lg font-bold"
              onClick={() => setCert({ ...cert, name_size: round(Math.max(0.005, nameSizeFrac - 0.005)) })}>−</Button>
            <input
              type="range"
              min={0.5}
              max={25}
              step={0.1}
              value={nameSizeFrac * 100}
              onChange={(e) => setCert({ ...cert, name_size: round(Number(e.target.value) / 100) })}
              className="flex-1"
            />
            <Button type="button" variant="outline" size="sm" className="h-9 w-9 p-0 text-lg font-bold"
              onClick={() => setCert({ ...cert, name_size: round(Math.min(0.5, nameSizeFrac + 0.005)) })}>+</Button>
            <Input type="number" step="0.1" min={0.5} max={50}
              value={Number.isFinite(nameSizeFrac) ? Math.round(nameSizeFrac * 1000) / 10 : 6}
              onChange={(e) => setCert({ ...cert, name_size: round(Number(e.target.value) / 100) })}
              className="w-20 h-9 text-center" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">X (0-1)</Label>
            <Input type="number" step="0.001" value={cert.name_x} onChange={(e) => setCert({ ...cert, name_x: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Y (0-1)</Label>
            <Input type="number" step="0.001" value={cert.name_y} onChange={(e) => setCert({ ...cert, name_y: e.target.value })} />
          </div>
        </div>
      </div>

      {/* ===== Course title / Cert ID / QR settings ===== */}
      <ExtraElementCard
        title="عنوان الكورس"
        accent="#3b82f6"
        visible={cert.show_course !== false}
        onToggle={(v) => setCert({ ...cert, show_course: v })}
        x={cert.course_x} y={cert.course_y}
        onX={(v) => setCert({ ...cert, course_x: v })}
        onY={(v) => setCert({ ...cert, course_y: v })}
        sizeFrac={courseSizeFrac}
        onSize={(v) => setCert({ ...cert, course_size: round(v) })}
        color={cert.course_color || "#B0202E"}
        onColor={(v) => setCert({ ...cert, course_color: v })}
        font={cert.course_font}
        onFont={(v) => setCert({ ...cert, course_font: v })}
        startPicking={() => startPicking("course")}
        pickingActive={pickingFor === "course"}
      />

      {/* QR settings */}
      <ExtraElementCard
        title="باركود التحقق (QR)"
        accent="#0f172a"
        visible={cert.show_qr !== false}
        onToggle={(v) => setCert({ ...cert, show_qr: v })}
        x={cert.qr_x} y={cert.qr_y}
        onX={(v) => setCert({ ...cert, qr_x: v })}
        onY={(v) => setCert({ ...cert, qr_y: v })}
        sizeFrac={qrSizeFrac}
        onSize={(v) => setCert({ ...cert, qr_size: round(v) })}
        color="#0B1B3A"
        onColor={() => {}}
        font=""
        onFont={() => {}}
        startPicking={() => {}}
        pickingActive={false}
      />
    </div>
  );
}

function ExtraElementCard(props: {
  title: string; accent: string; visible: boolean; onToggle: (v: boolean) => void;
  x: number | string; y: number | string; onX: (v: string) => void; onY: (v: string) => void;
  sizeFrac: number; onSize: (v: number) => void;
  color: string; onColor: (v: string) => void;
  font: string; onFont: (v: string) => void;
  startPicking: () => void; pickingActive: boolean;
}) {
  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <Label className="font-semibold" style={{ color: props.accent }}>{props.title}</Label>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={props.visible}
              onChange={(e) => props.onToggle(e.target.checked)} />
            إظهار
          </label>
          <Button type="button" variant={props.pickingActive ? "default" : "outline"} size="sm"
            onClick={props.startPicking} className="h-8 px-2">
            <Pipette className="h-4 w-4" />
          </Button>
          <input type="color" value={props.color}
            onChange={(e) => props.onColor(e.target.value)}
            className="h-9 w-14 rounded-md border-2 cursor-pointer p-0" />
        </div>
      </div>
      <div>
        <Label className="text-xs">نوع الخط</Label>
        <select className="w-full h-9 rounded-md border bg-background px-2 text-sm"
          value={props.font || ""}
          onChange={(e) => props.onFont(e.target.value)}
          style={{ fontFamily: props.font ? `'${props.font}', 'Cairo', sans-serif` : undefined }}>
          {ARABIC_FONTS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>
      <div>
        <Label className="text-xs">الحجم: {Math.round(props.sizeFrac * 1000) / 10}%</Label>
        <input type="range" min={0.5} max={20} step={0.1}
          value={props.sizeFrac * 100}
          onChange={(e) => props.onSize(Number(e.target.value) / 100)}
          className="w-full" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">X (0-1)</Label>
          <Input type="number" step="0.001" value={props.x} onChange={(e) => props.onX(e.target.value)} /></div>
        <div><Label className="text-xs">Y (0-1)</Label>
          <Input type="number" step="0.001" value={props.y} onChange={(e) => props.onY(e.target.value)} /></div>
      </div>
    </div>
  );
}