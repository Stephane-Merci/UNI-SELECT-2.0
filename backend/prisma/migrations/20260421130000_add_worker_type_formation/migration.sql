-- Presence type "Formation" (same role as travail léger in the app).
-- Use public + IF NOT EXISTS so re-runs and mixed environments stay safe.
ALTER TYPE "public"."WorkerType" ADD VALUE IF NOT EXISTS 'FORMATION';
