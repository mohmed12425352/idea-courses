const { Pool } = require("pg");
const pool = new Pool({
  connectionString:
    "postgresql://neondb_owner:npg_Yeu12bSqwCBF@ep-noisy-poetry-bdyesu0x-pooler.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
});

async function inspect() {
  const r = await pool.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name IN ('app_sections', 'app_lessons', 'app_courses')
    ORDER BY table_name, ordinal_position;
  `);
  for (const row of r.rows) {
    console.log(`${row.table_name} -> ${row.column_name} (${row.data_type})`);
  }
  pool.end();
}

inspect();
