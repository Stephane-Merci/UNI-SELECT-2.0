-- Step 1/2: Add new WorkerType enum values only.
-- PostgreSQL requires new enum values to be committed before use;
-- the rename/update step is in the next migration.
ALTER TYPE "WorkerType" ADD VALUE IF NOT EXISTS 'PERMANENT_JOUR';
ALTER TYPE "WorkerType" ADD VALUE IF NOT EXISTS 'PERMANENT_SOIR';
ALTER TYPE "WorkerType" ADD VALUE IF NOT EXISTS 'MOBILITE_DU_JOUR';
ALTER TYPE "WorkerType" ADD VALUE IF NOT EXISTS 'MOBILITE_DU_SOIR';
