const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    "postgresql://neondb_owner:npg_Yeu12bSqwCBF@ep-noisy-poetry-bdyesu0x-pooler.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
});

async function upgradeSchema() {
  console.log("جاري ترقية قاعدة البيانات لدعم (PDF - روابط التطبيقات - اللينكات - التاسكات)...");
  
  await pool.query(`
    -- Add rich lesson resources
    ALTER TABLE app_lessons ADD COLUMN IF NOT EXISTS pdf_url TEXT;
    ALTER TABLE app_lessons ADD COLUMN IF NOT EXISTS app_download_url TEXT;
    ALTER TABLE app_lessons ADD COLUMN IF NOT EXISTS resource_links TEXT;
    ALTER TABLE app_lessons ADD COLUMN IF NOT EXISTS task_description TEXT;

    -- Add task submissions table
    CREATE TABLE IF NOT EXISTS app_task_submissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      lesson_id UUID NOT NULL REFERENCES app_lessons(id) ON DELETE CASCADE,
      course_id UUID NOT NULL REFERENCES app_courses(id) ON DELETE CASCADE,
      submission_url TEXT,
      notes TEXT,
      grade INT DEFAULT NULL,
      feedback TEXT,
      status VARCHAR(30) DEFAULT 'submitted',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_task_sub_user ON app_task_submissions(user_id);
    CREATE INDEX IF NOT EXISTS idx_task_sub_lesson ON app_task_submissions(lesson_id);
  `);

  console.log("✓ تم تحديث قاعدة بيانات Neon بنجاح تام لدعم كل خانات المرفقات والتاسكات!");
  await pool.end();
}

upgradeSchema().catch(console.error);
