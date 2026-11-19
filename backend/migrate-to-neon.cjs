const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const NEON_CONN = 'postgresql://neondb_owner:npg_Yeu12bSqwCBF@ep-noisy-poetry-bdyesu0x-pooler.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString: NEON_CONN,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log('1. Reading clean schema...');
    const schemaSql = fs.readFileSync(path.resolve(__dirname, 'src/db/clean-schema.sql'), 'utf8');
    
    console.log('2. Applying schema to Neon PostgreSQL...');
    await pool.query(schemaSql);
    console.log('3. Schema applied successfully!');

    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('Tables in Neon:', tables.rows.map(r => r.table_name));

    // Ensure instructor branding in config
    await pool.query(`
      UPDATE app_config 
      SET 
        app_name = 'Idea Courses',
        instructor_name = 'بشمهندس ميدو شلبي',
        welcome_subtitle = 'منصة المحاضرات التفاعلية المحمية للكمبيوتر والموبايل',
        instapay_address = '01222752276',
        wallet_number = '01026533835',
        payment_holder_name = 'محمد ا ع ي شلبي'
      WHERE id = 1;
    `);

    // Ensure admin user
    const adminRes = await pool.query(`SELECT id, name, email, role FROM app_users WHERE role = 'admin';`);
    console.log('Admin:', adminRes.rows);

    const configRes = await pool.query(`SELECT app_name, instructor_name, instapay_address, wallet_number FROM app_config WHERE id = 1;`);
    console.log('Config:', configRes.rows);

    await pool.end();
    console.log('ALL DONE! Neon is ready.');
  } catch (err) {
    console.error('Fatal error during migration:', err);
    process.exit(1);
  }
}

main();
