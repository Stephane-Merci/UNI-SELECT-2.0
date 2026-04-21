-- Machinery checks must be per worker (not one row per post).
-- Idempotent: many production DBs already have this unique from manual fixes or
-- redeployments before this migration was first checked into git.

ALTER TABLE "public"."MachineryCheck"
  DROP CONSTRAINT IF EXISTS "MachineryCheck_planId_postId_key";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'MachineryCheck_planId_postId_workerId_key'
      AND t.relname = 'MachineryCheck'
      AND n.nspname = 'public'
  ) THEN
    ALTER TABLE "public"."MachineryCheck"
      ADD CONSTRAINT "MachineryCheck_planId_postId_workerId_key"
      UNIQUE ("planId", "postId", "workerId");
  END IF;
END $$;
