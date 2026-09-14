require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool, ensureSchema } = require('./db');

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'System Administrator';

  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in your .env file before running this script.');
    process.exit(1);
  }
  if (password.length < 8 || password === 'change-this-password') {
    console.error('ADMIN_PASSWORD must be changed from the template default and be at least 8 characters.');
    process.exit(1);
  }

  await ensureSchema();

  const existing = (await pool.query(`SELECT id FROM users WHERE email = $1`, [email])).rows[0];
  if (existing) {
    console.log(`An account with email ${email} already exists. Nothing to do.`);
    await pool.end();
    return;
  }

  const id = crypto.randomUUID();
  const hash = bcrypt.hashSync(password, 12);
  await pool.query(`INSERT INTO users (id, role, email, password_hash, approval_status) VALUES ($1, 'admin', $2, $3, 'approved')`, [id, email, hash]);

  console.log('Admin account created.');
  console.log(`  Name:  ${name}`);
  console.log(`  Email: ${email}`);
  console.log('Log in with this account, then use the Admin dashboard to approve teacher registrations');
  console.log('and let students/teachers self-register and create classes from there.');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
