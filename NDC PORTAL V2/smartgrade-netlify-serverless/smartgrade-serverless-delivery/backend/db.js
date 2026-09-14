const { Pool } = require('pg');

// Works against Neon (set DATABASE_URL to Neon's connection string — use
// the "pooled" connection string from the Neon dashboard, which routes
// through PgBouncer; that matters because serverless functions can spin up
// many concurrent instances, each holding its own connection) or any local
// Postgres for development.
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set in environment (.env) — e.g. your Neon connection string.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon requires SSL; local dev Postgres typically doesn't have a cert, so
  // this permissive setting is fine for both — Neon's connection itself is
  // already encrypted in transit via its pooler.
  ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
  max: 5, // keep modest — many short-lived serverless invocations can share the pooled Neon endpoint
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error', err);
});

/** Runs schema.sql against the connected database. Safe to call repeatedly (all statements are IF NOT EXISTS). */
async function ensureSchema() {
  const fs = require('fs');
  const path = require('path');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
}

module.exports = { pool, ensureSchema };
