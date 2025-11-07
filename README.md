## Environment setup

1. Copy `.env.example` to `.env`.
2. Fill in the placeholders with your Supabase connection strings:
   - `DATABASE_URL` – **required**, pooled connection string with `?pgbouncer=true&connection_limit=1&sslmode=require`.
   - `DIRECT_URL` – optional direct (non-pooled) string for running migrations.
   - `SHADOW_DATABASE_URL` – optional shadow database string for interactive migrations.

`.env` and other secret files are already ignored via `.gitignore`.

## Local database workflow

Install once and keep the schema in sync with Supabase:

```bash
npm install
npm run migrate:deploy
npm run db:seed
```

The seed ensures a default profile **Pribadi** and the four default pockets exist on the active profile.

## Local UAT checklist

1. Configure `.env` with your Supabase URLs.
2. Run `npm run migrate:deploy && npm run db:seed`.
3. Start the dev server (`npm run dev`) and exercise the main flows (create transaction, transfer, recurring). Confirm data persists across refreshes.
4. Visit `/debug/db` (development only) for Prisma version, record counts, and DB health.

## Deploying to Vercel

1. Push your code to a repository connected to Vercel.
2. In Vercel Project Settings → Environment Variables, add:
   - `DATABASE_URL` – pooled Supabase URL (must include `pgbouncer=true`).
   - `DIRECT_URL` – optional direct connection.
   - `SHADOW_DATABASE_URL` – optional shadow database.
3. On first deploy (or after schema changes), run migrations manually:

   ```bash
   npm run migrate:deploy
   npm run db:seed
   ```

   (You can trigger these via Vercel CLI, a CI pipeline, or locally against the production database.)

## Development

```bash
npm run dev
```
