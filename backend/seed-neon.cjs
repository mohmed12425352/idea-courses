const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const NEON_CONN = 'postgresql://neondb_owner:npg_Yeu12bSqwCBF@ep-noisy-poetry-bdyesu0x-pooler.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString: NEON_CONN,
  ssl: { rejectUnauthorized: false }
});

async function seed() {
  try {
    const adminHash = await bcrypt.hash('Admin@123456', 10);
    const studentHash = await bcrypt.hash('Student@123456', 10);

    // Insert or update Admin
    await pool.query(`
      INSERT INTO app_users (id, name, email, password_hash, role, phone, is_banned)
      VALUES (
        '5bcd3c54-f2ee-4f64-ad84-cff2e2a1048e',
        'بشمهندس ميدو شلبي (Admin)',
        'admin@edunova.eg',
        $1,
        'admin',
        '01026533835',
        false
      )
      ON CONFLICT (email) DO UPDATE 
      SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name, role = 'admin';
    `, [adminHash]);

    // Insert or update Student
    await pool.query(`
      INSERT INTO app_users (id, name, email, password_hash, role, phone, is_banned)
      VALUES (
        '6cde4d65-f3ff-4a75-be95-dff3f3b2159f',
        'طالب تجريبي',
        'student@edunova.eg',
        $1,
        'student',
        '01000000000',
        false
      )
      ON CONFLICT (email) DO UPDATE 
      SET password_hash = EXCLUDED.password_hash;
    `, [studentHash]);

    const users = await pool.query('SELECT id, name, email, role FROM app_users;');
    console.log('Current users in Neon:', users.rows);

    await pool.end();
    console.log('Seeding completed successfully!');
  } catch (err) {
    console.error('Seed error:', err);
  }
}

seed();
