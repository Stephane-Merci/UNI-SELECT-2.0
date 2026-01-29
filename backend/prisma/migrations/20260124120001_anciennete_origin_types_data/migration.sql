-- Step 2/2: Rename column (if it exists) and migrate data.
-- Fresh DBs already have "anciennete" from init; older DBs had "matricule".
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Worker' AND column_name = 'matricule'
  ) THEN
    ALTER TABLE "Worker" RENAME COLUMN "matricule" TO "anciennete";
  END IF;
END $$;

UPDATE "Worker" SET "type" = 'PERMANENT_JOUR' WHERE "type" = 'JOUR';
UPDATE "Worker" SET "type" = 'PERMANENT_SOIR' WHERE "type" = 'SOIR';

ALTER TABLE "Worker" ALTER COLUMN "type" SET DEFAULT 'PERMANENT_JOUR';
