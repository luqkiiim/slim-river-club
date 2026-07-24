# Office Weight Tracker

Mobile-friendly weight loss tracker for a single office group. Built with Next.js App Router, Prisma, SQLite, NextAuth, Tailwind CSS, and Recharts.

## Features

- Email/password signup and login
- First registered user becomes admin
- First registered user can be admin-only without joining the tracked member list
- Admins can pre-create participants and share claim codes for later signup
- Dashboard with all users, leaderboards, progress bars, and RM owed
- Automatic monthly penalty calculation for closed calendar months, with per-participant targets, personal month adjustments, start dates, and penalty amounts
- Member backfill support for historical weight entries
- Personal profile page with weight chart and history table
- Floating modal for daily weight logging
- Admin tools for editing entries, updating starting/target weights, managing admin access, and removing profiles

## Setup

```bash
npm install
npx prisma migrate dev
npm run dev
```

If PowerShell blocks `npm` or `npx`, use `npm.cmd` and `npx.cmd` instead.

## Environment

Development defaults are already included in `.env`:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="development-secret-change-me"
```

## Production database migrations

Prisma migration commands update the local SQLite database only. Production
uses Turso, so every schema change must follow this release order:

1. Create and validate the Prisma migration locally.
2. Seal the new migration and Prisma schema together:

   ```bash
   npm run db:migrations:seal
   ```

   This refuses to update the schema state unless a newer migration directory
   exists.
3. Apply the next migration to Turso:

   ```bash
   npm run db:migrations:apply -- --migration <migration-directory-name>
   ```

4. Verify Turso's migration journal, schema state, and committed checksums:

   ```bash
   npm run db:migrations:check
   ```

5. Push and deploy only after the check passes.

Production Vercel builds run the same read-only check before `next build`. A
missing, unfinished, rolled-back, duplicated, modified, or schema-less
migration fails the new deployment before it can replace the healthy
production deployment. Recognized preview/development builds skip the gate.
Local builds check by default and may explicitly opt out with
`TURSO_MIGRATION_CHECK_LOCAL_SKIP=1`.

## Notes

- Weight entries are append-only for normal users.
- Monthly penalties are recalculated automatically when the dashboard, profile pages, or admin tools run.
- Goal-reached users remain visible and stop accruing new monthly penalties.
- Admin-only accounts are excluded from dashboards, leaderboards, penalties, and profile tracking.
- Pre-created participant profiles can be backfilled before the participant claims the account with a code.
