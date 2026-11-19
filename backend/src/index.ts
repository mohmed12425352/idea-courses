import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { WebSocketServer, WebSocket } from "ws";
import { config, SERVER_ROOT } from "./config.js";
import { getDb, dbQuery } from "./db/pool.js";

// ============================================================================
// Helpers: YouTube ID Parser & JWT Auth
// ============================================================================
export function extractYouTubeVideoId(raw: string): string {
  const input = String(raw || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .trim();
  if (!input) return "";
  if (input.startsWith("list:") || input.startsWith("bunny:")) return input;
  if (/^[A-Za-z0-9_-]{11}$/.test(input) && input.toLowerCase() !== "videoseries") return input;

  const iframeSrc = input.match(/src=["']([^"']+)["']/i)?.[1] || input;

  // Check for Bunny Stream embed / play URL: iframe.mediadelivery.net/(embed|play)/{libraryId}/{videoGuid}
  const bunnyMatch = iframeSrc.match(/mediadelivery\.net\/(?:embed|play)\/(\d+)\/([0-9a-fA-F-]{36})/i);
  if (bunnyMatch?.[1] && bunnyMatch?.[2]) {
    return `bunny:${bunnyMatch[1]}:${bunnyMatch[2]}`;
  }

  // Check for single video ID first (excluding "videoseries")
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([A-Za-z0-9_-]{11})/i,
    /[?&]v=([A-Za-z0-9_-]{11})/i,
  ];
  for (const rx of patterns) {
    const m = iframeSrc.match(rx);
    if (m?.[1] && m[1].toLowerCase() !== "videoseries") {
      return m[1];
    }
  }

  // Check for YouTube Playlist (e.g. youtube.com/playlist?list=PL... or embed/videoseries?list=PL...)
  const listMatch = iframeSrc.match(/[?&]list=([A-Za-z0-9_-]{10,})/i);
  if (listMatch?.[1]) {
    return `list:${listMatch[1]}`;
  }

  return "";
}

const playlistCache = new Map<string, { expiresAt: number; items: Array<{ videoId: string; title: string; thumbnail: string }> }>();

async function resolveYouTubePlaylistItems(
  rawListId: string,
): Promise<Array<{ videoId: string; title: string; thumbnail: string }>> {
  const listId = String(rawListId || "")
    .replace(/^list:/i, "")
    .replace(/[^A-Za-z0-9_-]/g, "")
    .trim();
  if (!listId) return [];

  const cached = playlistCache.get(listId);
  if (cached && cached.expiresAt > Date.now() && cached.items.length > 0) {
    return cached.items;
  }

  const decodeEntities = (s: string) =>
    s
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

  const items: Array<{ videoId: string; title: string; thumbnail: string }> = [];
  const seen = new Set<string>();

  // 1. Primary: Official YouTube XML Playlist Feed (fast & clean titles)
  try {
    const feedRes = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(listId)}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
      },
    });
    if (feedRes.ok) {
      const xml = await feedRes.text();
      for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
        const block = m[1] || "";
        const vid = block.match(/<yt:videoId>([A-Za-z0-9_-]{11})<\/yt:videoId>/)?.[1] || "";
        const title = decodeEntities(block.match(/<title>([^<]*)<\/title>/)?.[1] || "").trim();
        if (vid && !seen.has(vid)) {
          seen.add(vid);
          items.push({
            videoId: vid,
            title: title || `الجزء ${items.length + 1}`,
            thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
          });
        }
      }
    }
  } catch {}

  // 2. Supplement / Fallback: Scrape full playlist page if >15 items or feed empty
  if (items.length === 0 || items.length === 15) {
    try {
      const pageRes = await fetch(`https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
          "Accept-Language": "ar",
        },
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        for (const m of html.matchAll(/"videoId":"([A-Za-z0-9_-]{11})"/g)) {
          const vid = m[1];
          if (vid && !seen.has(vid)) {
            seen.add(vid);
            items.push({
              videoId: vid,
              title: `الجزء ${items.length + 1}`,
              thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
            });
          }
        }
      }
    } catch {}
  }

  if (items.length > 0) {
    playlistCache.set(listId, { expiresAt: Date.now() + 10 * 60 * 1000, items });
  }
  return items;
}

async function resolveYouTubeThumbnail(ytRef: string): Promise<string> {
  if (!ytRef) return "";
  if (!ytRef.startsWith("list:")) {
    return `https://i.ytimg.com/vi/${ytRef}/hqdefault.jpg`;
  }
  const listId = ytRef.slice(5);
  const items = await resolveYouTubePlaylistItems(listId);
  if (items[0]?.thumbnail) return items[0].thumbnail;
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/playlist?list=${listId}`)}&format=json`,
    );
    if (res.ok) {
      const json: any = await res.json();
      if (json?.thumbnail_url) return String(json.thumbnail_url);
    }
  } catch {}
  return "";
}

interface AuthPayload {
  sub: string;
  role: "admin" | "student";
  email: string;
}

interface AuthedReq extends Request {
  auth?: AuthPayload;
}

function signToken(user: { id: string; role: "admin" | "student"; email: string }): string {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, config.jwtSecret, {
    expiresIn: "30d",
  });
}

function requireAuth(req: AuthedReq, res: Response, next: NextFunction): void {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    res.status(401).json({ error: "يرجى تسجيل الدخول أولاً" });
    return;
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthPayload;
    req.auth = decoded;
    next();
  } catch {
    res.status(401).json({ error: "انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى" });
  }
}

function requireAdmin(req: AuthedReq, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.auth?.role !== "admin") {
      res.status(403).json({ error: "صلاحية الأدمن مطلوبة" });
      return;
    }
    next();
  });
}

function detectPlatformFromUA(ua: string, headers: Request["headers"]): {
  platform: "desktop" | "mobile" | "web";
  deviceLabel: string;
  hwShort: string;
} {
  if (/IdeaCoursesDesktop/i.test(ua) || headers["x-edunova-desktop"]) {
    const pc = ua.match(/PC:([^;)]+)/i)?.[1]?.trim() || decodeURIComponent(String(headers["x-edunova-pc-name"] || "Windows PC"));
    const hw = ua.match(/HW:([^;)]+)/i)?.[1]?.trim() || "";
    return { platform: "desktop", deviceLabel: `كمبيوتر Windows (${pc})`, hwShort: hw };
  }
  if (/IdeaCoursesMobile/i.test(ua)) {
    const dev = ua.match(/DEV:([^;)]+)/i)?.[1]?.trim() || "هاتف أندرويد";
    const hw = ua.match(/HW:([^;)]+)/i)?.[1]?.trim() || "";
    return { platform: "mobile", deviceLabel: `موبايل (${dev})`, hwShort: hw };
  }
  if (/Android/i.test(ua)) return { platform: "mobile", deviceLabel: "متصفح أندرويد", hwShort: "" };
  if (/iPhone|iPad/i.test(ua)) return { platform: "mobile", deviceLabel: "متصفح آيفون", hwShort: "" };
  return { platform: "web", deviceLabel: "متصفح كمبيوتر", hwShort: "" };
}

// ============================================================================
// Clean Fresh Database Initialization (Wipes Legacy Website Tables Once)
// ============================================================================
async function initFreshAppsDatabase(): Promise<void> {
  const db = await getDb();

  // Check if legacy website table `student_works` exists from old template; if so, wipe cleanly once!
  const legacyCheck = await db.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_works' LIMIT 1`,
  );
  if (legacyCheck.rows.length > 0) {
    console.log("[apps-db] Removing legacy website tables to create a 100% clean Apps database...");
    await db.execMulti(`DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;`);
  }

  const sqlPath = fs.existsSync(path.resolve(SERVER_ROOT, "src/db/clean-schema.sql"))
    ? path.resolve(SERVER_ROOT, "src/db/clean-schema.sql")
    : path.resolve(SERVER_ROOT, "dist/db/clean-schema.sql");

  const schemaSql = fs.readFileSync(sqlPath, "utf8");
  await db.execMulti(schemaSql);

  // Safe idempotent column migrations for existing live databases
  await db.execMulti(`
    ALTER TABLE app_config ADD COLUMN IF NOT EXISTS instapay_address TEXT NOT NULL DEFAULT '01026533835';
    ALTER TABLE app_config ADD COLUMN IF NOT EXISTS wallet_number TEXT NOT NULL DEFAULT '01026533835';
    ALTER TABLE app_config ADD COLUMN IF NOT EXISTS payment_holder_name TEXT NOT NULL DEFAULT 'بشمهندس ميدو شلبي';
  `);

  // Seed Admin & Test Student if not present
  const adminEmail = config.seedAdminEmail;
  const adminCheck = await dbQuery("SELECT id FROM app_users WHERE email = $1 LIMIT 1", [adminEmail]);
  if (adminCheck.rows.length === 0) {
    const adminHash = await bcrypt.hash(config.seedAdminPassword, 10);
    await dbQuery(
      `INSERT INTO app_users (name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, 'admin')`,
      ["بشمهندس ميدو شلبي (Admin)", adminEmail, "01026533835", adminHash],
    );

    const studentHash = await bcrypt.hash(config.seedStudentPassword, 10);
    await dbQuery(
      `INSERT INTO app_users (name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, 'student')`,
      ["طالب تجريبي", config.seedStudentEmail, "01000000000", studentHash],
    );
    console.log("[apps-db] Created clean Admin & Student accounts.");
  }

  // Auto-upgrade legacy default instructor name if unchanged
  await dbQuery(
    `UPDATE app_config SET instructor_name = 'بشمهندس ميدو شلبي' WHERE instructor_name = 'م. إيهاب الجلالي'`,
  );
  await dbQuery(
    `UPDATE app_users SET name = 'بشمهندس ميدو شلبي (Admin)' WHERE email = $1 AND name LIKE '%إيهاب%'`,
    [adminEmail],
  );

  // Auto-repair any existing playlist lessons where youtube_video_id was stored as 'videoseries'
  const brokenLessons = await dbQuery("SELECT id, course_id, youtube_url FROM app_lessons WHERE youtube_video_id = 'videoseries'");
  for (const row of brokenLessons.rows) {
    const fixedRef = extractYouTubeVideoId(row.youtube_url);
    if (fixedRef) {
      await dbQuery("UPDATE app_lessons SET youtube_video_id = $1 WHERE id = $2", [fixedRef, row.id]);
      const realThumb = await resolveYouTubeThumbnail(fixedRef);
      if (realThumb) {
        await dbQuery(
          "UPDATE app_courses SET thumbnail_url = $1 WHERE id = $2 AND (thumbnail_url LIKE '%videoseries%' OR thumbnail_url = '')",
          [realThumb, row.course_id],
        );
      }
    }
  }
}

// ============================================================================
// Live Realtime WebSocket Hub (Tracks Online Users + Broadcasts Sync Events)
// ============================================================================
interface WsClient {
  ws: WebSocket;
  userId: string | null;
  userName: string;
  role: string;
  platform: "desktop" | "mobile" | "web";
}

const wsClients = new Set<WsClient>();

function broadcastEvent(type: string, payload: any = {}): void {
  const raw = JSON.stringify({ type, payload, ts: new Date().toISOString() });
  for (const c of wsClients) {
    if (c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(raw);
    }
  }
}

function getOnlineUsersMap(): Record<string, { platform: string; count: number }> {
  const map: Record<string, { platform: string; count: number }> = {};
  for (const c of wsClients) {
    if (c.ws.readyState === WebSocket.OPEN && c.userId) {
      const prev = map[c.userId];
      map[c.userId] = {
        platform: prev?.platform === "desktop" || prev?.platform === "mobile" ? prev.platform : c.platform,
        count: (prev?.count || 0) + 1,
      };
    }
  }
  return map;
}

// ============================================================================
// Main Express Application
// ============================================================================
async function bootstrap() {
  await initFreshAppsDatabase();
  const db = await getDb();

  const app = express();
  app.set("trust proxy", 1);
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "15mb" }));

  // 1. Health & Public Config
  app.get("/api/health", async (_req, res) => {
    const cfg = (await dbQuery("SELECT * FROM app_config WHERE id = 1")).rows[0];
    res.json({
      ok: true,
      service: "idea-courses-clean-apps-cloud",
      dbMode: db.mode,
      cloudHost: db.cloudHost ?? null,
      onlineConnections: wsClients.size,
      config: cfg,
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/config", async (_req, res) => {
    const cfg = (await dbQuery("SELECT * FROM app_config WHERE id = 1")).rows[0];
    res.json({ config: cfg });
  });

  // Serve persistent uploaded course images directly from PostgreSQL `app_media`
  app.get("/api/media/:id", async (req, res) => {
    try {
      const mRes = await dbQuery("SELECT mime_type, data_base64 FROM app_media WHERE id = $1 LIMIT 1", [req.params.id]);
      const row = mRes.rows[0];
      if (!row) {
        res.status(404).send("Not found");
        return;
      }
      const buf = Buffer.from(row.data_base64, "base64");
      res.setHeader("Content-Type", row.mime_type || "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.send(buf);
    } catch {
      res.status(500).send("Media error");
    }
  });

  app.post("/api/admin/upload-image", requireAdmin, async (req, res) => {
    try {
      const rawDataUrl = String(req.body?.dataUrl || "");
      const m = rawDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!m) {
        res.status(400).json({ error: "صيغة الصورة غير مدعومة" });
        return;
      }
      const mimeType = m[1];
      const base64Data = m[2];
      if (base64Data.length > 6 * 1024 * 1024) {
        res.status(413).json({ error: "حجم الصورة كبير جداً" });
        return;
      }
      const ins = await dbQuery(
        "INSERT INTO app_media (mime_type, data_base64) VALUES ($1, $2) RETURNING id",
        [mimeType, base64Data],
      );
      res.json({ url: `/api/media/${ins.rows[0].id}` });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "تعذّر رفع الصورة" });
    }
  });

  // Student Payment Receipt Image Upload (InstaPay / E-Wallet screenshot)
  app.post("/api/student/upload-receipt", requireAuth, async (req, res) => {
    try {
      const rawDataUrl = String(req.body?.dataUrl || "");
      const m = rawDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!m) {
        res.status(400).json({ error: "يرجى اختيار صورة إيصال صالحة (JPG / PNG)" });
        return;
      }
      const mimeType = m[1];
      const base64Data = m[2];
      if (base64Data.length > 6 * 1024 * 1024) {
        res.status(413).json({ error: "حجم صورة الإيصال كبير جداً" });
        return;
      }
      const ins = await dbQuery(
        "INSERT INTO app_media (mime_type, data_base64) VALUES ($1, $2) RETURNING id",
        [mimeType, base64Data],
      );
      res.json({ url: `/api/media/${ins.rows[0].id}` });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "تعذّر رفع صورة الإيصال" });
    }
  });

  // Local & Cloud Installer Downloads
  app.get("/api/public/desktop-download", (_req, res) => {
    const candidates = [
      path.resolve(SERVER_ROOT, "../Ready-Installers/Idea-Courses-Desktop-v2.exe"),
      path.resolve(SERVER_ROOT, "../Ready-Installers/Idea-Courses-Desktop.exe"),
      path.resolve(SERVER_ROOT, "./public-downloads/Idea-Courses-Desktop.exe"),
      path.resolve(process.cwd(), "./public-downloads/Idea-Courses-Desktop.exe"),
      path.resolve(process.cwd(), "./dist/public-downloads/Idea-Courses-Desktop.exe"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        res.setHeader("Content-Disposition", 'attachment; filename="منصة-المحاضرات-للكمبيوتر-ويندوز.exe"');
        res.download(p, "منصة-المحاضرات-للكمبيوتر-ويندوز.exe");
        return;
      }
    }
    res.status(404).json({ error: "ملف الكمبيوتر غير متوفر حالياً للتحميل المباشر" });
  });

  app.get("/api/public/mobile-download", (_req, res) => {
    const candidates = [
      path.resolve(SERVER_ROOT, "../Ready-Installers/Idea-Courses-Mobile.apk"),
      path.resolve(SERVER_ROOT, "./public-downloads/Idea-Courses-Mobile.apk"),
      path.resolve(process.cwd(), "./public-downloads/Idea-Courses-Mobile.apk"),
      path.resolve(process.cwd(), "./dist/public-downloads/Idea-Courses-Mobile.apk"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        res.setHeader("Content-Type", "application/vnd.android.package-archive");
        res.setHeader("Content-Disposition", 'attachment; filename="منصة-المحاضرات-للأندرويد.apk"');
        res.download(p, "منصة-المحاضرات-للأندرويد.apk");
        return;
      }
    }
    res.status(404).json({ error: "ملف الموبايل غير متوفر حالياً للتحميل المباشر" });
  });

  // 2. Auth Routes (Register, Login, Me + Hardware Device Enforcement)
  app.post("/api/auth/register", async (req, res) => {
    try {
      const name = String(req.body?.name || "").trim();
      const email = String(req.body?.email || "").trim().toLowerCase();
      const phone = String(req.body?.phone || "").trim();
      const password = String(req.body?.password || "");
      const deviceId = String(req.body?.deviceId || req.headers["x-edunova-device-id"] || "").trim();

      if (!name || !email || password.length < 6) {
        res.status(400).json({ error: "يرجى إدخال الاسم والبريد وكلمة مرور لا تقل عن 6 أحرف" });
        return;
      }

      const exists = await dbQuery("SELECT id FROM app_users WHERE email = $1 LIMIT 1", [email]);
      if (exists.rows.length > 0) {
        res.status(409).json({ error: "هذا البريد الإلكتروني مسجّل بالفعل" });
        return;
      }

      const hash = await bcrypt.hash(password, 10);
      const ua = String(req.body?.userAgent || req.headers["user-agent"] || "");
      const { platform, deviceLabel, hwShort } = detectPlatformFromUA(ua, req.headers);

      const ins = await dbQuery(
        `INSERT INTO app_users (name, email, phone, password_hash, role, last_seen_at, last_platform)
         VALUES ($1, $2, $3, $4, 'student', now(), $5)
         RETURNING id, name, email, phone, role, is_banned, created_at`,
        [name, email, phone, hash, platform],
      );
      const user = ins.rows[0];

      if (deviceId) {
        await dbQuery(
          `INSERT INTO app_user_devices (user_id, device_id, platform, device_label, hw_short)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id, device_id) DO UPDATE SET last_seen_at = now()`,
          [user.id, deviceId, platform, deviceLabel, hwShort],
        );
      }

      broadcastEvent("users_changed", { userId: user.id });
      const token = signToken(user);
      res.json({ token, user });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "حدث خطأ أثناء إنشاء الحساب" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      const password = String(req.body?.password || "");
      const deviceId = String(req.body?.deviceId || req.headers["x-edunova-device-id"] || "").trim();

      const uRes = await dbQuery("SELECT * FROM app_users WHERE email = $1 LIMIT 1", [email]);
      const user = uRes.rows[0];
      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
        return;
      }

      if (user.is_banned && user.role !== "admin") {
        res.status(403).json({ error: "تم إيقاف هذا الحساب. تواصل مع إدارة المنصة." });
        return;
      }

      const ua = String(req.body?.userAgent || req.headers["user-agent"] || "");
      const { platform, deviceLabel, hwShort } = detectPlatformFromUA(ua, req.headers);

      // Enforce max_devices for students
      if (user.role !== "admin" && deviceId) {
        const cfg = (await dbQuery("SELECT max_devices FROM app_config WHERE id = 1")).rows[0];
        const maxDevices = Math.max(1, Number(cfg?.max_devices || 1));

        const existingDev = await dbQuery(
          "SELECT id FROM app_user_devices WHERE user_id = $1 AND device_id = $2 LIMIT 1",
          [user.id, deviceId],
        );
        if (existingDev.rows.length > 0) {
          await dbQuery(
            "UPDATE app_user_devices SET last_seen_at = now(), device_label = $1, platform = $2 WHERE id = $3",
            [deviceLabel, platform, existingDev.rows[0].id],
          );
        } else {
          const countRes = await dbQuery("SELECT COUNT(*)::int AS cnt FROM app_user_devices WHERE user_id = $1", [
            user.id,
          ]);
          const cnt = Number(countRes.rows[0]?.cnt || 0);
          if (cnt >= maxDevices) {
            res.status(403).json({
              error: `هذا الحساب مرتبط بجهاز آخر بالفعل (الحد المسموح: ${maxDevices} جهاز). تواصل مع الإدارة لإعادة ضبط جهازك.`,
            });
            return;
          }
          await dbQuery(
            `INSERT INTO app_user_devices (user_id, device_id, platform, device_label, hw_short)
             VALUES ($1, $2, $3, $4, $5)`,
            [user.id, deviceId, platform, deviceLabel, hwShort],
          );
        }
      }

      await dbQuery("UPDATE app_users SET last_seen_at = now(), last_platform = $1 WHERE id = $2", [
        platform,
        user.id,
      ]);

      const safeUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        is_banned: user.is_banned,
        created_at: user.created_at,
      };
      const token = signToken(safeUser);
      res.json({ token, user: safeUser });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "فشل تسجيل الدخول" });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req: AuthedReq, res) => {
    const uRes = await dbQuery(
      "SELECT id, name, email, phone, role, is_banned, last_seen_at, last_platform, created_at FROM app_users WHERE id = $1 LIMIT 1",
      [req.auth!.sub],
    );
    const user = uRes.rows[0];
    if (!user || (user.is_banned && user.role !== "admin")) {
      res.status(401).json({ error: "الحساب غير متاح" });
      return;
    }
    await dbQuery("UPDATE app_users SET last_seen_at = now() WHERE id = $1", [user.id]);
    const devices = (
      await dbQuery("SELECT id, device_id, platform, device_label, hw_short, last_seen_at FROM app_user_devices WHERE user_id = $1 ORDER BY last_seen_at DESC", [
        user.id,
      ])
    ).rows;
    res.json({ user, devices });
  });

  // 3. Student Catalog, Dashboard & Protected Classroom Endpoints
  app.get("/api/student/bootstrap", requireAuth, async (req: AuthedReq, res) => {
    const userId = req.auth!.sub;
    const isAdmin = req.auth!.role === "admin";

    const [cfgRes, coursesRes, sectionsRes, lessonsRes, enrollRes, progRes, notifRes, payRes] = await Promise.all([
      dbQuery("SELECT * FROM app_config WHERE id = 1"),
      dbQuery(
        isAdmin
          ? "SELECT * FROM app_courses ORDER BY order_index ASC, created_at DESC"
          : "SELECT * FROM app_courses WHERE is_published = true ORDER BY order_index ASC, created_at DESC",
      ),
      dbQuery("SELECT * FROM app_sections ORDER BY order_index ASC, created_at ASC"),
      dbQuery("SELECT * FROM app_lessons ORDER BY order_index ASC, created_at ASC"),
      dbQuery("SELECT course_id, created_at FROM app_enrollments WHERE user_id = $1", [userId]),
      dbQuery("SELECT * FROM app_lesson_progress WHERE user_id = $1", [userId]),
      dbQuery("SELECT * FROM app_notifications ORDER BY created_at DESC LIMIT 25"),
      dbQuery("SELECT * FROM app_payment_requests WHERE user_id = $1 ORDER BY created_at DESC", [userId]),
    ]);

    const enrolledSet = new Set(enrollRes.rows.map((e: any) => e.course_id));
    const progressMap: Record<string, any> = {};
    for (const p of progRes.rows) {
      progressMap[p.lesson_id] = p;
    }

    const courses = coursesRes.rows.map((c: any) => {
      const isEnrolled = isAdmin || enrolledSet.has(c.id);
      const cSections = sectionsRes.rows
        .filter((s: any) => s.course_id === c.id)
        .map((s: any) => ({
          ...s,
          lessons: lessonsRes.rows
            .filter((l: any) => l.section_id === s.id)
            .map((l: any) => {
              const canWatch = isEnrolled || l.is_free_preview;
              return {
                id: l.id,
                course_id: l.course_id,
                section_id: l.section_id,
                title: l.title,
                description: l.description,
                duration_label: l.duration_label,
                attachment_url: canWatch ? l.attachment_url : "",
                is_free_preview: l.is_free_preview,
                order_index: l.order_index,
                // Never leak YouTube video ID for locked lessons to un-enrolled students!
                youtube_video_id: canWatch ? l.youtube_video_id : "",
                youtube_url: isAdmin ? l.youtube_url : "",
                progress: progressMap[l.id] || null,
              };
            }),
        }));

      const totalLessons = cSections.reduce((acc: number, s: any) => acc + s.lessons.length, 0);
      const completedLessons = cSections.reduce(
        (acc: number, s: any) => acc + s.lessons.filter((l: any) => l.progress?.is_completed).length,
        0,
      );

      return {
        ...c,
        is_enrolled: isEnrolled,
        total_lessons: totalLessons,
        completed_lessons: completedLessons,
        progress_percent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
        sections: cSections,
      };
    });

    res.json({
      config: cfgRes.rows[0],
      courses,
      notifications: notifRes.rows,
      payment_requests: payRes.rows,
    });
  });

  // Submit Student Payment Request (InstaPay / E-Wallet + Receipt Image)
  app.post("/api/student/payment-requests", requireAuth, async (req: AuthedReq, res) => {
    try {
      const userId = req.auth!.sub;
      const courseId = String(req.body?.courseId || "").trim();
      const method = req.body?.method === "wallet" ? "wallet" : "instapay";
      const senderPhone = String(req.body?.senderPhone || "").trim();
      const receiptUrl = String(req.body?.receiptUrl || "").trim();
      const notes = String(req.body?.notes || "").trim();

      if (!courseId || !receiptUrl) {
        res.status(400).json({ error: "يرجى اختيار الكورس ورفع صورة إيصال التحويل أولاً" });
        return;
      }

      const courseRes = await dbQuery("SELECT id, title, price FROM app_courses WHERE id = $1 LIMIT 1", [courseId]);
      const course = courseRes.rows[0];
      if (!course) {
        res.status(404).json({ error: "الكورس غير موجود" });
        return;
      }

      // If student already has a pending request for this course, update it cleanly
      const existingPending = await dbQuery(
        "SELECT id FROM app_payment_requests WHERE user_id = $1 AND course_id = $2 AND status = 'pending' LIMIT 1",
        [userId, courseId],
      );

      let paymentRow;
      if (existingPending.rows.length > 0) {
        const up = await dbQuery(
          `UPDATE app_payment_requests
           SET method = $1, amount = $2, sender_phone = $3, receipt_url = $4, notes = $5, created_at = now()
           WHERE id = $6 RETURNING *`,
          [method, Number(course.price) || 0, senderPhone, receiptUrl, notes, existingPending.rows[0].id],
        );
        paymentRow = up.rows[0];
      } else {
        const ins = await dbQuery(
          `INSERT INTO app_payment_requests (user_id, course_id, method, amount, sender_phone, receipt_url, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [userId, courseId, method, Number(course.price) || 0, senderPhone, receiptUrl, notes],
        );
        paymentRow = ins.rows[0];
      }

      broadcastEvent("payments_changed", { paymentId: paymentRow.id, courseTitle: course.title, status: "pending" });
      res.json({ ok: true, payment: paymentRow });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "تعذّر إرسال طلب الدفع" });
    }
  });

  // Redeem Activation Code
  app.post("/api/student/redeem-code", requireAuth, async (req: AuthedReq, res) => {
    const code = String(req.body?.code || "").trim().toUpperCase();
    if (!code) {
      res.status(400).json({ error: "أدخل كود التفعيل أولاً" });
      return;
    }
    const cRes = await dbQuery("SELECT * FROM app_activation_codes WHERE UPPER(code) = $1 LIMIT 1", [code]);
    const row = cRes.rows[0];
    if (!row) {
      res.status(404).json({ error: "كود التفعيل غير صحيح" });
      return;
    }
    if (row.is_used) {
      res.status(400).json({ error: "تم استخدام هذا الكود من قبل" });
      return;
    }

    await dbQuery(
      "UPDATE app_activation_codes SET is_used = true, used_by_user_id = $1, used_at = now() WHERE id = $2",
      [req.auth!.sub, row.id],
    );
    await dbQuery(
      "INSERT INTO app_enrollments (user_id, course_id, source) VALUES ($1, $2, 'code') ON CONFLICT DO NOTHING",
      [req.auth!.sub, row.course_id],
    );

    const course = (await dbQuery("SELECT title FROM app_courses WHERE id = $1", [row.course_id])).rows[0];
    broadcastEvent("enrollments_changed", { userId: req.auth!.sub, courseId: row.course_id });
    res.json({ ok: true, courseId: row.course_id, courseTitle: course?.title || "الكورس" });
  });

  // Save Lesson Watch Progress & Completion
  app.post("/api/student/progress", requireAuth, async (req: AuthedReq, res) => {
    const userId = req.auth!.sub;
    const { lessonId, courseId, positionSeconds = 0, deltaWatched = 0, markCompleted = false, incrementView = false } =
      req.body || {};

    if (!lessonId || !courseId) {
      res.status(400).json({ error: "بيانات الدرس ناقصة" });
      return;
    }

    const up = await dbQuery(
      `INSERT INTO app_lesson_progress (user_id, lesson_id, course_id, watched_seconds, last_position_seconds, views_count, is_completed, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (user_id, lesson_id) DO UPDATE SET
         watched_seconds = app_lesson_progress.watched_seconds + EXCLUDED.watched_seconds,
         last_position_seconds = EXCLUDED.last_position_seconds,
         views_count = app_lesson_progress.views_count + EXCLUDED.views_count,
         is_completed = app_lesson_progress.is_completed OR EXCLUDED.is_completed,
         updated_at = now()
       RETURNING *`,
      [
        userId,
        lessonId,
        courseId,
        Math.max(0, Math.round(Number(deltaWatched) || 0)),
        Math.max(0, Math.round(Number(positionSeconds) || 0)),
        incrementView ? 1 : 0,
        Boolean(markCompleted),
      ],
    );

    res.json({ progress: up.rows[0] });
  });

  // ============================================================================
  // 4. Admin Control Center Endpoints (Courses, YouTube Videos, Users, Codes, Push)
  // ============================================================================
  app.get("/api/admin/overview", requireAdmin, async (_req, res) => {
    const [usersRes, devicesRes, enrollsRes, coursesRes, sectionsRes, lessonsRes, codesRes, cfgRes, progRes, paymentsRes, ytConnRes, bunnyConnRes] =
      await Promise.all([
        dbQuery(
          "SELECT id, name, email, phone, role, is_banned, last_seen_at, last_platform, created_at FROM app_users ORDER BY created_at DESC",
        ),
        dbQuery("SELECT * FROM app_user_devices ORDER BY last_seen_at DESC"),
        dbQuery("SELECT * FROM app_enrollments"),
        dbQuery("SELECT * FROM app_courses ORDER BY order_index ASC, created_at DESC"),
        dbQuery("SELECT * FROM app_sections ORDER BY order_index ASC, created_at ASC"),
        dbQuery("SELECT * FROM app_lessons ORDER BY order_index ASC, created_at ASC"),
        dbQuery(
          `SELECT ac.*, u.name AS used_by_name, u.email AS used_by_email, c.title AS course_title
           FROM app_activation_codes ac
           LEFT JOIN app_users u ON u.id = ac.used_by_user_id
           LEFT JOIN app_courses c ON c.id = ac.course_id
           ORDER BY ac.created_at DESC LIMIT 200`,
        ),
        dbQuery("SELECT * FROM app_config WHERE id = 1"),
        dbQuery("SELECT user_id, course_id, COUNT(*) FILTER (WHERE is_completed = true)::int AS done_count FROM app_lesson_progress GROUP BY user_id, course_id"),
        dbQuery(
          `SELECT pr.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone, c.title AS course_title
           FROM app_payment_requests pr
           LEFT JOIN app_users u ON u.id = pr.user_id
           LEFT JOIN app_courses c ON c.id = pr.course_id
           ORDER BY CASE WHEN pr.status = 'pending' THEN 0 ELSE 1 END, pr.created_at DESC
           LIMIT 200`,
        ),
        dbQuery("SELECT client_id, client_secret, refresh_token, channel_id, channel_title, channel_thumbnail, default_privacy FROM app_youtube_connection WHERE id = 1"),
        dbQuery("SELECT library_id, api_key, token_auth_key, cdn_hostname FROM app_bunny_connection WHERE id = 1"),
      ]);

    const onlineMap = getOnlineUsersMap();
    const devicesByUser: Record<string, any[]> = {};
    for (const d of devicesRes.rows) {
      (devicesByUser[d.user_id] ||= []).push(d);
    }

    const enrollsByUser: Record<string, string[]> = {};
    for (const e of enrollsRes.rows) {
      (enrollsByUser[e.user_id] ||= []).push(e.course_id);
    }

    const doneByUser: Record<string, number> = {};
    for (const p of progRes.rows) {
      doneByUser[p.user_id] = (doneByUser[p.user_id] || 0) + Number(p.done_count || 0);
    }

    const users = usersRes.rows.map((u: any) => ({
      ...u,
      online: onlineMap[u.id] || null,
      devices: devicesByUser[u.id] || [],
      enrolled_course_ids: enrollsByUser[u.id] || [],
      completed_lessons_total: doneByUser[u.id] || 0,
    }));

    const courses = coursesRes.rows.map((c: any) => ({
      ...c,
      enrolled_count: enrollsRes.rows.filter((e: any) => e.course_id === c.id).length,
      sections: sectionsRes.rows
        .filter((s: any) => s.course_id === c.id)
        .map((s: any) => ({
          ...s,
          lessons: lessonsRes.rows.filter((l: any) => l.section_id === s.id),
        })),
    }));

    const ytRow = ytConnRes.rows[0] || {};
    const bunnyRow = bunnyConnRes.rows[0] || {};
    const hostProto = _req.protocol === "https" || _req.headers["x-forwarded-proto"] === "https" ? "https" : _req.protocol;
    const ytRedirectUri = `${hostProto}://${_req.get("host")}/api/admin/youtube/oauth/callback`;

    res.json({
      config: cfgRes.rows[0],
      youtube: {
        configured: Boolean(ytRow.client_id && ytRow.client_secret),
        connected: Boolean(ytRow.refresh_token),
        clientId: ytRow.client_id || "",
        hasClientSecret: Boolean(ytRow.client_secret),
        channelId: ytRow.channel_id || "",
        channelTitle: ytRow.channel_title || "",
        channelThumbnail: ytRow.channel_thumbnail || "",
        defaultPrivacy: ytRow.default_privacy || "unlisted",
        redirectUri: ytRedirectUri,
      },
      bunny: {
        connected: Boolean(bunnyRow.library_id && bunnyRow.api_key),
        libraryId: bunnyRow.library_id || "",
        hasApiKey: Boolean(bunnyRow.api_key),
        hasTokenAuthKey: Boolean(bunnyRow.token_auth_key),
        cdnHostname: bunnyRow.cdn_hostname || "",
      },
      stats: {
        totalStudents: users.filter((u: any) => u.role === "student").length,
        onlineNow: Object.keys(onlineMap).length,
        totalCourses: courses.length,
        totalLessons: lessonsRes.rows.length,
        totalEnrollments: enrollsRes.rows.length,
        pendingPayments: paymentsRes.rows.filter((p: any) => p.status === "pending").length,
      },
      users,
      courses,
      codes: codesRes.rows,
      payments: paymentsRes.rows,
    });
  });

  // Approve / Reject Student Payment Requests
  app.post("/api/admin/payments/:id/approve", requireAdmin, async (req, res) => {
    const payRes = await dbQuery("SELECT * FROM app_payment_requests WHERE id = $1 LIMIT 1", [req.params.id]);
    const pay = payRes.rows[0];
    if (!pay) {
      res.status(404).json({ error: "طلب الدفع غير موجود" });
      return;
    }

    await dbQuery(
      "UPDATE app_payment_requests SET status = 'approved', admin_note = '', reviewed_at = now() WHERE id = $1",
      [pay.id],
    );
    await dbQuery(
      "INSERT INTO app_enrollments (user_id, course_id, source) VALUES ($1, $2, 'payment') ON CONFLICT DO NOTHING",
      [pay.user_id, pay.course_id],
    );

    broadcastEvent("payments_changed", { paymentId: pay.id, status: "approved", userId: pay.user_id });
    broadcastEvent("enrollments_changed", { userId: pay.user_id, courseId: pay.course_id, enrolled: true });
    res.json({ ok: true });
  });

  app.post("/api/admin/payments/:id/reject", requireAdmin, async (req, res) => {
    const adminNote = String(req.body?.adminNote || "يرجى التأكد من صورة الإيصال والمبلغ وإعادة المحاولة").trim();
    const up = await dbQuery(
      "UPDATE app_payment_requests SET status = 'rejected', admin_note = $1, reviewed_at = now() WHERE id = $2 RETURNING *",
      [adminNote, req.params.id],
    );
    if (up.rows.length === 0) {
      res.status(404).json({ error: "طلب الدفع غير موجود" });
      return;
    }
    broadcastEvent("payments_changed", { paymentId: req.params.id, status: "rejected", userId: up.rows[0].user_id });
    res.json({ ok: true, payment: up.rows[0] });
  });

  // Save Platform Branding, Payment Accounts & Security Settings
  app.put("/api/admin/config", requireAdmin, async (req, res) => {
    const {
      app_name,
      instructor_name,
      welcome_subtitle,
      whatsapp_number,
      instapay_address,
      wallet_number,
      payment_holder_name,
      max_devices,
      desktop_mobile_only,
    } = req.body || {};
    const r = await dbQuery(
      `UPDATE app_config SET
         app_name = COALESCE($1, app_name),
         instructor_name = COALESCE($2, instructor_name),
         welcome_subtitle = COALESCE($3, welcome_subtitle),
         whatsapp_number = COALESCE($4, whatsapp_number),
         instapay_address = COALESCE($5, instapay_address),
         wallet_number = COALESCE($6, wallet_number),
         payment_holder_name = COALESCE($7, payment_holder_name),
         max_devices = COALESCE($8, max_devices),
         desktop_mobile_only = COALESCE($9, desktop_mobile_only),
         updated_at = now()
       WHERE id = 1 RETURNING *`,
      [
        app_name ?? null,
        instructor_name ?? null,
        welcome_subtitle ?? null,
        whatsapp_number ?? null,
        instapay_address ?? null,
        wallet_number ?? null,
        payment_holder_name ?? null,
        max_devices != null ? Math.max(1, Number(max_devices)) : null,
        desktop_mobile_only != null ? Boolean(desktop_mobile_only) : null,
      ],
    );
    broadcastEvent("config_changed", r.rows[0]);
    res.json({ config: r.rows[0] });
  });

  // Courses CRUD
  app.post("/api/admin/courses", requireAdmin, async (req, res) => {
    const {
      title,
      subtitle = "",
      description = "",
      category = "عام",
      price = 0,
      thumbnail_url = "",
      intro_youtube_url = "",
      is_published = true,
      max_views_per_lesson = 0,
    } = req.body || {};

    if (!String(title || "").trim()) {
      res.status(400).json({ error: "عنوان الكورس مطلوب" });
      return;
    }

    const introVid = extractYouTubeVideoId(intro_youtube_url);
    const autoThumb =
      String(thumbnail_url || "").trim() ||
      (introVid ? await resolveYouTubeThumbnail(introVid) : "");

    const ins = await dbQuery(
      `INSERT INTO app_courses (title, subtitle, description, category, price, thumbnail_url, intro_youtube_url, is_published, max_views_per_lesson)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        String(title).trim(),
        String(subtitle).trim(),
        String(description).trim(),
        String(category).trim() || "عام",
        Number(price) || 0,
        autoThumb,
        String(intro_youtube_url).trim(),
        Boolean(is_published),
        Math.max(0, Number(max_views_per_lesson) || 0),
      ],
    );

    // Create default first section automatically for smooth UX!
    const course = ins.rows[0];
    await dbQuery("INSERT INTO app_sections (course_id, title, order_index) VALUES ($1, 'الفصل الأول — المحاضرات الأساسية', 0)", [
      course.id,
    ]);

    broadcastEvent("courses_changed", { action: "created", courseTitle: course.title });
    res.json({ course });
  });

  app.put("/api/admin/courses/:id", requireAdmin, async (req, res) => {
    const { id } = req.params;
    const {
      title,
      subtitle = "",
      description = "",
      category = "عام",
      price = 0,
      thumbnail_url = "",
      intro_youtube_url = "",
      is_published = true,
      max_views_per_lesson = 0,
    } = req.body || {};

    const up = await dbQuery(
      `UPDATE app_courses SET
         title = $1, subtitle = $2, description = $3, category = $4, price = $5,
         thumbnail_url = $6, intro_youtube_url = $7, is_published = $8, max_views_per_lesson = $9
       WHERE id = $10 RETURNING *`,
      [
        String(title || "").trim(),
        String(subtitle || "").trim(),
        String(description || "").trim(),
        String(category || "عام").trim(),
        Number(price) || 0,
        String(thumbnail_url || "").trim(),
        String(intro_youtube_url || "").trim(),
        Boolean(is_published),
        Math.max(0, Number(max_views_per_lesson) || 0),
        id,
      ],
    );
    broadcastEvent("courses_changed", { action: "updated", courseId: id });
    res.json({ course: up.rows[0] });
  });

  app.delete("/api/admin/courses/:id", requireAdmin, async (req, res) => {
    await dbQuery("DELETE FROM app_courses WHERE id = $1", [req.params.id]);
    broadcastEvent("courses_changed", { action: "deleted", courseId: req.params.id });
    res.json({ ok: true });
  });

  // Sections CRUD
  app.post("/api/admin/sections", requireAdmin, async (req, res) => {
    const { course_id, title } = req.body || {};
    if (!course_id || !String(title || "").trim()) {
      res.status(400).json({ error: "اختر الكورس واكتب عنوان الفصل" });
      return;
    }
    const cnt = (await dbQuery("SELECT COUNT(*)::int AS c FROM app_sections WHERE course_id = $1", [course_id])).rows[0]
      ?.c || 0;
    const ins = await dbQuery(
      "INSERT INTO app_sections (course_id, title, order_index) VALUES ($1, $2, $3) RETURNING *",
      [course_id, String(title).trim(), cnt],
    );
    broadcastEvent("courses_changed", { courseId: course_id });
    res.json({ section: ins.rows[0] });
  });

  app.delete("/api/admin/sections/:id", requireAdmin, async (req, res) => {
    await dbQuery("DELETE FROM app_sections WHERE id = $1", [req.params.id]);
    broadcastEvent("courses_changed", {});
    res.json({ ok: true });
  });

  // YouTube Lessons CRUD
  app.post("/api/admin/lessons", requireAdmin, async (req, res) => {
    const {
      course_id,
      section_id,
      title,
      description = "",
      youtube_url,
      duration_label = "",
      attachment_url = "",
      is_free_preview = false,
    } = req.body || {};

    const ytId = extractYouTubeVideoId(youtube_url);
    if (!course_id || !section_id || !String(title || "").trim() || !ytId) {
      res.status(400).json({ error: "تأكد من كتابة عنوان الدرس ولصق رابط فيديو يوتيوب صحيح" });
      return;
    }

    const cnt = (await dbQuery("SELECT COUNT(*)::int AS c FROM app_lessons WHERE section_id = $1", [section_id])).rows[0]
      ?.c || 0;

    const ins = await dbQuery(
      `INSERT INTO app_lessons (course_id, section_id, title, description, youtube_url, youtube_video_id, duration_label, attachment_url, is_free_preview, order_index)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        course_id,
        section_id,
        String(title).trim(),
        String(description).trim(),
        String(youtube_url).trim(),
        ytId,
        String(duration_label).trim(),
        String(attachment_url).trim(),
        Boolean(is_free_preview),
        cnt,
      ],
    );

    // Auto-fill course thumbnail from first YouTube video/playlist if course has no valid thumbnail yet!
    const thumb = await resolveYouTubeThumbnail(ytId);
    if (thumb) {
      await dbQuery(
        `UPDATE app_courses SET thumbnail_url = $1 WHERE id = $2 AND (thumbnail_url IS NULL OR thumbnail_url = '' OR thumbnail_url LIKE '%videoseries%')`,
        [thumb, course_id],
      );
    }

    broadcastEvent("lessons_changed", { action: "created", lessonTitle: ins.rows[0].title, courseId: course_id });
    res.json({ lesson: ins.rows[0] });
  });

  app.put("/api/admin/lessons/:id", requireAdmin, async (req, res) => {
    const { title, description = "", youtube_url, duration_label = "", attachment_url = "", is_free_preview = false } =
      req.body || {};
    const ytId = extractYouTubeVideoId(youtube_url);
    if (!String(title || "").trim() || !ytId) {
      res.status(400).json({ error: "عنوان الدرس ورابط يوتيوب الصحيح مطلوبان" });
      return;
    }
    const up = await dbQuery(
      `UPDATE app_lessons SET
         title = $1, description = $2, youtube_url = $3, youtube_video_id = $4,
         duration_label = $5, attachment_url = $6, is_free_preview = $7
       WHERE id = $8 RETURNING *`,
      [
        String(title).trim(),
        String(description).trim(),
        String(youtube_url).trim(),
        ytId,
        String(duration_label).trim(),
        String(attachment_url).trim(),
        Boolean(is_free_preview),
        req.params.id,
      ],
    );
    broadcastEvent("lessons_changed", { action: "updated" });
    res.json({ lesson: up.rows[0] });
  });

  app.delete("/api/admin/lessons/:id", requireAdmin, async (req, res) => {
    await dbQuery("DELETE FROM app_lessons WHERE id = $1", [req.params.id]);
    broadcastEvent("lessons_changed", { action: "deleted" });
    res.json({ ok: true });
  });

  // Users Management (Create Student, Toggle Course Access, Reset Devices, Ban/Unban)
  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const phone = String(req.body?.phone || "").trim();
    const password = String(req.body?.password || "").trim();
    const role = req.body?.role === "admin" ? "admin" : "student";

    if (!name || !email || password.length < 6) {
      res.status(400).json({ error: "الاسم والبريد وكلمة المرور (6 أحرف+) مطلوبة" });
      return;
    }
    const hash = await bcrypt.hash(password, 10);
    try {
      const ins = await dbQuery(
        `INSERT INTO app_users (name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, email, phone, role, is_banned, created_at`,
        [name, email, phone, hash, role],
      );
      broadcastEvent("users_changed", {});
      res.json({ user: ins.rows[0] });
    } catch {
      res.status(409).json({ error: "هذا البريد مسجّل مسبقاً" });
    }
  });

  app.post("/api/admin/users/:id/toggle-ban", requireAdmin, async (req, res) => {
    const up = await dbQuery(
      "UPDATE app_users SET is_banned = NOT is_banned WHERE id = $1 AND role <> 'admin' RETURNING id, is_banned",
      [req.params.id],
    );
    broadcastEvent("users_changed", { userId: req.params.id });
    res.json({ user: up.rows[0] });
  });

  app.post("/api/admin/users/:id/reset-devices", requireAdmin, async (req, res) => {
    await dbQuery("DELETE FROM app_user_devices WHERE user_id = $1", [req.params.id]);
    res.json({ ok: true });
  });

  app.post("/api/admin/users/:id/toggle-enrollment", requireAdmin, async (req, res) => {
    const userId = req.params.id;
    const courseId = String(req.body?.courseId || "");
    const existing = await dbQuery("SELECT id FROM app_enrollments WHERE user_id = $1 AND course_id = $2", [
      userId,
      courseId,
    ]);
    let enrolled = false;
    if (existing.rows.length > 0) {
      await dbQuery("DELETE FROM app_enrollments WHERE user_id = $1 AND course_id = $2", [userId, courseId]);
      enrolled = false;
    } else {
      await dbQuery("INSERT INTO app_enrollments (user_id, course_id, source) VALUES ($1, $2, 'admin')", [
        userId,
        courseId,
      ]);
      enrolled = true;
    }
    broadcastEvent("enrollments_changed", { userId, courseId, enrolled });
    res.json({ ok: true, enrolled });
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    await dbQuery("DELETE FROM app_users WHERE id = $1 AND role <> 'admin'", [req.params.id]);
    broadcastEvent("users_changed", {});
    res.json({ ok: true });
  });

  // Activation Codes Generator
  app.post("/api/admin/codes/generate", requireAdmin, async (req, res) => {
    const courseId = String(req.body?.course_id || "");
    const count = Math.max(1, Math.min(100, Number(req.body?.count) || 5));
    if (!courseId) {
      res.status(400).json({ error: "اختر الكورس أولاً" });
      return;
    }
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const randSeg = (len: number) =>
      Array.from({ length: len }, () => alphabet[crypto.randomInt(0, alphabet.length)]).join("");

    const created: any[] = [];
    for (let i = 0; i < count; i++) {
      const code = `IDEA-${randSeg(4)}-${randSeg(4)}`;
      const r = await dbQuery(
        "INSERT INTO app_activation_codes (code, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *",
        [code, courseId],
      );
      if (r.rows[0]) created.push(r.rows[0]);
    }
    res.json({ codes: created });
  });

  // Live Broadcast Push Notification
  app.post("/api/admin/notifications", requireAdmin, async (req, res) => {
    const title = String(req.body?.title || "تنبيه جديد من المحاضر 🔔").trim();
    const body = String(req.body?.body || "").trim();
    if (!body) {
      res.status(400).json({ error: "نص الإشعار مطلوب" });
      return;
    }
    const ins = await dbQuery("INSERT INTO app_notifications (title, body) VALUES ($1, $2) RETURNING *", [title, body]);
    broadcastEvent("live_notification", ins.rows[0]);
    res.json({ notification: ins.rows[0], sentToConnections: wsClients.size });
  });

  // Resolve YouTube Playlist into clean individual 11-char videoIds + titles
  app.get("/api/youtube/playlist/:listId", requireAuth, async (req, res) => {
    const items = await resolveYouTubePlaylistItems(String(req.params.listId || ""));
    res.json({ playlistId: req.params.listId, items });
  });

  // ============================================================================
  // 5. YouTube Channel OAuth & Direct Unlisted Resumable Video Upload
  // ============================================================================
  const getPublicRedirectUri = (req: Request) => {
    const proto = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https" ? "https" : req.protocol;
    return `${proto}://${req.get("host")}/api/admin/youtube/oauth/callback`;
  };

  async function getValidYouTubeAccessToken(): Promise<string> {
    const r = await dbQuery("SELECT * FROM app_youtube_connection WHERE id = 1");
    const row = r.rows[0];
    if (!row || !row.client_id || !row.client_secret || !row.refresh_token) {
      throw new Error("لم يتم ربط قناة يوتيوب بعد — اربط القناة أولاً من لوحة الأدمن");
    }

    const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
    if (row.access_token && expiresAt > Date.now() + 120_000) {
      return String(row.access_token);
    }

    // Refresh access token automatically using permanent refresh_token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: row.client_id,
        client_secret: row.client_secret,
        refresh_token: row.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new Error(
        `انتهت صلاحية ربط قناة يوتيوب (${tokenJson?.error_description || tokenJson?.error || tokenRes.status}) — يرجى إعادة الربط.`,
      );
    }

    const nextExpires = new Date(Date.now() + Number(tokenJson.expires_in || 3500) * 1000).toISOString();
    await dbQuery(
      "UPDATE app_youtube_connection SET access_token = $1, token_expires_at = $2, updated_at = now() WHERE id = 1",
      [tokenJson.access_token, nextExpires],
    );
    return String(tokenJson.access_token);
  }

  app.put("/api/admin/youtube/credentials", requireAdmin, async (req, res) => {
    const clientId = String(req.body?.clientId || "").trim();
    const clientSecret = String(req.body?.clientSecret || "").trim();
    if (!clientId) {
      res.status(400).json({ error: "يرجى إدخال Client ID من Google Cloud" });
      return;
    }

    const existing = (await dbQuery("SELECT client_secret FROM app_youtube_connection WHERE id = 1")).rows[0];
    const finalSecret = clientSecret || existing?.client_secret || "";
    if (!finalSecret) {
      res.status(400).json({ error: "يرجى إدخال Client Secret من Google Cloud" });
      return;
    }

    await dbQuery(
      `UPDATE app_youtube_connection
       SET client_id = $1, client_secret = $2, updated_at = now()
       WHERE id = 1`,
      [clientId, finalSecret],
    );
    broadcastEvent("youtube_changed", {});
    res.json({ ok: true, redirectUri: getPublicRedirectUri(req) });
  });

  app.get("/api/admin/youtube/oauth/start", requireAdmin, async (req: AuthedReq, res) => {
    const row = (await dbQuery("SELECT client_id, client_secret FROM app_youtube_connection WHERE id = 1")).rows[0];
    if (!row?.client_id || !row?.client_secret) {
      res.status(400).json({ error: "احفظ بيانات Google Client ID و Client Secret أولاً" });
      return;
    }

    const redirectUri = getPublicRedirectUri(req);
    const stateToken = jwt.sign({ purpose: "yt_oauth", sub: req.auth!.sub }, config.jwtSecret, { expiresIn: "15m" });
    const params = new URLSearchParams({
      client_id: row.client_id,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state: stateToken,
    });
    res.json({ authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, redirectUri });
  });

  app.get("/api/admin/youtube/oauth/callback", async (req, res) => {
    const renderHtml = (ok: boolean, title: string, desc: string) => `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${title}</title>
<style>body{margin:0;min-height:100vh;background:#0b090d;color:#fff;font-family:system-ui,Tahoma,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center}
.box{max-width:460px;background:#16121d;border:1px solid ${ok ? "rgba(16,185,129,.45)" : "rgba(244,63,94,.45)"};border-radius:24px;padding:32px;box-shadow:0 24px 60px rgba(0,0,0,.7)}
h2{margin:0 0 10px;color:${ok ? "#34d399" : "#fb7185"}}p{color:#cbd5e1;font-size:14px;line-height:1.7;margin:0 0 22px}
a,button{display:inline-block;padding:11px 24px;border-radius:12px;background:#e11d48;color:#fff;text-decoration:none;font-weight:700;border:0;cursor:pointer}</style>
</head><body><div class="box"><h2>${title}</h2><p>${desc}</p>
<a href="/admin">العودة للوحة التحكم الآن</a>
<script>try{if(window.opener){window.opener.postMessage({type:'yt_oauth_done',ok:${ok}},'*');setTimeout(()=>window.close(),1800);}}catch(e){}</script>
</div></body></html>`;

    try {
      const errorParam = String(req.query.error || "");
      if (errorParam) {
        res.status(400).send(renderHtml(false, "تم إلغاء الربط", `رد جوجل: ${errorParam}`));
        return;
      }

      const code = String(req.query.code || "");
      const state = String(req.query.state || "");
      if (!code || !state) {
        res.status(400).send(renderHtml(false, "بيانات غير مكتملة", "لم يصل كود التحقق من جوجل."));
        return;
      }

      const decoded = jwt.verify(state, config.jwtSecret) as any;
      if (decoded?.purpose !== "yt_oauth") {
        res.status(403).send(renderHtml(false, "طلب غير صالح", "انتهت صلاحية جلسة الربط، أعد المحاولة من لوحة الأدمن."));
        return;
      }

      const row = (await dbQuery("SELECT client_id, client_secret, refresh_token FROM app_youtube_connection WHERE id = 1")).rows[0];
      const redirectUri = getPublicRedirectUri(req);

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: row.client_id,
          client_secret: row.client_secret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      const tokenJson: any = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok || !tokenJson.access_token) {
        res
          .status(400)
          .send(
            renderHtml(
              false,
              "تعذّر إتمام الربط مع جوجل",
              `تأكد من مطابقة Redirect URI تماماً في Google Cloud:\n${redirectUri}\n(${tokenJson?.error_description || tokenJson?.error || ""})`,
            ),
          );
        return;
      }

      const refreshToken = String(tokenJson.refresh_token || row.refresh_token || "");
      const expiresAt = new Date(Date.now() + Number(tokenJson.expires_in || 3500) * 1000).toISOString();

      // Fetch connected YouTube Channel Name & Avatar
      let channelId = "";
      let channelTitle = "قناة يوتيوب متصلة";
      let channelThumb = "";
      try {
        const chRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
          headers: { Authorization: `Bearer ${tokenJson.access_token}` },
        });
        if (chRes.ok) {
          const chJson: any = await chRes.json();
          const item = chJson?.items?.[0];
          if (item) {
            channelId = item.id || "";
            channelTitle = item.snippet?.title || channelTitle;
            channelThumb = item.snippet?.thumbnails?.default?.url || "";
          }
        }
      } catch {}

      await dbQuery(
        `UPDATE app_youtube_connection
         SET access_token = $1, refresh_token = $2, token_expires_at = $3,
             channel_id = $4, channel_title = $5, channel_thumbnail = $6, updated_at = now()
         WHERE id = 1`,
        [tokenJson.access_token, refreshToken, expiresAt, channelId, channelTitle, channelThumb],
      );

      broadcastEvent("youtube_changed", { connected: true, channelTitle });
      res.send(
        renderHtml(
          true,
          "✓ تم ربط قناة يوتيوب بنجاح!",
          `القناة المتصلة الآن: <strong>${channelTitle}</strong>.<br/>يمكنك الآن رفع الفيديوهات مباشرة من المنصة وستُنشر تلقائياً كفيديوهات غير مدرجة (باللينك فقط)!`,
        ),
      );
    } catch (err: any) {
      res.status(500).send(renderHtml(false, "حدث خطأ أثناء الربط", err?.message || "خطأ غير متوقع"));
    }
  });

  app.post("/api/admin/youtube/disconnect", requireAdmin, async (_req, res) => {
    await dbQuery(
      `UPDATE app_youtube_connection
       SET access_token = '', refresh_token = '', token_expires_at = NULL,
           channel_id = '', channel_title = '', channel_thumbnail = '', updated_at = now()
       WHERE id = 1`,
    );
    broadcastEvent("youtube_changed", { connected: false });
    res.json({ ok: true });
  });

  // Resumable Upload Session Store (zero RAM bloat — streams 4MB chunks straight to YouTube!)
  interface YtUploadSession {
    uploadUrl: string;
    fileSize: number;
    mimeType: string;
    title: string;
    createdAt: number;
  }
  const ytUploadSessions = new Map<string, YtUploadSession>();

  app.post("/api/admin/youtube/init-upload", requireAdmin, async (req, res) => {
    try {
      const title = String(req.body?.title || "محاضرة جديدة").trim();
      const description = String(req.body?.description || "محاضرة محمية — منصة Idea Courses — بشمهندس ميدو شلبي").trim();
      const fileSize = Number(req.body?.fileSize || 0);
      const mimeType = String(req.body?.mimeType || "video/mp4").trim() || "video/mp4";

      if (!fileSize || fileSize <= 0) {
        res.status(400).json({ error: "حجم ملف الفيديو غير صالح" });
        return;
      }

      // Prune stale sessions (> 6 hours)
      const now = Date.now();
      for (const [k, v] of ytUploadSessions.entries()) {
        if (now - v.createdAt > 6 * 3600 * 1000) ytUploadSessions.delete(k);
      }

      const accessToken = await getValidYouTubeAccessToken();
      const initRes = await fetch(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Length": String(fileSize),
            "X-Upload-Content-Type": mimeType,
          },
          body: JSON.stringify({
            snippet: {
              title: title.slice(0, 100),
              description: description.slice(0, 4800),
              categoryId: "27", // Education
            },
            status: {
              privacyStatus: "unlisted", // غير مدرج — لا يظهر للناس إلا باللينك فقط!
              embeddable: true,
              selfDeclaredMadeForKids: false,
            },
          }),
        },
      );

      if (!initRes.ok) {
        const errText = await initRes.text().catch(() => "");
        let friendly = `فشل بدء الرفع على يوتيوب (${initRes.status})`;
        if (errText.includes("quotaExceeded")) {
          friendly = "تم استنفاد الحصة اليومية المجانية لـ YouTube API (جرّب غداً أو اطلب زيادة الحصة مجاناً من Google Cloud).";
        } else if (errText.includes("youtubeSignupRequired")) {
          friendly = "حساب جوجل المرتبط لا يملك قناة يوتيوب مفعّلة بعد — أنشئ قناة على YouTube أولاً ثم أعد المحاولة.";
        }
        res.status(400).json({ error: friendly, details: errText.slice(0, 400) });
        return;
      }

      const uploadUrl = initRes.headers.get("location");
      if (!uploadUrl) {
        res.status(502).json({ error: "لم يُرجع يوتيوب رابط الرفع (Location header missing)" });
        return;
      }

      const uploadId = crypto.randomUUID();
      ytUploadSessions.set(uploadId, { uploadUrl, fileSize, mimeType, title, createdAt: now });
      res.json({ uploadId, chunkSize: 4 * 1024 * 1024 }); // 4MB exact multiple of 256KB
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "تعذّر بدء الرفع إلى يوتيوب" });
    }
  });

  app.put(
    "/api/admin/youtube/upload-chunk/:uploadId",
    requireAdmin,
    express.raw({ type: "application/octet-stream", limit: "6mb" }),
    async (req, res) => {
      try {
        const uploadId = String(req.params.uploadId || "");
        const sess = ytUploadSessions.get(uploadId);
        if (!sess) {
          res.status(404).json({ error: "انتهت جلسة الرفع، أعد المحاولة" });
          return;
        }

        const start = Number(req.headers["x-chunk-start"]);
        const end = Number(req.headers["x-chunk-end"]);
        const total = Number(req.headers["x-total-size"] || sess.fileSize);
        const bodyBuf = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);

        if (!Number.isFinite(start) || !Number.isFinite(end) || bodyBuf.length === 0) {
          res.status(400).json({ error: "بيانات جزء الفيديو غير صالحة" });
          return;
        }

        const accessToken = await getValidYouTubeAccessToken();
        const ytRes = await fetch(sess.uploadUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": sess.mimeType,
            "Content-Length": String(bodyBuf.length),
            "Content-Range": `bytes ${start}-${end}/${total}`,
          },
          body: new Uint8Array(bodyBuf),
        });

        // 308 = Chunk received cleanly, ready for next chunk
        if (ytRes.status === 308) {
          res.json({ done: false, uploadedBytes: end + 1 });
          return;
        }

        // 200 / 201 = Final chunk uploaded and video created on YouTube!
        if (ytRes.status === 200 || ytRes.status === 201) {
          const ytVideo: any = await ytRes.json().catch(() => ({}));
          ytUploadSessions.delete(uploadId);
          const videoId = String(ytVideo?.id || "");
          const actualPrivacy = String(ytVideo?.status?.privacyStatus || "unlisted");
          res.json({
            done: true,
            videoId,
            youtubeUrl: videoId ? `https://youtu.be/${videoId}` : "",
            privacyStatus: actualPrivacy,
            forcedPrivateByUnverifiedApp: actualPrivacy === "private",
            title: ytVideo?.snippet?.title || sess.title,
            thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "",
          });
          return;
        }

        const errBody = await ytRes.text().catch(() => "");
        res.status(502).json({
          error: `تعذّر رفع جزء الفيديو على يوتيوب (${ytRes.status})`,
          details: errBody.slice(0, 300),
        });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || "خطأ أثناء رفع جزء الفيديو" });
      }
    },
  );

  // ============================================================================
  // 6. Bunny.net Stream Library Connector, Bulk Importer & Signed Embed Player
  // ============================================================================
  const fmtDurationSec = (sec: number): string => {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    if (!s) return "";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
      : `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  };

  app.put("/api/admin/bunny/config", requireAdmin, async (req, res) => {
    try {
      let libraryId = String(req.body?.libraryId || "").replace(/\D/g, "").trim();
      const apiKeyInput = String(req.body?.apiKey || "").trim();
      const tokenAuthKeyInput = req.body?.tokenAuthKey;
      const cdnHostname = String(req.body?.cdnHostname || "")
        .replace(/^https?:\/\//i, "")
        .replace(/\/.*$/, "")
        .trim();

      const existing = (await dbQuery("SELECT library_id, api_key, token_auth_key FROM app_bunny_connection WHERE id = 1")).rows[0] || {};
      const finalApiKey = apiKeyInput || existing.api_key || "";
      const finalTokenKey =
        tokenAuthKeyInput !== undefined ? String(tokenAuthKeyInput || "").trim() : existing.token_auth_key || "";

      if (!finalApiKey) {
        res.status(400).json({ error: "يرجى إدخال API Key من لوحة Bunny.net" });
        return;
      }

      let resolvedApiKey = finalApiKey;
      let resolvedCdnHost = cdnHostname;
      let resolvedTokenKey = finalTokenKey;

      // If Library ID was omitted, try auto-discovering the first Stream Library using the Account API Key!
      if (!libraryId) {
        try {
          const listRes = await fetch("https://api.bunny.net/videolibrary?includeAccessKey=true", {
            headers: { AccessKey: finalApiKey, accept: "application/json" },
          });
          if (listRes.ok) {
            const libs: any = await listRes.json().catch(() => []);
            const firstLib = Array.isArray(libs) ? libs[0] : libs?.Items?.[0];
            if (firstLib?.Id) {
              libraryId = String(firstLib.Id);
              if (firstLib.ApiKey) resolvedApiKey = String(firstLib.ApiKey).trim();
              if (firstLib.PullZoneId) {
                try {
                  const pzRes = await fetch(`https://api.bunny.net/pullzone/${encodeURIComponent(String(firstLib.PullZoneId))}`, {
                    headers: { AccessKey: finalApiKey, accept: "application/json" },
                  });
                  if (pzRes.ok) {
                    const pz: any = await pzRes.json().catch(() => ({}));
                    if (!resolvedCdnHost && Array.isArray(pz?.Hostnames) && pz.Hostnames[0]?.Value) {
                      resolvedCdnHost = String(pz.Hostnames[0].Value).trim();
                    }
                    if (!resolvedTokenKey && pz?.ZoneSecurityEnabled && pz?.ZoneSecurityKey) {
                      resolvedTokenKey = String(pz.ZoneSecurityKey).trim();
                    }
                  }
                } catch {}
              }
            }
          }
        } catch {}
      }

      if (!libraryId) {
        res.status(400).json({ error: "يرجى إدخال Video Library ID الخاص بـ Bunny Stream" });
        return;
      }

      // Live verification against Bunny Stream API
      let testRes = await fetch(`https://video.bunnycdn.com/library/${encodeURIComponent(libraryId)}/videos?page=1&itemsPerPage=1`, {
        headers: { AccessKey: resolvedApiKey, accept: "application/json" },
      });

      // SMART FALLBACK: If user pasted their Bunny Account API Key (401 on Stream API),
      // auto-fetch the exact Stream Library API Key, CDN Hostname & Security Key from Bunny Account API!
      if (testRes.status === 401) {
        try {
          const accRes = await fetch(
            `https://api.bunny.net/videolibrary/${encodeURIComponent(libraryId)}?includeAccessKey=true`,
            { headers: { AccessKey: finalApiKey, accept: "application/json" } },
          );
          if (accRes.ok) {
            const libMeta: any = await accRes.json().catch(() => ({}));
            if (libMeta?.ApiKey) {
              resolvedApiKey = String(libMeta.ApiKey).trim();
            }
            if (!resolvedTokenKey && libMeta?.ApiAccessKey) {
              // Keep token key optional unless pullzone has ZoneSecurityEnabled
            }
            if (libMeta?.PullZoneId) {
              try {
                const pzRes = await fetch(`https://api.bunny.net/pullzone/${encodeURIComponent(String(libMeta.PullZoneId))}`, {
                  headers: { AccessKey: finalApiKey, accept: "application/json" },
                });
                if (pzRes.ok) {
                  const pz: any = await pzRes.json().catch(() => ({}));
                  if (!resolvedCdnHost && Array.isArray(pz?.Hostnames) && pz.Hostnames[0]?.Value) {
                    resolvedCdnHost = String(pz.Hostnames[0].Value).trim();
                  }
                  if (!resolvedTokenKey && pz?.ZoneSecurityEnabled && pz?.ZoneSecurityKey) {
                    resolvedTokenKey = String(pz.ZoneSecurityKey).trim();
                  }
                }
              } catch {}
            }
            // Retry Stream API with the newly resolved Library Stream API Key!
            testRes = await fetch(`https://video.bunnycdn.com/library/${encodeURIComponent(libraryId)}/videos?page=1&itemsPerPage=1`, {
              headers: { AccessKey: resolvedApiKey, accept: "application/json" },
            });
          }
        } catch {}
      }

      if (!testRes.ok) {
        res.status(400).json({
          error:
            testRes.status === 401
              ? "مفتاح API Key غير صحيح أو رقم Library ID غير مطابق للحساب — تأكد من نسخ مفتاح API Key الصحيح ورقم مكتبة الفيديو."
              : `تعذّر الاتصال بمكتبة Bunny (كود ${testRes.status}) — تأكد من Library ID و API Key.`,
        });
        return;
      }

      const testJson: any = await testRes.json().catch(() => ({}));
      await dbQuery(
        `UPDATE app_bunny_connection
         SET library_id = $1, api_key = $2, token_auth_key = $3, cdn_hostname = $4, updated_at = now()
         WHERE id = 1`,
        [libraryId, resolvedApiKey, resolvedTokenKey, resolvedCdnHost],
      );

      broadcastEvent("bunny_changed", { connected: true, libraryId });
      res.json({ ok: true, libraryId, cdnHostname: resolvedCdnHost, totalVideos: Number(testJson?.totalItems || 0) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "تعذّر حفظ إعدادات Bunny" });
    }
  });

  app.get("/api/admin/bunny/library", requireAdmin, async (_req, res) => {
    try {
      const conn = (await dbQuery("SELECT * FROM app_bunny_connection WHERE id = 1")).rows[0];
      if (!conn?.library_id || !conn?.api_key) {
        res.status(400).json({ error: "اربط مكتبة Bunny.net أولاً بإدخال Library ID و API Key" });
        return;
      }

      const libId = String(conn.library_id);
      const apiKey = String(conn.api_key);
      const cdnHost = String(conn.cdn_hostname || "").trim();

      // 1. Fetch all collections (folders)
      const collections: Array<{ guid: string; name: string; videoCount: number }> = [];
      for (let page = 1; page <= 5; page++) {
        const cRes = await fetch(
          `https://video.bunnycdn.com/library/${encodeURIComponent(libId)}/collections?page=${page}&itemsPerPage=100`,
          { headers: { AccessKey: apiKey, accept: "application/json" } },
        );
        if (!cRes.ok) break;
        const cJson: any = await cRes.json().catch(() => ({}));
        const items = Array.isArray(cJson?.items) ? cJson.items : [];
        for (const it of items) {
          collections.push({
            guid: String(it.guid || ""),
            name: String(it.name || "بدون اسم"),
            videoCount: Number(it.videoCount || 0),
          });
        }
        if (items.length < 100) break;
      }

      // 2. Fetch all videos (up to 1,000 videos across 10 pages)
      const existingLessons = (await dbQuery("SELECT youtube_video_id FROM app_lessons WHERE youtube_video_id LIKE 'bunny:%'")).rows;
      const importedSet = new Set(existingLessons.map((r: any) => String(r.youtube_video_id)));

      const videos: any[] = [];
      for (let page = 1; page <= 10; page++) {
        const vRes = await fetch(
          `https://video.bunnycdn.com/library/${encodeURIComponent(libId)}/videos?page=${page}&itemsPerPage=100&orderBy=date`,
          { headers: { AccessKey: apiKey, accept: "application/json" } },
        );
        if (!vRes.ok) {
          if (page === 1) {
            res.status(400).json({ error: `فشل جلب الفيديوهات من Bunny (${vRes.status})` });
            return;
          }
          break;
        }
        const vJson: any = await vRes.json().catch(() => ({}));
        const items = Array.isArray(vJson?.items) ? vJson.items : [];
        for (const v of items) {
          const guid = String(v.guid || "");
          if (!guid) continue;
          const thumbFile = String(v.thumbnailFileName || "thumbnail.jpg");
          const refKey = `bunny:${libId}:${guid}`;
          videos.push({
            guid,
            title: String(v.title || "فيديو بدون عنوان"),
            collectionId: String(v.collectionId || ""),
            length: Number(v.length || 0),
            durationLabel: fmtDurationSec(Number(v.length || 0)),
            status: Number(v.status ?? 4),
            views: Number(v.views || 0),
            storageSizeMB: Number(((Number(v.storageSize || 0)) / (1024 * 1024)).toFixed(1)),
            dateUploaded: v.dateUploaded || "",
            thumbnailUrl: cdnHost ? `https://${cdnHost}/${guid}/${thumbFile}` : "",
            alreadyImported: importedSet.has(refKey),
          });
        }
        if (items.length < 100) break;
      }

      res.json({ libraryId: libId, cdnHostname: cdnHost, collections, videos });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "تعذّر سحب الفيديوهات من Bunny" });
    }
  });

  app.post("/api/admin/bunny/import", requireAdmin, async (req, res) => {
    try {
      const conn = (await dbQuery("SELECT * FROM app_bunny_connection WHERE id = 1")).rows[0];
      if (!conn?.library_id || !conn?.api_key) {
        res.status(400).json({ error: "اربط مكتبة Bunny أولاً" });
        return;
      }

      const libId = String(conn.library_id);
      const {
        targetMode = "existing", // "existing" | "new_course" | "by_collection"
        courseId: reqCourseId = "",
        sectionId: reqSectionId = "",
        newCourseTitle = "",
        newCourseCategory = "عام",
        newCoursePrice = 0,
        videos = [],
        collectionsMap = {},
      } = req.body || {};

      if (!Array.isArray(videos) || videos.length === 0) {
        res.status(400).json({ error: "اختر فيديو واحداً على الأقل للاستيراد" });
        return;
      }

      let importedCount = 0;
      let skippedCount = 0;
      let createdCourses = 0;

      const insertVideoIntoSection = async (cId: string, sId: string, v: any, orderOffset: number) => {
        const guid = String(v.guid || "").trim();
        if (!guid) return false;
        const refKey = `bunny:${libId}:${guid}`;
        const dup = await dbQuery("SELECT id FROM app_lessons WHERE course_id = $1 AND youtube_video_id = $2 LIMIT 1", [
          cId,
          refKey,
        ]);
        if (dup.rows.length > 0) {
          skippedCount += 1;
          return false;
        }
        const embedUrl = `https://iframe.mediadelivery.net/embed/${libId}/${guid}`;
        await dbQuery(
          `INSERT INTO app_lessons (course_id, section_id, title, description, youtube_url, youtube_video_id, duration_label, attachment_url, is_free_preview, order_index)
           VALUES ($1, $2, $3, '', $4, $5, $6, '', false, $7)`,
          [
            cId,
            sId,
            String(v.title || "محاضرة").trim(),
            embedUrl,
            refKey,
            String(v.durationLabel || fmtDurationSec(Number(v.length || 0))),
            orderOffset,
          ],
        );
        if (v.thumbnailUrl) {
          await dbQuery(
            `UPDATE app_courses SET thumbnail_url = $1 WHERE id = $2 AND (thumbnail_url IS NULL OR thumbnail_url = '')`,
            [String(v.thumbnailUrl), cId],
          );
        }
        importedCount += 1;
        return true;
      };

      if (targetMode === "by_collection") {
        // Group videos by Bunny collectionId and auto-create a Course for each folder!
        const groups = new Map<string, any[]>();
        for (const v of videos) {
          const cid = String(v.collectionId || "__root__");
          if (!groups.has(cid)) groups.set(cid, []);
          groups.get(cid)!.push(v);
        }

        for (const [colId, colVideos] of groups.entries()) {
          const folderName =
            colId === "__root__"
              ? String(newCourseTitle || "فيديوهات مكتبة Bunny").trim()
              : String(collectionsMap[colId] || `كورس Bunny (${colId.slice(0, 6)})`).trim();

          // Reuse existing course with same title if already imported, else create fresh course
          let cRow = (await dbQuery("SELECT id FROM app_courses WHERE title = $1 LIMIT 1", [folderName])).rows[0];
          if (!cRow) {
            const firstThumb = colVideos.find((x: any) => x.thumbnailUrl)?.thumbnailUrl || "";
            cRow = (
              await dbQuery(
                `INSERT INTO app_courses (title, subtitle, description, category, price, thumbnail_url, is_published)
                 VALUES ($1, '', '', $2, $3, $4, true) RETURNING id`,
                [folderName, String(newCourseCategory || "عام"), Number(newCoursePrice) || 0, firstThumb],
              )
            ).rows[0];
            createdCourses += 1;
          }

          let sRow = (
            await dbQuery("SELECT id FROM app_sections WHERE course_id = $1 ORDER BY order_index ASC LIMIT 1", [cRow.id])
          ).rows[0];
          if (!sRow) {
            sRow = (
              await dbQuery("INSERT INTO app_sections (course_id, title, order_index) VALUES ($1, 'المحاضرات', 0) RETURNING id", [
                cRow.id,
              ])
            ).rows[0];
          }

          let orderIdx =
            (await dbQuery("SELECT COUNT(*)::int AS c FROM app_lessons WHERE section_id = $1", [sRow.id])).rows[0]?.c || 0;

          // Import chronologically (oldest first = Lesson 1, Lesson 2...)
          const ordered = [...colVideos].reverse();
          for (const v of ordered) {
            const added = await insertVideoIntoSection(cRow.id, sRow.id, v, orderIdx);
            if (added) orderIdx += 1;
          }
        }
      } else {
        let targetCourseId = String(reqCourseId || "");
        let targetSectionId = String(reqSectionId || "");

        if (targetMode === "new_course") {
          const title = String(newCourseTitle || "").trim();
          if (!title) {
            res.status(400).json({ error: "اكتب اسم الكورس الجديد أولاً" });
            return;
          }
          const firstThumb = videos.find((x: any) => x.thumbnailUrl)?.thumbnailUrl || "";
          const cIns = await dbQuery(
            `INSERT INTO app_courses (title, subtitle, description, category, price, thumbnail_url, is_published)
             VALUES ($1, '', '', $2, $3, $4, true) RETURNING id`,
            [title, String(newCourseCategory || "عام"), Number(newCoursePrice) || 0, firstThumb],
          );
          targetCourseId = cIns.rows[0].id;
          createdCourses += 1;
          const sIns = await dbQuery(
            "INSERT INTO app_sections (course_id, title, order_index) VALUES ($1, 'الفصل الأول — المحاضرات', 0) RETURNING id",
            [targetCourseId],
          );
          targetSectionId = sIns.rows[0].id;
        } else {
          if (!targetCourseId) {
            res.status(400).json({ error: "اختر الكورس المستهدف أولاً" });
            return;
          }
          if (!targetSectionId) {
            const sec = (
              await dbQuery("SELECT id FROM app_sections WHERE course_id = $1 ORDER BY order_index ASC LIMIT 1", [
                targetCourseId,
              ])
            ).rows[0];
            if (sec) {
              targetSectionId = sec.id;
            } else {
              const sIns = await dbQuery(
                "INSERT INTO app_sections (course_id, title, order_index) VALUES ($1, 'الفصل الأول — المحاضرات', 0) RETURNING id",
                [targetCourseId],
              );
              targetSectionId = sIns.rows[0].id;
            }
          }
        }

        let orderIdx =
          (await dbQuery("SELECT COUNT(*)::int AS c FROM app_lessons WHERE section_id = $1", [targetSectionId])).rows[0]
            ?.c || 0;

        for (const v of videos) {
          const added = await insertVideoIntoSection(targetCourseId, targetSectionId, v, orderIdx);
          if (added) orderIdx += 1;
        }
      }

      broadcastEvent("courses_changed", { source: "bunny_import", importedCount });
      broadcastEvent("lessons_changed", { source: "bunny_import", importedCount });
      res.json({ ok: true, importedCount, skippedCount, createdCourses });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "تعذّر استيراد فيديوهات Bunny" });
    }
  });

  // Student Signed Bunny Stream Embed URL (protects locked lessons + signs SHA-256 Token Auth if configured)
  app.get("/api/student/bunny-embed/:lessonId", requireAuth, async (req: AuthedReq, res) => {
    try {
      const userId = req.auth!.sub;
      const isAdmin = req.auth!.role === "admin";
      const lessonRes = await dbQuery("SELECT * FROM app_lessons WHERE id = $1 LIMIT 1", [req.params.lessonId]);
      const lesson = lessonRes.rows[0];
      if (!lesson) {
        res.status(404).json({ error: "المحاضرة غير موجودة" });
        return;
      }

      if (!isAdmin && !lesson.is_free_preview) {
        const enr = await dbQuery("SELECT id FROM app_enrollments WHERE user_id = $1 AND course_id = $2 LIMIT 1", [
          userId,
          lesson.course_id,
        ]);
        if (enr.rows.length === 0) {
          res.status(403).json({ error: "اشترك في الكورس أولاً لمشاهدة هذه المحاضرة" });
          return;
        }
      }

      const ref = String(lesson.youtube_video_id || "");
      const m = ref.match(/^bunny:(\d+):([0-9a-fA-F-]{36})$/);
      if (!m) {
        res.status(400).json({ error: "هذا الدرس ليس فيديو Bunny" });
        return;
      }

      const [, libId, guid] = m;
      const conn = (await dbQuery("SELECT token_auth_key FROM app_bunny_connection WHERE id = 1")).rows[0];
      const tokenKey = String(conn?.token_auth_key || "").trim();

      let embedUrl = `https://iframe.mediadelivery.net/embed/${libId}/${guid}?autoplay=false&loop=false&muted=false&preload=true&responsive=true`;
      if (tokenKey) {
        const expires = Math.floor(Date.now() / 1000) + 4 * 3600; // 4-hour expiring signed token
        const token = crypto.createHash("sha256").update(`${tokenKey}${guid}${expires}`).digest("hex");
        embedUrl = `https://iframe.mediadelivery.net/embed/${libId}/${guid}?token=${token}&expires=${expires}&autoplay=false&loop=false&muted=false&preload=true&responsive=true`;
      }

      res.json({ embedUrl, libraryId: libId, guid });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "تعذّر تجهيز رابط تشغيل Bunny" });
    }
  });

  // ============================================================================
  // 7. Cloud Auto-Migrator: Bunny.net Stream -> YouTube (Unlisted) -> Platform
  // ============================================================================
  interface MigrationJobState {
    running: boolean;
    cancelled: boolean;
    total: number;
    completed: number;
    failed: number;
    currentTitle: string;
    currentStage: string; // "downloading_bunny" | "uploading_youtube" | "publishing" | "done" | "error"
    currentPercent: number;
    logs: Array<{ guid: string; title: string; status: "done" | "error" | "skipped"; youtubeUrl?: string; message?: string }>;
    startedAt: string | null;
    finishedAt: string | null;
  }

  const migrationJob: MigrationJobState = {
    running: false,
    cancelled: false,
    total: 0,
    completed: 0,
    failed: 0,
    currentTitle: "",
    currentStage: "idle",
    currentPercent: 0,
    logs: [],
    startedAt: null,
    finishedAt: null,
  };

  const emitMigrationUpdate = () => {
    broadcastEvent("bunny_migration_progress", { ...migrationJob });
  };

  function signBunnyCdnUrl(cdnHost: string, urlPath: string, tokenKey: string): string {
    const cleanPath = urlPath.startsWith("/") ? urlPath : `/${urlPath}`;
    if (!tokenKey) return `https://${cdnHost}${cleanPath}`;
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const raw = `${tokenKey}${cleanPath}${expires}`;
    const hash = crypto
      .createHash("sha256")
      .update(raw)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    return `https://${cdnHost}${cleanPath}?token=${hash}&expires=${expires}`;
  }

  async function downloadBunnyVideoToFile(
    libId: string,
    apiKey: string,
    cdnHost: string,
    tokenKey: string,
    guid: string,
    destFile: string,
    onPct: (pct: number) => void,
  ): Promise<void> {
    if (!cdnHost) {
      throw new Error("يرجى كتابة CDN Hostname في إعدادات Bunny (مثل vz-xxxxxx.b-cdn.net) ليتمكن السيرفر من سحب ملف الفيديو.");
    }

    // 1. Fetch exact video metadata from Bunny API to discover available MP4 resolutions
    let resolutions = ["1080p", "720p", "480p", "360p"];
    try {
      const metaRes = await fetch(`https://video.bunnycdn.com/library/${encodeURIComponent(libId)}/videos/${encodeURIComponent(guid)}`, {
        headers: { AccessKey: apiKey, accept: "application/json" },
      });
      if (metaRes.ok) {
        const meta: any = await metaRes.json().catch(() => ({}));
        if (meta?.availableResolutions) {
          const parsed = String(meta.availableResolutions)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
          if (parsed.length > 0) resolutions = parsed;
        }
      }
    } catch {}

    const candidatePaths = [...resolutions.map((r) => `/${guid}/play_${r}.mp4`), `/${guid}/original`];

    // 2. Try direct high-speed MP4 download first (zero CPU overhead!)
    for (const p of candidatePaths) {
      if (migrationJob.cancelled) throw new Error("تم إيقاف النقل");
      const url = signBunnyCdnUrl(cdnHost, p, tokenKey);
      try {
        const resp = await fetch(url, {
          headers: {
            Referer: "https://iframe.mediadelivery.net/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/134.0.0.0 Safari/537.36",
          },
        });
        if (!resp.ok || !resp.body) continue;
        const ctype = String(resp.headers.get("content-type") || "");
        if (ctype.includes("text/html")) continue;

        const totalBytes = Number(resp.headers.get("content-length") || 0);
        const ws = fs.createWriteStream(destFile);
        const reader = resp.body.getReader();
        let received = 0;

        try {
          while (true) {
            if (migrationJob.cancelled) {
              reader.cancel().catch(() => {});
              throw new Error("تم إيقاف النقل");
            }
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              ws.write(Buffer.from(value));
              received += value.byteLength;
              if (totalBytes > 0) {
                onPct(Math.min(99, Math.round((received / totalBytes) * 100)));
              }
            }
          }
        } finally {
          await new Promise<void>((resolve) => ws.end(() => resolve()));
        }

        const stat = fs.statSync(destFile);
        if (stat.size > 100 * 1024) {
          onPct(100);
          return;
        }
      } catch (err: any) {
        if (String(err?.message).includes("إيقاف")) throw err;
      }
    }

    // 3. Fallback: Remux HLS stream (.m3u8) losslessly via ffmpeg into MP4 (works even when Bunny MP4 Fallback is OFF!)
    const hlsUrl = signBunnyCdnUrl(cdnHost, `/${guid}/playlist.m3u8`, tokenKey);
    await new Promise<void>((resolve, reject) => {
      const ff = spawn(
        "ffmpeg",
        [
          "-y",
          "-headers",
          "Referer: https://iframe.mediadelivery.net/\r\n",
          "-i",
          hlsUrl,
          "-c",
          "copy",
          "-bsf:a",
          "aac_adtstoasc",
          "-movflags",
          "+faststart",
          destFile,
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );

      let stderrTail = "";
      ff.stderr.on("data", (chunk) => {
        stderrTail = (stderrTail + String(chunk)).slice(-500);
      });
      ff.on("error", () => {
        reject(
          new Error(
            "تعذّر سحب ملف MP4 من Bunny (فعّل خيار MP4 Fallback في إعدادات Bunny Stream ← Encoding أو تأكد من CDN Hostname).",
          ),
        );
      });
      ff.on("close", (code) => {
        if (code === 0 && fs.existsSync(destFile) && fs.statSync(destFile).size > 50 * 1024) {
          onPct(100);
          resolve();
        } else {
          reject(new Error(`تعذّر سحب الفيديو من Bunny (ffmpeg ${code}): ${stderrTail.slice(-160)}`));
        }
      });
    });
  }

  async function uploadLocalFileToYouTubeUnlisted(
    filePath: string,
    title: string,
    description: string,
    onPct: (pct: number) => void,
  ): Promise<{ videoId: string; youtubeUrl: string; privacyStatus: string }> {
    const stat = fs.statSync(filePath);
    const totalSize = stat.size;
    const accessToken = await getValidYouTubeAccessToken();

    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Length": String(totalSize),
          "X-Upload-Content-Type": "video/mp4",
        },
        body: JSON.stringify({
          snippet: {
            title: title.slice(0, 100),
            description: (description || "محاضرة محمية — منصة Idea Courses — بشمهندس ميدو شلبي").slice(0, 4800),
            categoryId: "27",
          },
          status: {
            privacyStatus: "unlisted", // غير مدرج تلقائياً — باللينك فقط!
            embeddable: true,
            selfDeclaredMadeForKids: false,
          },
        }),
      },
    );

    if (!initRes.ok) {
      const errTxt = await initRes.text().catch(() => "");
      if (errTxt.includes("quotaExceeded")) {
        throw new Error("انتهت الحصة اليومية المجانية لرفع يوتيوب (YouTube API Quota) — أكمل باقي الفيديوهات غداً تلقائياً.");
      }
      throw new Error(`رفض يوتيوب بدء الرفع (${initRes.status}): ${errTxt.slice(0, 180)}`);
    }

    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) throw new Error("لم يرجع يوتيوب رابط الرفع");

    const chunkSize = 8 * 1024 * 1024; // 8MB exact multiple of 256KB
    const fh = await fs.promises.open(filePath, "r");
    let offset = 0;

    try {
      while (offset < totalSize) {
        if (migrationJob.cancelled) throw new Error("تم إيقاف النقل");
        const len = Math.min(chunkSize, totalSize - offset);
        const buf = Buffer.allocUnsafe(len);
        await fh.read(buf, 0, len, offset);
        const end = offset + len - 1;

        const freshToken = await getValidYouTubeAccessToken();
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${freshToken}`,
            "Content-Type": "video/mp4",
            "Content-Length": String(len),
            "Content-Range": `bytes ${offset}-${end}/${totalSize}`,
          },
          body: new Uint8Array(buf),
        });

        if (putRes.status === 308) {
          offset = end + 1;
          onPct(Math.min(99, Math.round((offset / totalSize) * 100)));
          continue;
        }

        if (putRes.status === 200 || putRes.status === 201) {
          const ytJson: any = await putRes.json().catch(() => ({}));
          const videoId = String(ytJson?.id || "");
          if (!videoId) throw new Error("لم يرجع يوتيوب معرّف الفيديو");
          onPct(100);
          return {
            videoId,
            youtubeUrl: `https://youtu.be/${videoId}`,
            privacyStatus: String(ytJson?.status?.privacyStatus || "unlisted"),
          };
        }

        const errB = await putRes.text().catch(() => "");
        throw new Error(`فشل رفع جزء إلى يوتيوب (${putRes.status}): ${errB.slice(0, 160)}`);
      }
    } finally {
      await fh.close().catch(() => {});
    }

    throw new Error("انتهى الملف بدون تأكيد من يوتيوب");
  }

  app.get("/api/admin/bunny/migration-status", requireAdmin, (_req, res) => {
    res.json({ job: migrationJob });
  });

  app.post("/api/admin/bunny/migration-cancel", requireAdmin, (_req, res) => {
    migrationJob.cancelled = true;
    emitMigrationUpdate();
    res.json({ ok: true });
  });

  app.post("/api/admin/bunny/migrate-to-youtube", requireAdmin, async (req, res) => {
    try {
      if (migrationJob.running) {
        res.status(409).json({ error: "توجد عملية نقل شغالة حالياً — انتظر انتهاءها أو أوقفها أولاً" });
        return;
      }

      const bunnyConn = (await dbQuery("SELECT * FROM app_bunny_connection WHERE id = 1")).rows[0];
      if (!bunnyConn?.library_id || !bunnyConn?.api_key) {
        res.status(400).json({ error: "اربط مكتبة Bunny.net أولاً" });
        return;
      }
      if (!bunnyConn?.cdn_hostname) {
        res.status(400).json({
          error: "يرجى إدخال CDN Hostname في إعدادات Bunny (مثل vz-xxxxxx.b-cdn.net) ليتمكن السيرفر من تنزيل الفيديوهات ورفعها على يوتيوب.",
        });
        return;
      }

      // Verify YouTube channel is connected before starting!
      await getValidYouTubeAccessToken();

      const {
        targetMode = "by_collection",
        courseId: reqCourseId = "",
        sectionId: reqSectionId = "",
        newCourseTitle = "",
        newCourseCategory = "عام",
        newCoursePrice = 0,
        videos = [],
        collectionsMap = {},
      } = req.body || {};

      if (!Array.isArray(videos) || videos.length === 0) {
        res.status(400).json({ error: "حدد فيديو واحداً على الأقل للنقل إلى يوتيوب" });
        return;
      }

      // Initialize job state & return immediately while cloud server transfers in background!
      migrationJob.running = true;
      migrationJob.cancelled = false;
      migrationJob.total = videos.length;
      migrationJob.completed = 0;
      migrationJob.failed = 0;
      migrationJob.currentTitle = videos[0]?.title || "";
      migrationJob.currentStage = "downloading_bunny";
      migrationJob.currentPercent = 0;
      migrationJob.logs = [];
      migrationJob.startedAt = new Date().toISOString();
      migrationJob.finishedAt = null;
      emitMigrationUpdate();

      res.json({ ok: true, started: true, total: videos.length });

      // Background Cloud-to-Cloud Transfer Loop (Bunny -> Railway -> YouTube Unlisted -> Platform DB)
      void (async () => {
        const libId = String(bunnyConn.library_id);
        const apiKey = String(bunnyConn.api_key);
        const cdnHost = String(bunnyConn.cdn_hostname);
        const tokenKey = String(bunnyConn.token_auth_key || "");

        // Helper to resolve/create destination course & section for each video
        const courseSectionCache = new Map<string, { courseId: string; sectionId: string }>();
        const resolveDestination = async (v: any): Promise<{ courseId: string; sectionId: string }> => {
          if (targetMode === "by_collection") {
            const colId = String(v.collectionId || "__root__");
            if (courseSectionCache.has(colId)) return courseSectionCache.get(colId)!;
            const folderName =
              colId === "__root__"
                ? String(newCourseTitle || "كورسات منقولة من Bunny").trim()
                : String(collectionsMap[colId] || `كورس (${colId.slice(0, 6)})`).trim();

            let cRow = (await dbQuery("SELECT id FROM app_courses WHERE title = $1 LIMIT 1", [folderName])).rows[0];
            if (!cRow) {
              cRow = (
                await dbQuery(
                  `INSERT INTO app_courses (title, subtitle, description, category, price, thumbnail_url, is_published)
                   VALUES ($1, '', '', $2, $3, $4, true) RETURNING id`,
                  [folderName, String(newCourseCategory || "عام"), Number(newCoursePrice) || 0, String(v.thumbnailUrl || "")],
                )
              ).rows[0];
            }
            let sRow = (
              await dbQuery("SELECT id FROM app_sections WHERE course_id = $1 ORDER BY order_index ASC LIMIT 1", [cRow.id])
            ).rows[0];
            if (!sRow) {
              sRow = (
                await dbQuery("INSERT INTO app_sections (course_id, title, order_index) VALUES ($1, 'المحاضرات', 0) RETURNING id", [
                  cRow.id,
                ])
              ).rows[0];
            }
            const pair = { courseId: cRow.id, sectionId: sRow.id };
            courseSectionCache.set(colId, pair);
            return pair;
          }

          if (targetMode === "new_course") {
            if (courseSectionCache.has("__new__")) return courseSectionCache.get("__new__")!;
            const title = String(newCourseTitle || "كورس جديد من Bunny").trim();
            const cIns = await dbQuery(
              `INSERT INTO app_courses (title, subtitle, description, category, price, thumbnail_url, is_published)
               VALUES ($1, '', '', $2, $3, $4, true) RETURNING id`,
              [title, String(newCourseCategory || "عام"), Number(newCoursePrice) || 0, String(v.thumbnailUrl || "")],
            );
            const sIns = await dbQuery(
              "INSERT INTO app_sections (course_id, title, order_index) VALUES ($1, 'الفصل الأول — المحاضرات', 0) RETURNING id",
              [cIns.rows[0].id],
            );
            const pair = { courseId: cIns.rows[0].id, sectionId: sIns.rows[0].id };
            courseSectionCache.set("__new__", pair);
            return pair;
          }

          // Existing course
          if (courseSectionCache.has("__existing__")) return courseSectionCache.get("__existing__")!;
          let sId = String(reqSectionId || "");
          if (!sId) {
            const sec = (
              await dbQuery("SELECT id FROM app_sections WHERE course_id = $1 ORDER BY order_index ASC LIMIT 1", [reqCourseId])
            ).rows[0];
            sId = sec
              ? sec.id
              : (
                  await dbQuery("INSERT INTO app_sections (course_id, title, order_index) VALUES ($1, 'المحاضرات', 0) RETURNING id", [
                    reqCourseId,
                  ])
                ).rows[0].id;
          }
          const pair = { courseId: String(reqCourseId), sectionId: sId };
          courseSectionCache.set("__existing__", pair);
          return pair;
        };

        for (const v of videos) {
          if (migrationJob.cancelled) break;
          const guid = String(v.guid || "").trim();
          const title = String(v.title || "محاضرة").trim();
          const tmpFile = path.join(os.tmpdir(), `bunny-yt-${guid}-${Date.now()}.mp4`);

          migrationJob.currentTitle = title;
          migrationJob.currentStage = "downloading_bunny";
          migrationJob.currentPercent = 0;
          emitMigrationUpdate();

          try {
            // Step 1: Pull video from Bunny CDN to temp file
            await downloadBunnyVideoToFile(libId, apiKey, cdnHost, tokenKey, guid, tmpFile, (pct) => {
              migrationJob.currentPercent = Math.round(pct * 0.45); // 0..45%
              emitMigrationUpdate();
            });

            // Step 2: Upload to connected YouTube Channel as Unlisted!
            migrationJob.currentStage = "uploading_youtube";
            migrationJob.currentPercent = 48;
            emitMigrationUpdate();

            const ytRes = await uploadLocalFileToYouTubeUnlisted(tmpFile, title, "", (pct) => {
              migrationJob.currentPercent = 48 + Math.round(pct * 0.48); // 48..96%
              emitMigrationUpdate();
            });

            // Step 3: Publish / Upgrade Lesson in Platform DB immediately!
            migrationJob.currentStage = "publishing";
            migrationJob.currentPercent = 98;
            emitMigrationUpdate();

            const dest = await resolveDestination(v);
            const bunnyRef = `bunny:${libId}:${guid}`;
            const existingBunnyLesson = await dbQuery("SELECT id FROM app_lessons WHERE youtube_video_id = $1 LIMIT 1", [bunnyRef]);

            if (existingBunnyLesson.rows.length > 0) {
              // Upgrade existing Bunny lesson directly to YouTube Unlisted!
              await dbQuery(
                "UPDATE app_lessons SET youtube_url = $1, youtube_video_id = $2 WHERE id = $3",
                [ytRes.youtubeUrl, ytRes.videoId, existingBunnyLesson.rows[0].id],
              );
            } else {
              const cnt =
                (await dbQuery("SELECT COUNT(*)::int AS c FROM app_lessons WHERE section_id = $1", [dest.sectionId])).rows[0]
                  ?.c || 0;
              await dbQuery(
                `INSERT INTO app_lessons (course_id, section_id, title, description, youtube_url, youtube_video_id, duration_label, attachment_url, is_free_preview, order_index)
                 VALUES ($1, $2, $3, '', $4, $5, $6, '', false, $7)`,
                [
                  dest.courseId,
                  dest.sectionId,
                  title,
                  ytRes.youtubeUrl,
                  ytRes.videoId,
                  String(v.durationLabel || fmtDurationSec(Number(v.length || 0))),
                  cnt,
                ],
              );
            }

            // Fill course thumbnail if empty
            await dbQuery(
              `UPDATE app_courses SET thumbnail_url = $1 WHERE id = $2 AND (thumbnail_url IS NULL OR thumbnail_url = '')`,
              [`https://i.ytimg.com/vi/${ytRes.videoId}/hqdefault.jpg`, dest.courseId],
            );

            migrationJob.completed += 1;
            migrationJob.currentPercent = 100;
            migrationJob.logs.unshift({
              guid,
              title,
              status: "done",
              youtubeUrl: ytRes.youtubeUrl,
              message:
                ytRes.privacyStatus === "private"
                  ? "رُفع على يوتيوب (Private مؤقتاً لحين توثيق Google Cloud) ونُشر بالمنصة"
                  : "تم السحب من Bunny والرفع على يوتيوب (غير مدرج) والنشر في المنصة ✓",
            });
            broadcastEvent("courses_changed", { source: "bunny_to_youtube" });
            broadcastEvent("lessons_changed", { source: "bunny_to_youtube" });
            emitMigrationUpdate();
          } catch (err: any) {
            migrationJob.failed += 1;
            migrationJob.logs.unshift({
              guid,
              title,
              status: "error",
              message: err?.message || "فشل نقل الفيديو",
            });
            emitMigrationUpdate();
            // Stop loop immediately if YouTube daily quota exceeded
            if (String(err?.message || "").includes("Quota") || String(err?.message || "").includes("الحصة اليومية")) {
              break;
            }
          } finally {
            fs.promises.unlink(tmpFile).catch(() => {});
          }
        }

        migrationJob.running = false;
        migrationJob.currentStage = migrationJob.cancelled ? "cancelled" : "done";
        migrationJob.finishedAt = new Date().toISOString();
        emitMigrationUpdate();
      })();
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "تعذّر بدء النقل من Bunny إلى يوتيوب" });
    }
  });

  // Serve Clean App SPA (`app-ui/dist`)
  const appUiDist = path.resolve(SERVER_ROOT, "../app-ui/dist");
  if (fs.existsSync(appUiDist)) {
    app.use(
      express.static(appUiDist, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith("index.html")) {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          }
        },
      }),
    );
    app.get("/{*splat}", (req, res, next) => {
      if (req.path.startsWith("/api/")) {
        next();
        return;
      }
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(path.join(appUiDist, "index.html"));
    });
  }

  // WebSocket Server for Live Presence & Instant Multi-Device Sync
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    const client: WsClient = { ws, userId: null, userName: "", role: "student", platform: "web" };
    wsClients.add(client);

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg?.type === "identify" && msg.token) {
          const decoded = jwt.verify(String(msg.token), config.jwtSecret) as AuthPayload;
          client.userId = decoded.sub;
          client.role = decoded.role;
          client.platform = msg.platform === "desktop" || msg.platform === "mobile" ? msg.platform : "web";
          broadcastEvent("presence_changed", { onlineCount: Object.keys(getOnlineUsersMap()).length });
        }
      } catch {}
    });

    ws.on("close", () => {
      wsClients.delete(client);
      broadcastEvent("presence_changed", { onlineCount: Object.keys(getOnlineUsersMap()).length });
    });
  });

  server.listen(config.port, "0.0.0.0", () => {
    console.log(`\n🚀 Clean YouTube-Powered Apps Cloud Server running on port ${config.port}`);
    console.log(`📦 DB Mode: ${db.mode.toUpperCase()}`);
    console.log(`🔑 Admin: ${config.seedAdminEmail} / ${config.seedAdminPassword}\n`);
  });
}

bootstrap().catch((err) => {
  console.error("[apps-server] Fatal error:", err);
  process.exit(1);
});
