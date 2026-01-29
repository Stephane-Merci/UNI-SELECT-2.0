-- Step 2/2: Rename column and migrate data (runs after enum values are committed).
ALTER TABLE "Worker" RENAME COLUMN "matricule" TO "anciennete";

UPDATE "Worker" SET "type" = 'PERMANENT_JOUR' WHERE "type" = 'JOUR';
UPDATE "Worker" SET "type" = 'PERMANENT_SOIR' WHERE "type" = 'SOIR';

ALTER TABLE "Worker" ALTER COLUMN "type" SET DEFAULT 'PERMANENT_JOUR';
