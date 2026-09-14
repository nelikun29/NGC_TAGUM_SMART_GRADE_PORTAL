# Smart Grade & Attendance Portal — Serverless Edition (Netlify + Neon)

Same app, rebuilt on a serverless architecture: the backend runs as a
Netlify Function (Express wrapped with `serverless-http`) and the database
is Postgres on Neon instead of a local SQLite file. Every route, the
grading engine, role-based access control, and the audit log were ported
and re-tested — see `PHASE2_REPORT.md` for the original feature set and
`NETLIFY_DEPLOYMENT.md` for exactly what changed and why.

**For the actual deployment steps, read `NETLIFY_DEPLOYMENT.md` — this file
only covers local development.**

## Local development

You need a Postgres database to develop against — either a local install or
a free Neon project (branching makes Neon convenient even for local dev,
since you can spin up a disposable branch).

```bash
npm install
cp .env.example .env
# Edit .env:
#   DATABASE_URL — your local Postgres or Neon connection string
#   JWT_SECRET   — generate with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

node backend/seed.js      # DEMO data — creates demo admin/teacher/student + one class
node backend/server.js    # starts the API on http://localhost:4000
```

In a second terminal, serve the frontend:

```bash
cd frontend
python3 -m http.server 5173
```

Since the frontend and backend run on different ports locally (they share
one origin only once deployed to Netlify), tell the frontend where the API
is. Open `frontend/index.html` and add this line before the `app.js`
`<script>` tag:

```html
<script>window.SMARTGRADE_API_BASE = 'http://localhost:4000/api';</script>
```

Then open `http://localhost:5173`.

Demo accounts (from `seed.js`):

| Role    | Email                        | Password       |
|---------|-------------------------------|----------------|
| Admin   | admin@portal.edu              | Admin!2345     |
| Teacher | prof.delacruz@portal.edu      | Teacher!2345   |
| Student | juan.reyes@portal.edu         | Student!2345   |

Demo class code: `EDUC15-2026-A7X9`

## Testing the Netlify Function without deploying

`test-netlify-function.js` simulates real Netlify Function invocations
(health check, config, login, an authenticated request, and a rejected
unauthenticated request) directly against `netlify/functions/api.js`,
without needing an actual Netlify deployment:

```bash
node test-netlify-function.js
```

This is what was used to verify the serverless wrapper actually works
end-to-end before shipping this.

## Setting up a REAL deployment

Don't use `seed.js` for a real school (it creates fake accounts). See
`NETLIFY_DEPLOYMENT.md` for the full walkthrough — in short:

```bash
node backend/create-admin.js
```

creates exactly one real admin account and refuses to run with the
template default password.

## Re-branding for a different school

Same as before: change `INSTITUTION_NAME` in `.env` (or Netlify's
environment variables for a deployed site) and replace
`frontend/assets/logo.png` with the new school's logo, same filename.
