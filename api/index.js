import express from "express";
import cors from "cors";
import pg from "pg";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const { Pool } = pg;

const app = express();
app.set("trust proxy", 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

const CONNECTION_STRING =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_Yeu12bSqwCBF@ep-noisy-poetry-bdyesu0x-pooler.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "edunova-csharp-prod-jwt-secret-9f8e7d6c5b4a3210-medo-shalaby-2026";

const pool = new Pool({
  connectionString: CONNECTION_STRING,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Auth Middleware
// ---------------------------------------------------------------------------
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "تسجيل الدخول مطلوب" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "رمز المصادقة غير صالح أو منتهي الصلاحية" });
  }
}

function requireAdmin(req, res, next) {
  authenticate(req, res, () => {
    if (req.user && req.user.role === "admin") {
      next();
    } else {
      res.status(403).json({ error: "صلاحية الأدمن مطلوبة" });
    }
  });
}

// ---------------------------------------------------------------------------
// 1. Health & Config
// ---------------------------------------------------------------------------
app.get("/api/health", async (req, res) => {
  try {
    const cfgRes = await query("SELECT * FROM app_config LIMIT 1");
    res.json({
      ok: true,
      service: "edunova-vercel-serverless-api",
      engine: "Vercel Serverless (24/7 Free Forever)",
      db: "Neon PostgreSQL 18",
      config: cfgRes.rows[0] || null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/config", async (req, res) => {
  try {
    const cfgRes = await query("SELECT * FROM app_config LIMIT 1");
    if (!cfgRes.rows.length) {
      return res.status(404).json({ error: "Config not found" });
    }
    res.json(cfgRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 2. Authentication
// ---------------------------------------------------------------------------
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, phone, password, deviceId, deviceName } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "يرجى ملء جميع الحقول المطلوبة" });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const existing = await query("SELECT id FROM app_users WHERE email = $1", [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "البريد الإلكتروني مسجل بالفعل" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const insertRes = await query(
      `INSERT INTO app_users (id, name, email, password_hash, role, phone, is_banned, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'student', $4, false, NOW())
       RETURNING id, name, email, role, phone, is_banned, created_at`,
      [String(name).trim(), cleanEmail, hashed, phone ? String(phone).trim() : null]
    );
    const user = insertRes.rows[0];

    // Hardware lock
    if (deviceId) {
      await query(
        `INSERT INTO app_user_devices (id, user_id, device_id, device_label, platform, last_active_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 'web', NOW())
         ON CONFLICT (user_id, device_id) DO UPDATE SET last_active_at = NOW()`,
        [user.id, String(deviceId), deviceName ? String(deviceName) : "Default Device"]
      );
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, deviceId, deviceName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "البريد الإلكتروني وكلمة المرور مطلوبان" });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const userRes = await query("SELECT * FROM app_users WHERE email = $1", [cleanEmail]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    }

    const user = userRes.rows[0];
    if (user.is_banned === true) {
      return res.status(403).json({ error: "هذا الحساب محظور، يرجى التواصل مع الإدارة" });
    }

    const validPass = await bcrypt.compare(password, user.password_hash);
    if (!validPass) {
      return res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    }

    // Hardware Lock for Students
    if (user.role === "student" && deviceId) {
      const cfgRes = await query("SELECT max_devices FROM app_config LIMIT 1");
      const maxDevices = cfgRes.rows[0]?.max_devices || 1;

      const devicesRes = await query(
        "SELECT * FROM app_user_devices WHERE user_id = $1 ORDER BY last_active_at ASC",
        [user.id]
      );
      const userDevices = devicesRes.rows;
      const matched = userDevices.find((d) => d.device_id === String(deviceId));

      if (!matched) {
        if (userDevices.length >= maxDevices) {
          return res.status(403).json({
            error: "عفواً، لقد استنفدت الحد المسموح به من الأجهزة المسجلة لحسابك. تواصل مع الدعم لفك ربط الجهاز.",
          });
        }
        await query(
          `INSERT INTO app_user_devices (id, user_id, device_id, device_label, platform, last_active_at)
           VALUES (gen_random_uuid(), $1, $2, $3, 'web', NOW())`,
          [user.id, String(deviceId), deviceName ? String(deviceName) : "Student Device"]
        );
      } else {
        await query(
          "UPDATE app_user_devices SET last_active_at = NOW() WHERE user_id = $1 AND device_id = $2",
          [user.id, String(deviceId)]
        );
      }
    }

    await query("UPDATE app_users SET last_seen_at = NOW() WHERE id = $1", [user.id]);

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    const { password_hash: _, ...cleanUser } = user;
    res.json({ token, user: cleanUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/auth/me", authenticate, async (req, res) => {
  try {
    const userRes = await query(
      "SELECT id, name, email, phone, role, is_banned, last_seen_at, created_at FROM app_users WHERE id = $1",
      [req.user.sub]
    );
    if (!userRes.rows.length) {
      return res.status(404).json({ error: "المستخدم غير موجود" });
    }
    res.json({ user: userRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 3. Student Endpoints
// ---------------------------------------------------------------------------
app.get("/api/student/courses", authenticate, async (req, res) => {
  try {
    const userId = req.user.sub;
    const coursesRes = await query(`
      SELECT c.*,
             (SELECT COUNT(*) FROM app_sections s WHERE s.course_id = c.id) AS sections_count,
             (SELECT COUNT(*) FROM app_lessons l WHERE l.course_id = c.id) AS lessons_count,
             EXISTS(SELECT 1 FROM app_enrollments e WHERE e.course_id = c.id AND e.user_id = $1) AS is_enrolled
      FROM app_courses c
      WHERE c.is_published = true
      ORDER BY c.created_at DESC
    `, [userId]);
    res.json({ courses: coursesRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/student/courses/:id", authenticate, async (req, res) => {
  try {
    const userId = req.user.sub;
    const courseId = req.params.id;

    const courseRes = await query(`
      SELECT c.*,
             EXISTS(SELECT 1 FROM app_enrollments e WHERE e.course_id = c.id AND e.user_id = $1) AS is_enrolled
      FROM app_courses c
      WHERE c.id = $2
    `, [userId, courseId]);

    if (!courseRes.rows.length) {
      return res.status(404).json({ error: "الكورس غير موجود" });
    }

    const course = courseRes.rows[0];
    const isEnrolled = course.is_enrolled || req.user.role === "admin";

    const sectionsRes = await query(
      "SELECT * FROM app_sections WHERE course_id = $1 ORDER BY sort_order ASC",
      [courseId]
    );

    const sections = [];
    for (const sec of sectionsRes.rows) {
      const lessonsRes = await query(`
        SELECT l.*,
               EXISTS(SELECT 1 FROM app_lesson_progress lp WHERE lp.lesson_id = l.id AND lp.user_id = $1 AND lp.is_completed = true) AS is_completed
        FROM app_lessons l
        WHERE l.section_id = $2
        ORDER BY l.sort_order ASC
      `, [userId, sec.id]);

      const lessons = lessonsRes.rows.map((lesson) => {
        const canWatch = isEnrolled || lesson.is_free_preview;
        return {
          id: lesson.id,
          section_id: lesson.section_id,
          course_id: lesson.course_id,
          title: lesson.title,
          description: lesson.description,
          duration_minutes: lesson.duration_minutes,
          is_free_preview: lesson.is_free_preview,
          sort_order: lesson.sort_order,
          is_completed: lesson.is_completed,
          is_locked: !canWatch,
          video_url: canWatch ? lesson.video_id : null,
          video_type: "youtube",
          watermark_text: canWatch ? `${req.user.name || "Student"} • ${req.user.email || ""}` : null,
        };
      });

      sections.push({ ...sec, lessons });
    }

    res.json({ course: { ...course, sections } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/student/lessons/:id/complete", authenticate, async (req, res) => {
  try {
    const userId = req.user.sub;
    const lessonId = req.params.id;
    await query(
      `INSERT INTO app_lesson_progress (user_id, lesson_id, is_completed, completed_at)
       VALUES ($1, $2, true, NOW())
       ON CONFLICT (user_id, lesson_id) DO UPDATE SET is_completed = true, completed_at = NOW()`,
      [userId, lessonId]
    );
    res.json({ ok: true, completed: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/student/enroll-code", authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "كود التفعيل مطلوب" });

    const cleanCode = String(code).trim().toUpperCase();
    const codeRes = await query(
      "SELECT * FROM app_activation_codes WHERE code = $1 AND is_used = false",
      [cleanCode]
    );
    if (!codeRes.rows.length) {
      return res.status(400).json({ error: "كود التفعيل غير صالح أو تم استخدامه من قبل" });
    }

    const actCode = codeRes.rows[0];
    const userId = req.user.sub;

    await query(
      `INSERT INTO app_enrollments (user_id, course_id, enrolled_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, course_id) DO NOTHING`,
      [userId, actCode.course_id]
    );

    await query(
      "UPDATE app_activation_codes SET is_used = true, used_by_user_id = $1, used_at = NOW() WHERE id = $2",
      [userId, actCode.id]
    );

    res.json({ ok: true, message: "تم تفعيل الكورس بنجاح!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/student/payment-requests", authenticate, async (req, res) => {
  try {
    const { courseId, paymentMethod, senderPhone, receiptUrl, amount, notes } = req.body;
    if (!courseId) {
      return res.status(400).json({ error: "الكورس مطلوب" });
    }
    const userId = req.user.sub;
    const insertRes = await query(
      `INSERT INTO app_payment_requests (id, user_id, course_id, amount, payment_method, sender_phone, receipt_url, status, notes, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'pending', $7, NOW())
       RETURNING *`,
      [
        userId,
        courseId,
        amount || 0,
        paymentMethod || "vodafone_cash",
        senderPhone || null,
        receiptUrl || null,
        notes || null,
      ]
    );
    res.json({ ok: true, request: insertRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 4. Admin Endpoints
// ---------------------------------------------------------------------------
app.get("/api/admin/dashboard", requireAdmin, async (req, res) => {
  try {
    const studentsRes = await query("SELECT COUNT(*) FROM app_users WHERE role = 'student'");
    const coursesRes = await query("SELECT COUNT(*) FROM app_courses");
    const lessonsRes = await query("SELECT COUNT(*) FROM app_lessons");
    const pendingRes = await query("SELECT COUNT(*) FROM app_payment_requests WHERE status = 'pending'");

    res.json({
      students_count: parseInt(studentsRes.rows[0]?.count || 0, 10),
      courses_count: parseInt(coursesRes.rows[0]?.count || 0, 10),
      lessons_count: parseInt(lessonsRes.rows[0]?.count || 0, 10),
      pending_payments_count: parseInt(pendingRes.rows[0]?.count || 0, 10),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/courses", requireAdmin, async (req, res) => {
  try {
    const coursesRes = await query(`
      SELECT c.*,
             (SELECT COUNT(*) FROM app_sections s WHERE s.course_id = c.id) AS sections_count,
             (SELECT COUNT(*) FROM app_lessons l WHERE l.course_id = c.id) AS lessons_count,
             (SELECT COUNT(*) FROM app_enrollments e WHERE e.course_id = c.id) AS students_count
      FROM app_courses c
      ORDER BY c.created_at DESC
    `);
    res.json({ courses: coursesRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/courses", requireAdmin, async (req, res) => {
  try {
    const { title, description, price, thumbnailUrl, isPublished } = req.body;
    const insertRes = await query(
      `INSERT INTO app_courses (id, title, description, price, thumbnail_url, is_published, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [title, description || "", price || 0, thumbnailUrl || null, isPublished !== false]
    );
    res.json(insertRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/courses/:id", requireAdmin, async (req, res) => {
  try {
    const { title, description, price, thumbnailUrl, isPublished } = req.body;
    const updateRes = await query(
      `UPDATE app_courses
       SET title = $1, description = $2, price = $3, thumbnail_url = $4, is_published = $5
       WHERE id = $6
       RETURNING *`,
      [title, description || "", price || 0, thumbnailUrl || null, isPublished !== false, req.params.id]
    );
    res.json(updateRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/courses/:id", requireAdmin, async (req, res) => {
  try {
    await query("DELETE FROM app_courses WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sections
app.post("/api/admin/sections", requireAdmin, async (req, res) => {
  try {
    const { courseId, title, sortOrder } = req.body;
    const insertRes = await query(
      `INSERT INTO app_sections (id, course_id, title, sort_order)
       VALUES (gen_random_uuid(), $1, $2, $3)
       RETURNING *`,
      [courseId, title, sortOrder || 0]
    );
    res.json(insertRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/sections/:id", requireAdmin, async (req, res) => {
  try {
    await query("DELETE FROM app_sections WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lessons
app.post("/api/admin/lessons", requireAdmin, async (req, res) => {
  try {
    const { sectionId, courseId, title, description, videoId, durationMinutes, isFreePreview, sortOrder } = req.body;
    const insertRes = await query(
      `INSERT INTO app_lessons (id, section_id, course_id, title, description, duration_minutes, video_id, sort_order, is_free_preview, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [
        sectionId,
        courseId,
        title,
        description || "",
        durationMinutes || 0,
        videoId || "",
        sortOrder || 0,
        isFreePreview === true,
      ]
    );
    res.json(insertRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/lessons/:id", requireAdmin, async (req, res) => {
  try {
    await query("DELETE FROM app_lessons WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Students List & Management
app.get("/api/admin/students", requireAdmin, async (req, res) => {
  try {
    const studentsRes = await query(`
      SELECT u.id, u.name, u.email, u.phone, u.role, u.is_banned, u.last_seen_at, u.created_at,
             (SELECT COUNT(*) FROM app_enrollments e WHERE e.user_id = u.id) AS enrollments_count,
             (SELECT COUNT(*) FROM app_user_devices ud WHERE ud.user_id = u.id) AS devices_count
      FROM app_users u
      WHERE u.role = 'student'
      ORDER BY u.created_at DESC
    `);
    res.json({ students: studentsRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/students/:id/reset-devices", requireAdmin, async (req, res) => {
  try {
    await query("DELETE FROM app_user_devices WHERE user_id = $1", [req.params.id]);
    res.json({ ok: true, message: "تمت إعادة تعيين أجهزة الطالب بنجاح" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/students/:id/ban", requireAdmin, async (req, res) => {
  try {
    const userRes = await query("SELECT is_banned FROM app_users WHERE id = $1", [req.params.id]);
    if (!userRes.rows.length) return res.status(404).json({ error: "المستخدم غير موجود" });

    const current = userRes.rows[0].is_banned;
    await query("UPDATE app_users SET is_banned = $1 WHERE id = $2", [!current, req.params.id]);
    res.json({ ok: true, is_banned: !current });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/students/:id/enroll", requireAdmin, async (req, res) => {
  try {
    const { courseId } = req.body;
    await query(
      `INSERT INTO app_enrollments (user_id, course_id, enrolled_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, course_id) DO NOTHING`,
      [req.params.id, courseId]
    );
    res.json({ ok: true, message: "تم تسجيل الطالب في الكورس بنجاح" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Payments
app.get("/api/admin/payments", requireAdmin, async (req, res) => {
  try {
    const paymentsRes = await query(`
      SELECT p.*, u.name AS student_name, u.email AS student_email, u.phone AS student_phone, c.title AS course_title
      FROM app_payment_requests p
      JOIN app_users u ON p.user_id = u.id
      JOIN app_courses c ON p.course_id = c.id
      ORDER BY p.created_at DESC
    `);
    res.json({ payments: paymentsRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/payments/:id/approve", requireAdmin, async (req, res) => {
  try {
    const payRes = await query("SELECT * FROM app_payment_requests WHERE id = $1", [req.params.id]);
    if (!payRes.rows.length) return res.status(404).json({ error: "طلب الدفع غير موجود" });

    const payment = payRes.rows[0];
    await query("UPDATE app_payment_requests SET status = 'approved', reviewed_at = NOW() WHERE id = $1", [payment.id]);
    await query(
      `INSERT INTO app_enrollments (user_id, course_id, enrolled_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, course_id) DO NOTHING`,
      [payment.user_id, payment.course_id]
    );

    res.json({ ok: true, message: "تمت الموافقة وتفعيل الكورس للطالب" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/payments/:id/reject", requireAdmin, async (req, res) => {
  try {
    await query("UPDATE app_payment_requests SET status = 'rejected', reviewed_at = NOW() WHERE id = $1", [req.params.id]);
    res.json({ ok: true, message: "تم رفض طلب الدفع" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Activation Codes
app.get("/api/admin/activation-codes", requireAdmin, async (req, res) => {
  try {
    const codesRes = await query(`
      SELECT ac.*, c.title AS course_title, u.name AS used_by_name
      FROM app_activation_codes ac
      JOIN app_courses c ON ac.course_id = c.id
      LEFT JOIN app_users u ON ac.used_by_user_id = u.id
      ORDER BY ac.created_at DESC
    `);
    res.json({ codes: codesRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/activation-codes", requireAdmin, async (req, res) => {
  try {
    const { courseId, count } = req.body;
    const num = Math.min(Math.max(parseInt(count || 1, 10), 1), 50);
    const generated = [];

    for (let i = 0; i < num; i++) {
      const randomCode = "MEDO-" + crypto.randomBytes(4).toString("hex").toUpperCase();
      const insertRes = await query(
        `INSERT INTO app_activation_codes (id, code, course_id, is_used, created_at)
         VALUES (gen_random_uuid(), $1, $2, false, NOW())
         RETURNING *`,
        [randomCode, courseId]
      );
      generated.push(insertRes.rows[0]);
    }

    res.json({ ok: true, codes: generated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Platform Config Update
app.put("/api/admin/config", requireAdmin, async (req, res) => {
  try {
    const {
      appName,
      instructorName,
      welcomeSubtitle,
      whatsappNumber,
      instapayAddress,
      walletNumber,
      paymentHolderName,
      maxDevices,
    } = req.body;

    const updateRes = await query(
      `UPDATE app_config
       SET app_name = COALESCE($1, app_name),
           instructor_name = COALESCE($2, instructor_name),
           welcome_subtitle = COALESCE($3, welcome_subtitle),
           whatsapp_number = COALESCE($4, whatsapp_number),
           instapay_address = COALESCE($5, instapay_address),
           wallet_number = COALESCE($6, wallet_number),
           payment_holder_name = COALESCE($7, payment_holder_name),
           max_devices = COALESCE($8, max_devices),
           updated_at = NOW()
       WHERE id = 1
       RETURNING *`,
      [
        appName,
        instructorName,
        welcomeSubtitle,
        whatsappNumber,
        instapayAddress,
        walletNumber,
        paymentHolderName,
        maxDevices ? parseInt(maxDevices, 10) : null,
      ]
    );

    res.json(updateRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default app;
