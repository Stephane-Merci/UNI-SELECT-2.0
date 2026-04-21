-- AlterTable (idempotent if column already exists)
ALTER TABLE "public"."Post" ADD COLUMN IF NOT EXISTS "machineryStatus" TEXT NOT NULL DEFAULT 'GOOD';
