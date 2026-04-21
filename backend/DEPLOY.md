# Deploying the backend (avoiding database errors in production)

## Why the previous live error happened

Errors like **"The table public.Plan does not exist"** or **"The table public.Booking does not exist"** occur when the **production database schema is out of date**: the app expects tables that were never created on the live DB. That usually means migrations were not run (or were only run locally).

## What we changed so it doesn’t happen again

1. **Prisma migrations are in the repo**  
   The folder `backend/prisma/migrations/` must be **committed** (do **not** add it to `.gitignore`). It contains the migration history; without it, `prisma migrate deploy` in CI or `start:prod` has nothing to apply, and the live DB will miss new enum values and tables.

2. **Migrations run automatically before the app starts in production**  
   - Script **`start:prod`** runs `prisma migrate deploy` then starts the server.  
   - **Railway** is configured to use `npm run start:prod` as the start command (see `railway.json`).  
   - On other platforms, set the **start command** to:
     ```bash
     npm run start:prod
     ```
   so every deploy applies pending migrations before the app starts.

3. **Prisma CLI is available in production**  
   `prisma` is in **dependencies** (not only devDependencies) so `prisma migrate deploy` can run in production.

## One-time step if your live DB already has tables

If the live database was created **before** we added migrations (e.g. with manual SQL or `prisma db push`), then the first time you use `start:prod` the initial migration might **fail** because it tries to create tables that already exist.

**If some tables are still missing** (e.g. Plan, Booking, BookingReplacement), create them first using the scripts in `prisma/` (e.g. `create_booking_tables_if_missing.sql` and your plan migration SQL), or run the migration on a copy of the DB and then apply the same changes to production. Once all tables exist, baseline as below.

**If all tables already exist**, baseline the database once (from a machine that can reach the production DB with `DATABASE_URL` set):

```bash
cd backend
# Use your production DATABASE_URL (env or .env)
npx prisma migrate resolve --applied 20250101000000_init
```

This tells Prisma “the migration `20250101000000_init` is already applied,” so it won’t run it again. After that, `npm run start:prod` will only apply any **new** migrations in the future.

Then redeploy using `start:prod` as above.

## Summary

| Environment | Start command | Effect |
|-------------|---------------|--------|
| Local dev  | `npm run dev` | No migrations (you run `prisma migrate dev` when needed). |
| Production  | `npm run start:prod` | Runs `prisma migrate deploy` then starts the app so the DB is always up to date. |

Using `start:prod` in production and (if needed) running `prisma migrate resolve --applied 20250101000000_init` once for an existing DB ensures the previous database errors do not occur again.
