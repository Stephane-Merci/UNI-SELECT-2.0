-- Machinery checks must be per worker (not one row per post)
ALTER TABLE "MachineryCheck"
  DROP CONSTRAINT IF EXISTS "MachineryCheck_planId_postId_key";

ALTER TABLE "MachineryCheck"
  ADD CONSTRAINT "MachineryCheck_planId_postId_workerId_key"
  UNIQUE ("planId", "postId", "workerId");

