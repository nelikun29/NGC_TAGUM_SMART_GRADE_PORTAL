# Deploying to Netlify + Neon (Serverless)

This is a different architecture from the standalone Node server version:
the backend runs as a Netlify Function (not a persistent process), and the
database is Postgres on Neon (not a local SQLite file). Both were rebuilt
and tested for this — every route, the grading engine, RBAC, and the audit
log all work the same way, just backed by different infrastructure.

## 1. Create your Neon database

1. Sign up at https://neon.tech (free tier is enough for a school-scale app).
2. Create a new project. Neon gives you a connection string immediately.
3. **Use the "pooled" connection string**, not the direct one — look for a
   toggle or a separate string labeled "Pooled connection" in the Neon
   dashboard. It routes through PgBouncer, which matters because each
   Netlify Function invocation can open its own database connection, and
   Postgres has a hard limit on how many it'll accept directly.
4. It'll look like:
   ```
   postgresql://user:password@ep-xxxx-pooler.region.aws.neon.tech/dbname?sslmode=require
   ```

## 2. Push this project to a Git repository

Netlify deploys from Git (GitHub, GitLab, or Bitbucket). Create a repo and
push this whole project (the one with `netlify.toml` at the root) to it.

**Do not commit your `.env` file** — it contains secrets. A `.gitignore`
excluding it is included; double check it's actually being respected before
your first push.

## 3. Connect the repo to Netlify

1. In the Netlify dashboard: **Add new site → Import an existing project**.
2. Pick your Git provider and repository.
3. Build settings: Netlify should auto-detect `netlify.toml` — it already
   specifies `publish = "frontend"` and `functions = "netlify/functions"`.
   You don't need a build command; this project has no build step.

## 4. Set environment variables in Netlify

In your site's **Site configuration → Environment variables**, add:

| Key | Value |
|---|---|
| `DATABASE_URL` | Your Neon **pooled** connection string |
| `JWT_SECRET` | A long random value — generate one locally with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `INSTITUTION_NAME` | e.g. `NDC-Tagum Foundation, Inc.` |
| `ADMIN_EMAIL` | The real administrator's email |
| `ADMIN_PASSWORD` | A real strong password (not the template default) |
| `ADMIN_NAME` | The real administrator's name |

You do **not** need to set `CORS_ORIGIN`, `PORT`, or `TRUST_PROXY` here —
those only matter for the local standalone-server mode; the Netlify
Function ignores them (frontend and backend share one origin on Netlify, so
CORS doesn't apply, and it always trusts Netlify's own proxy headers).

## 5. Initialize the database

The schema needs to be created in your Neon database once, and you need one
real admin account. Run this **from your own computer**, pointed at the
Neon database (not on Netlify — these are one-time setup scripts, not
something that needs to run in production continuously):

```bash
# In your local project folder:
cp .env.example .env
# Edit .env: set DATABASE_URL to your Neon pooled connection string,
# and set ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME to the real values
# (same ones you put in Netlify's environment variables above)
node backend/create-admin.js
```

This creates the schema (if it doesn't exist yet) and exactly one admin
account. Don't run `node backend/seed.js` against a real Neon database
meant for production — that script creates demo/fake accounts.

## 6. Deploy

Trigger a deploy in Netlify (it may have already started automatically
after connecting the repo). Once it finishes, visit your Netlify URL — you
should see the branded login screen. Log in with the admin account you just
created.

## 7. Local development against Neon (optional)

You can still run this locally with `node backend/server.js` for
development — just point `DATABASE_URL` in your local `.env` at the same
Neon database (or a separate Neon branch/project for a dev/test copy, which
Neon makes easy — "branching" is one of its features). The frontend then
needs `window.SMARTGRADE_API_BASE` set to `http://localhost:4000/api` since
it won't be on the same origin locally.

## What changed from the standalone-server version

If you previously set this up with `node server.js` + a local SQLite file,
here's what's different now — useful if you're comparing the two or
migrating data:

- **Database**: SQLite file → Postgres (Neon). The schema is equivalent
  (same tables, same constraints); see `backend/schema.sql`.
- **Backend runtime**: A single long-running Node process → a Netlify
  Function that starts up per-request (Netlify keeps warm instances around
  under normal traffic, so this is not slow in practice).
- **Booleans**: SQLite stored `is_locked`/`is_active`/etc. as 0/1 integers;
  Postgres uses real `BOOLEAN` (`true`/`false`). The application code
  already accounts for this — nothing to change on your end.
- **No `smartgrade.db` file** — there's nothing to back up locally anymore;
  back up via Neon's own point-in-time recovery / branching instead (see
  Neon's dashboard for backup/restore options).
- **CORS**: no longer needed in production, since the frontend and backend
  are served from the same Netlify domain via the `/api/*` redirect.

There is no automated migration script from the old SQLite database to
Neon in this package — if you have real data in the old SQLite file you
need carried over, that's a one-time data export/import job. Say the word
if you need that and I can build it.
