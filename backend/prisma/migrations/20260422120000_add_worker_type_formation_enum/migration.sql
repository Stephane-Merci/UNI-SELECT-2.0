-- Ensures WorkerType.FORMATION exists for Worker.type and WorkerPresence.type.
-- Idempotent: safe if 20260421130000_add_worker_type_formation already ran on this database.
ALTER TYPE "public"."WorkerType" ADD VALUE IF NOT EXISTS 'FORMATION';
