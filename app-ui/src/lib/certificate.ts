import unifiedTemplateAsset from "@/assets/certificate-unified-template.png.asset.json";
import { supabase } from "@/integrations/supabase/client";

const UNIFIED_TEMPLATE_URL = unifiedTemplateAsset.url;

// Native pixel coordinates for the unified template (image is 1536 x 1024)
const UNIFIED_POSITIONS = {
  // Student name — sits above the long divider line under "Awarded To"
  name:  { x: 768, y: 385, color: "#0B1B3A", maxWidth: 1100, maxFontSize: 68 },
  // Course title — centered inside the empty rounded red box
  course:{ x: 768, y: 588, color: "#B0202E", maxWidth: 980, maxFontSize: 44 },
  // Issue date — on the underline below the "Issue Date" label
  date:  { x: 1100, y: 905, color: "#0B1B3A", fontSize: 26 },
  // "Certificate ID: ____" — value sits on the underline after the label
  certId:{ x: 820, y: 968, color: "#0B1B3A", fontSize: 24 },
  // QR square inside the rounded box at the bottom-right corner
  qr:    { cx: 1370, cy: 845, size: 135 },
};

type TemplateConfig = {
  url: string;
  // Coordinates in the template's native pixel space
  name: { x: number; y: number; color: string; maxWidth: number; maxFontSize: number };
  date: { x: number; y: number; color: string; fontSize: number; format?: "full" | "day-month" };
};

const DEFAULT_TEMPLATE: TemplateConfig = {
  url: UNIFIED_TEMPLATE_URL,
  name: UNIFIED_POSITIONS.name,
  date: { ...UNIFIED_POSITIONS.date, format: "day-month" as const },
};

// All courses use the same unified template by default.
const COURSE_TEMPLATES: Array<{ match: (slug?: string, title?: string) => boolean; config: TemplateConfig }> = [];

export type CertificateOverrides = {
  template_url?: string;
  name_x?: number;
  name_y?: number;
  name_color?: string;
  name_size?: number;
  date_x?: number;
  date_y?: number;
  date_color?: string;
  date_size?: number;
  date_format?: "full" | "day-month";
  name_font?: string;
  date_font?: string;
  // Course title overlay (inside the name box on the unified template)
  course_x?: number;
  course_y?: number;
  course_size?: number;
  course_color?: string;
  course_font?: string;
  show_course?: boolean;
  // Certificate ID overlay
  certid_x?: number;
  certid_y?: number;
  certid_size?: number;
  certid_color?: string;
  certid_font?: string;
  show_certid?: boolean;
  // QR code overlay
  qr_x?: number;
  qr_y?: number;
  qr_size?: number;
  show_qr?: boolean;
  show_name?: boolean;
};

/** Generate certificate from a pre-designed image template, overlaying name + date + course + cert id + QR. */
export async function generateCertificateFromTemplate(opts: {
  studentName: string;
  courseTitle: string;
  courseSlug?: string;
  date?: Date;
  templateUrl?: string;
  overrides?: CertificateOverrides | null;
  certCode?: string;
  verifyUrl?: string;
}) {
  const { courseTitle } = opts;
  const canvas = await renderCertificateCanvas(opts);

  // Build PDF (landscape A4) using the rendered canvas with dynamic import
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
  doc.addImage(dataUrl, "JPEG", 0, 0, pageW, pageH);
  const safe = courseTitle.replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 40);
  doc.save(`Certificate_${safe}.pdf`);
}

export async function generateCertificate(opts: {
  studentName: string;
  courseTitle: string;
  courseSlug?: string;
  date?: Date;
  overrides?: CertificateOverrides | null;
}) {
  return generateCertificateFromTemplate(opts);
}

/** Render the certificate to a JPEG data URL (same pipeline as the PDF) for in-app preview. */
export async function renderCertificatePreviewDataUrl(opts: {
  studentName: string;
  courseTitle: string;
  courseSlug?: string;
  date?: Date;
  templateUrl?: string;
  overrides?: CertificateOverrides | null;
  certCode?: string;
  verifyUrl?: string;
}): Promise<string> {
  const canvas = await renderCertificateCanvas(opts);
  return canvas.toDataURL("image/jpeg", 0.92);
}

/** Shared canvas renderer used by both PDF and preview. */
async function renderCertificateCanvas(opts: {
  studentName: string;
  courseTitle: string;
  courseSlug?: string;
  date?: Date;
  templateUrl?: string;
  overrides?: CertificateOverrides | null;
  certCode?: string;
  verifyUrl?: string;
}): Promise<HTMLCanvasElement> {
  const { studentName, courseTitle, courseSlug, overrides, certCode, verifyUrl } = opts;
  const date = opts.date ?? new Date();
  const matched = COURSE_TEMPLATES.find((t) => t.match(courseSlug, courseTitle))?.config;
  const customUrl = opts.templateUrl ?? overrides?.template_url;
  const isUnified = !customUrl;
  const tpl: TemplateConfig = customUrl
    ? {
        url: customUrl,
        name: { x: 0.5, y: 0.55, color: "#1a1a1a", maxWidth: 0.7, maxFontSize: 0.06 },
        date: { x: 0.5, y: 0.78, color: "#333333", fontSize: 0.025 },
      }
    : (matched ?? DEFAULT_TEMPLATE);
  const templateUrl = customUrl ?? tpl.url;

  const o = overrides ?? {};
  const nameCfg = {
    x: o.name_x ?? tpl.name.x,
    y: o.name_y ?? tpl.name.y,
    color: o.name_color ?? tpl.name.color,
    maxWidth: tpl.name.maxWidth,
    maxFontSize: o.name_size ?? tpl.name.maxFontSize,
    font: o.name_font || "Cairo",
  };
  const dateCfg = {
    x: o.date_x ?? tpl.date.x,
    y: o.date_y ?? tpl.date.y,
    color: o.date_color ?? tpl.date.color,
    fontSize: o.date_size ?? tpl.date.fontSize,
    format: o.date_format ?? tpl.date.format ?? "full",
    font: o.date_font || "Cairo",
  };

  const img = await loadImage(templateUrl);
  const W = img.width;
  const H = img.height;
  const px = (v: number, axis: "w" | "h") => (v <= 1 ? (axis === "w" ? W : H) * v : v);
  const sizePx = (v: number, axis: "w" | "h") => (v <= 1 ? (axis === "w" ? W : H) * v : v);
  nameCfg.maxFontSize = sizePx(nameCfg.maxFontSize, "h");
  nameCfg.maxWidth = sizePx(nameCfg.maxWidth, "w");
  dateCfg.fontSize = sizePx(dateCfg.fontSize, "h");

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, W, H);

  // Student name — rendered on the "Name:" underline
  if (studentName && o.show_name !== false) {
    ctx.fillStyle = nameCfg.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let ns = nameCfg.maxFontSize;
    ctx.font = `bold ${ns}px '${nameCfg.font}', 'Cairo', 'Arial', sans-serif`;
    while (ctx.measureText(studentName).width > nameCfg.maxWidth && ns > 16) {
      ns -= 2;
      ctx.font = `bold ${ns}px '${nameCfg.font}', 'Cairo', 'Arial', sans-serif`;
    }
    ctx.fillText(studentName, px(nameCfg.x, "w"), px(nameCfg.y, "h"));
  }

  // Course title — render on any template (defaults target the unified template's red box)
  if (courseTitle && o.show_course !== false) {
    const c = UNIFIED_POSITIONS.course;
    const cx = px(o.course_x ?? c.x, "w");
    const cy = px(o.course_y ?? c.y, "h");
    const ccolor = o.course_color ?? c.color;
    const cfont = o.course_font || "Cairo";
    ctx.fillStyle = ccolor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let cs = sizePx(o.course_size ?? c.maxFontSize, "h");
    ctx.font = `bold ${cs}px '${cfont}', 'Cairo', 'Arial', sans-serif`;
    while (ctx.measureText(courseTitle).width > c.maxWidth && cs > 16) {
      cs -= 2;
      ctx.font = `bold ${cs}px '${cfont}', 'Cairo', 'Arial', sans-serif`;
    }
    ctx.fillText(courseTitle, cx, cy);
  }

  // Issue date — rendered on the "Issue Date" underline
  {
    const formatted =
      dateCfg.format === "day-month"
        ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
        : date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    ctx.fillStyle = dateCfg.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${dateCfg.fontSize}px '${dateCfg.font}', 'Cairo', 'Arial', sans-serif`;
    ctx.fillText(formatted, px(dateCfg.x, "w"), px(dateCfg.y, "h"));
  }

  // Certificate ID — rendered on the "Certificate ID:" underline
  if (certCode && o.show_certid !== false) {
    const c = UNIFIED_POSITIONS.certId;
    const cx = px(o.certid_x ?? c.x, "w");
    const cy = px(o.certid_y ?? c.y, "h");
    const ccolor = o.certid_color ?? c.color;
    const cfont = o.certid_font || "Cairo";
    const cs = sizePx(o.certid_size ?? c.fontSize, "h");
    ctx.fillStyle = ccolor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${cs}px '${cfont}', 'Arial', sans-serif`;
    ctx.fillText(certCode, cx, cy);
  }

  if (isUnified) void isUnified;

  // QR code
  if (verifyUrl && o.show_qr !== false) {
    try {
      const { default: QRCode } = await import("qrcode");
      const qSize = sizePx(o.qr_size ?? UNIFIED_POSITIONS.qr.size, "h");
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        margin: 0,
        width: Math.max(64, Math.round(qSize * 2)),
        errorCorrectionLevel: "M",
        color: { dark: "#0B1B3A", light: "#ffffff" },
      });
      const qrImg = await loadImage(qrDataUrl);
      const qcx = px(o.qr_x ?? UNIFIED_POSITIONS.qr.cx, "w");
      const qcy = px(o.qr_y ?? UNIFIED_POSITIONS.qr.cy, "h");
      ctx.drawImage(qrImg, qcx - qSize / 2, qcy - qSize / 2, qSize, qSize);
    } catch {
      /* QR is non-fatal */
    }
  }

  return canvas;
}

/* ----------------------------------------------------------------------
 * Issue (or fetch) the certificate row for this user+course and download
 * the PDF with name, course, date, cert id and a working QR code that
 * points to /verify/<cert_code>.
 * -------------------------------------------------------------------- */

function makeCertCode(): string {
  // Short readable code: CERT-XXXX-XXXX (uppercase alphanumeric)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  const pick = (n: number) =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `CERT-${pick(4)}-${pick(4)}`;
}

export async function issueAndDownloadCertificate(opts: {
  userId: string;
  courseId: string;
  studentName: string;
  courseTitle: string;
  courseSlug?: string;
  date?: Date;
  overrides?: CertificateOverrides | null;
}) {
  // 1) Look up an existing certificate row for this user+course
  let cert = await supabase
    .from("certificates")
    .select("cert_code, issued_at, student_name, course_title")
    .eq("user_id", opts.userId)
    .eq("course_id", opts.courseId)
    .maybeSingle();

  let certCode = cert.data?.cert_code as string | undefined;
  let issuedAt = cert.data?.issued_at ? new Date(cert.data.issued_at) : undefined;

  // 2) If none, create one (retry on rare cert_code collision)
  if (!certCode) {
    const { data, error } = await supabase.rpc("issue_certificate", {
      _course_id: opts.courseId,
      _student_name: opts.studentName,
      _course_title: opts.courseTitle,
      _course_slug: opts.courseSlug ?? "",
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.cert_code) {
      certCode = row.cert_code as string;
      issuedAt = row.issued_at ? new Date(row.issued_at) : new Date();
    }
  }

  const CANONICAL_ORIGIN =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
  const verifyUrl = certCode ? `${CANONICAL_ORIGIN}/verify/${certCode}` : undefined;

  return generateCertificateFromTemplate({
    studentName: opts.studentName,
    courseTitle: opts.courseTitle,
    courseSlug: opts.courseSlug,
    date: opts.date ?? issuedAt,
    overrides: opts.overrides,
    certCode,
    verifyUrl,
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}