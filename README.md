# Office Weight Tracker

Mobile-friendly weight loss tracker for a single office group. Built with Next.js App Router, Prisma, SQLite, NextAuth, Tailwind CSS, and Recharts.

## Features

- Email/password signup and login
- First registered user becomes admin
- First registered user can be admin-only without joining the tracked member list
- Admins can pre-create participants and share claim codes for later signup
- Dashboard with all users, leaderboards, progress bars, and RM owed
- Automatic monthly penalty calculation for closed calendar months, with per-participant targets, start dates, and penalty amounts
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

## Notes

- Weight entries are append-only for normal users.
- Monthly penalties are recalculated automatically when the dashboard, profile pages, or admin tools run.
- Goal-reached users remain visible and stop accruing new monthly penalties.
- Admin-only accounts are excluded from dashboards, leaderboards, penalties, and profile tracking.
- Pre-created participant profiles can be backfilled before the participant claims the account with a code.
