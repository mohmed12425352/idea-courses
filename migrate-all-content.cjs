const { Pool } = require("pg");

const SOURCE_SUPABASE_URL = "https://ykzwmwczktqricjizqie.supabase.co";
const SOURCE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlrendtd2N6a3Rxcmljaml6cWllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0OTI2MTksImV4cCI6MjA5MzA2ODYxOX0.hg_U46Rz2fEVaRul1-SwlQ3HeoIEh2WB9ydLqxH0me8";

const TARGET_NEON_CONN =
  "postgresql://neondb_owner:npg_Yeu12bSqwCBF@ep-noisy-poetry-bdyesu0x-pooler.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require";

function parseVideoIdentifier(url) {
  if (!url) return { rawUrl: "", videoId: "" };
  const s = String(url).trim();

  // Bunny Stream pattern
  const bunnyMatch = s.match(/mediadelivery\.net\/(?:embed|play)\/(\d+)\/([0-9a-fA-F-]{36})/i);
  if (bunnyMatch && bunnyMatch[1] && bunnyMatch[2]) {
    return {
      rawUrl: s,
      videoId: `bunny:${bunnyMatch[1]}:${bunnyMatch[2]}`,
    };
  }

  // YouTube pattern
  const ytMatch = s.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return {
      rawUrl: s,
      videoId: ytMatch[1],
    };
  }

  return { rawUrl: s, videoId: s };
}

async function runMigration() {
  console.log("=================================================================");
  console.log("       بدء النقل الآلي الشامل لكافة الكورسات والمحاضرات والفيديوهات       ");
  console.log("=================================================================");

  // 1. Authenticate with Supabase
  console.log("[1/4] جاري تسجيل الدخول كـ Admin في المنصة القديمة...");
  const authRes = await fetch(SOURCE_SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { apikey: SOURCE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "mohmedshalaby246@gmail.com",
      password: "8025262728",
    }),
  });
  const auth = await authRes.json();
  if (!auth.access_token) {
    throw new Error("فشل تسجيل الدخول في المنصة القديمة: " + (auth.error_description || auth.error));
  }
  const token = auth.access_token;
  console.log("  -> تم تسجيل الدخول بنجاح!");

  // 2. Fetch all courses, modules, lessons
  console.log("[2/4] جاري جلب جميع الكورسات والسكاشن والمحاضرات...");
  const [coursesRes, modulesRes, lessonsRes] = await Promise.all([
    fetch(SOURCE_SUPABASE_URL + "/rest/v1/courses?select=*&order=created_at.asc", {
      headers: { apikey: SOURCE_ANON_KEY, Authorization: "Bearer " + token },
    }),
    fetch(SOURCE_SUPABASE_URL + "/rest/v1/modules?select=*&order=order_index.asc", {
      headers: { apikey: SOURCE_ANON_KEY, Authorization: "Bearer " + token },
    }),
    fetch(SOURCE_SUPABASE_URL + "/rest/v1/lessons?select=*&order=order_index.asc", {
      headers: { apikey: SOURCE_ANON_KEY, Authorization: "Bearer " + token },
    }),
  ]);

  const [courses, modules, lessons] = await Promise.all([
    coursesRes.json(),
    modulesRes.json(),
    lessonsRes.json(),
  ]);

  console.log(`  -> تم جلب: ${courses.length} كورس | ${modules.length} موديول/سكشن | ${lessons.length} محاضرة وفيديو`);

  // 3. Connect to Neon DB
  console.log("[3/4] جاري الاتصال بقاعدة بيانات Neon PostgreSQL للمنصة الجديدة...");
  const pool = new Pool({
    connectionString: TARGET_NEON_CONN,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  console.log("  -> متصل بقاعدة بيانات Neon بنجاح!");

  // 4. Migrate Courses, Sections, Lessons
  console.log("[4/4] جاري إدخال وتنظيم الكورسات والفولدرات والمحاضرات...");
  let coursesInserted = 0;
  let sectionsInserted = 0;
  let lessonsInserted = 0;

  try {
    await client.query("BEGIN;");

    let cIndex = 0;
    for (const c of courses) {
      cIndex++;
      // Upsert Course
      const courseSql = `
        INSERT INTO app_courses (
          id, title, subtitle, description, category, price, thumbnail_url,
          is_published, max_views_per_lesson, order_index, created_at
        )
        VALUES (
          $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          subtitle = EXCLUDED.subtitle,
          description = EXCLUDED.description,
          category = EXCLUDED.category,
          price = EXCLUDED.price,
          thumbnail_url = EXCLUDED.thumbnail_url,
          is_published = EXCLUDED.is_published,
          order_index = EXCLUDED.order_index;
      `;

      await client.query(courseSql, [
        c.id,
        c.title || "كورس بدون عنوان",
        c.short_description || "",
        c.description || "",
        c.category || "عام",
        Number(c.price) || 0,
        c.image_url || null,
        c.status === "published" || !c.is_hidden,
        c.certificate_config?.max_video_views || 4,
        cIndex,
        c.created_at ? new Date(c.created_at) : new Date(),
      ]);
      coursesInserted++;

      // Modules for this course
      const courseModules = modules.filter((m) => m.course_id === c.id);

      if (courseModules.length === 0) {
        // Create at least 1 default section if none exists
        const defaultSecId = c.id; // use course id as default section id
        const defaultSecSql = `
          INSERT INTO app_sections (id, course_id, title, order_index, created_at)
          VALUES ($1::uuid, $2::uuid, 'المحاضرات الرئيسية', 0, NOW())
          ON CONFLICT (id) DO NOTHING;
        `;
        await client.query(defaultSecSql, [defaultSecId, c.id]);
        sectionsInserted++;
      } else {
        let mIndex = 0;
        for (const m of courseModules) {
          mIndex++;
          const secSql = `
            INSERT INTO app_sections (id, course_id, title, order_index, created_at)
            VALUES ($1::uuid, $2::uuid, $3, $4, $5)
            ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title,
              order_index = EXCLUDED.order_index;
          `;
          await client.query(secSql, [
            m.id,
            c.id,
            m.title || "القسم",
            m.order_index ?? mIndex,
            m.created_at ? new Date(m.created_at) : new Date(),
          ]);
          sectionsInserted++;

          // Lessons for this module
          const moduleLessons = lessons.filter((l) => l.module_id === m.id);
          let lIndex = 0;
          for (const l of moduleLessons) {
            lIndex++;
            const { rawUrl, videoId } = parseVideoIdentifier(l.video_url);

            const lessonSql = `
              INSERT INTO app_lessons (
                id, course_id, section_id, title, description,
                youtube_url, youtube_video_id, duration_label,
                is_free_preview, order_index, created_at
              )
              VALUES (
                $1::uuid, $2::uuid, $3::uuid, $4, $5,
                $6, $7, $8,
                $9, $10, $11
              )
              ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                youtube_url = EXCLUDED.youtube_url,
                youtube_video_id = EXCLUDED.youtube_video_id,
                duration_label = EXCLUDED.duration_label,
                is_free_preview = EXCLUDED.is_free_preview,
                order_index = EXCLUDED.order_index;
            `;
            await client.query(lessonSql, [
              l.id,
              c.id,
              m.id,
              l.title || "درس",
              l.content || "",
              rawUrl,
              videoId,
              l.duration || "10:00",
              Boolean(l.is_preview),
              l.order_index ?? lIndex,
              l.created_at ? new Date(l.created_at) : new Date(),
            ]);
            lessonsInserted++;
          }
        }
      }
    }

    await client.query("COMMIT;");
    console.log("\n=================================================================");
    console.log("       🎉 تم النقل والربط بنجاح تام 100%!       ");
    console.log("=================================================================");
    console.log(` ✅ تم إدخال وتحديث: ${coursesInserted} كورس`);
    console.log(` ✅ تم تنظيم: ${sectionsInserted} سكشن وموديول`);
    console.log(` ✅ تم ربط: ${lessonsInserted} محاضرة وفيديو مباشر`);
    console.log("=================================================================\n");
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("خطأ أثناء النقل:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
