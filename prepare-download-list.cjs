const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const SOURCE_SUPABASE_URL = "https://ykzwmwczktqricjizqie.supabase.co";
const SOURCE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlrendtd2N6a3Rxcmljaml6cWllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0OTI2MTksImV4cCI6MjA5MzA2ODYxOX0.hg_U46Rz2fEVaRul1-SwlQ3HeoIEh2WB9ydLqxH0me8";

const YT_DLP_PATH = path.resolve(__dirname, "tools/yt-dlp.exe");
const OUTPUT_BASE = "D:\\data\\فيديوهات_الكورسات_الكاملة";

function sanitize(name) {
  return String(name || "unnamed")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

async function prepareDownloadList() {
  console.log("جاري تسجيل الدخول وجلب قائمة الفيديوهات...");
  const authRes = await fetch(SOURCE_SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { apikey: SOURCE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "mohmedshalaby246@gmail.com",
      password: "8025262728",
    }),
  });
  const auth = await authRes.json();
  const token = auth.access_token;

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

  const tasks = [];
  for (const c of courses) {
    const courseTitle = sanitize(c.title);
    const cModules = modules.filter((m) => m.course_id === c.id);
    for (const m of cModules) {
      const moduleTitle = sanitize(m.title);
      const mLessons = lessons.filter((l) => l.module_id === m.id);
      let lIdx = 0;
      for (const l of mLessons) {
        lIdx++;
        if (l.video_url && l.video_url.includes("mediadelivery.net")) {
          const lessonTitle = `${lIdx} - ${sanitize(l.title)}`;
          tasks.push({
            courseId: c.id,
            courseTitle,
            moduleId: m.id,
            moduleTitle,
            lessonId: l.id,
            lessonTitle,
            videoUrl: l.video_url,
            duration: l.duration,
            targetDir: path.join(OUTPUT_BASE, courseTitle, moduleTitle),
            targetFile: path.join(OUTPUT_BASE, courseTitle, moduleTitle, `${lessonTitle}.mp4`),
          });
        }
      }
    }
  }

  console.log(`إجمالي الفيديوهات الجاهزة للسحب والتحميل: ${tasks.length} فيديو.`);
  fs.writeFileSync(
    path.join(__dirname, "download_tasks.json"),
    JSON.stringify(tasks, null, 2),
    "utf8"
  );
  console.log("تم حفظ قائمة المهام في download_tasks.json");
  return tasks;
}

prepareDownloadList();
