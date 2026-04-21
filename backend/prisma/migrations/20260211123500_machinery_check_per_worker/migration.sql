-- Per-worker machinery checks: unique (planId, postId, workerId).
-- Some databases never had a CREATE for "MachineryCheck" in migration history (e.g. push-only).
-- Without the table, ALTER TABLE ... failed and left Prisma P3009 on deploy.

CREATE TABLE IF NOT EXISTS "public"."MachineryCheck" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "isFaulty" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MachineryCheck_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MachineryCheck_planId_idx" ON "public"."MachineryCheck"("planId");
CREATE INDEX IF NOT EXISTS "MachineryCheck_postId_idx" ON "public"."MachineryCheck"("postId");
CREATE INDEX IF NOT EXISTS "MachineryCheck_workerId_idx" ON "public"."MachineryCheck"("workerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'MachineryCheck' AND constraint_name = 'MachineryCheck_planId_fkey'
  ) THEN
    ALTER TABLE "public"."MachineryCheck"
      ADD CONSTRAINT "MachineryCheck_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'MachineryCheck' AND constraint_name = 'MachineryCheck_postId_fkey'
  ) THEN
    ALTER TABLE "public"."MachineryCheck"
      ADD CONSTRAINT "MachineryCheck_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'MachineryCheck' AND constraint_name = 'MachineryCheck_workerId_fkey'
  ) THEN
    ALTER TABLE "public"."MachineryCheck"
      ADD CONSTRAINT "MachineryCheck_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "public"."Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Drop legacy (planId, postId) unique if present (name used by Prisma for @@unique([planId, postId])).
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
