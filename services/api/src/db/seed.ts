import { pool } from '../lib/db';
import { hashPassword } from '../lib/auth';

async function seed() {
  console.log('Seeding database...');

  try {
    const adminPassword = await hashPassword('admin123');
    const broadcasterPassword = await hashPassword('broadcaster123');

    await pool.query(
      `INSERT INTO users (username, email, password_hash, role, display_name)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING`,
      ['admin', 'admin@radiolive.dev', adminPassword, 'admin', 'Admin']
    );

    await pool.query(
      `INSERT INTO users (username, email, password_hash, role, display_name)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING`,
      ['dj', 'dj@radiolive.dev', broadcasterPassword, 'broadcaster', 'DJ Radio']
    );

    console.log('Seed completed:');
    console.log('  admin@radiolive.dev / admin123 (admin)');
    console.log('  dj@radiolive.dev / broadcaster123 (broadcaster)');
  } catch (error) {
    console.error('Seed failed:', error);
  } finally {
    await pool.end();
  }
}

seed();
