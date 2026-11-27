const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const tasksFile = path.resolve(__dirname, "download_tasks.json");
const progressFile = path.resolve(__dirname, "download_progress.json");
const YT_DLP = path.resolve(__dirname, "tools/yt-dlp.exe");

if (!fs.existsSync(tasksFile)) {
  console.error("ملف download_tasks.json غير موجود!");
  process.exit(1);
}

const tasks = JSON.parse(fs.readFileSync(tasksFile, "utf8"));
let progress = {};
if (fs.existsSync(progressFile)) {
  try {
    progress = JSON.parse(fs.readFileSync(progressFile, "utf8"));
  } catch {}
}

function runDownload(task) {
  return new Promise((resolve) => {
    fs.mkdirSync(task.targetDir, { recursive: true });

    if (fs.existsSync(task.targetFile) && fs.statSync(task.targetFile).size > 1024 * 1024) {
      console.log(`[✓ تخطي - موجود بالفعل] ${task.courseTitle} -> ${task.lessonTitle}`);
      progress[task.lessonId] = { status: "done", path: task.targetFile };
      fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2), "utf8");
      return resolve(true);
    }

    console.log(`\n[⬇ جاري التحميل] ${task.courseTitle} -> ${task.moduleTitle} -> ${task.lessonTitle}`);
    const args = [
      "--referer",
      "https://fekradesign.shalaby3.online/",
      "-f",
      "source/best",
      task.videoUrl,
      "-o",
      task.targetFile,
      "--no-playlist",
      "--quiet",
      "--progress",
    ];

    const proc = spawn(YT_DLP, args, { stdio: "inherit" });

    proc.on("close", (code) => {
      if (code === 0 && fs.existsSync(task.targetFile) && fs.statSync(task.targetFile).size > 1000) {
        console.log(`  -> [✓ تم التحميل بنجاح!] (${(fs.statSync(task.targetFile).size / (1024 * 1024)).toFixed(1)} MB)`);
        progress[task.lessonId] = { status: "done", path: task.targetFile, size: fs.statSync(task.targetFile).size };
      } else {
        console.error(`  -> [X فشل تحميل هذا الفيديو] (Exit Code: ${code})`);
        progress[task.lessonId] = { status: "failed", code };
      }
      fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2), "utf8");
      resolve(code === 0);
    });
  });
}

async function start() {
  console.log(`========================================================`);
  console.log(`    بدء تحميل وحفظ الـ ${tasks.length} فيديو على القرص D   `);
  console.log(`========================================================\n`);

  let count = 0;
  for (const t of tasks) {
    count++;
    console.log(`\n--- [${count} / ${tasks.length}] ---`);
    await runDownload(t);
  }

  console.log("\n========================================================");
  console.log("   🎉 تم الانتهاء من تحميل جميع فيديوهات الكورسات!   ");
  console.log("========================================================");
}

start();
