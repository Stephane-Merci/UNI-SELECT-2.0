-- Per-worker machinery checks require UNIQUE (planId, postId, workerId).
-- Some DBs still have an older UNIQUE only on (planId, postId) under varying names.
-- This migration drops ANY unique constraint on public."MachineryCheck" whose
-- columns are exactly planId + postId (any order), then ensures the triple exists.

DO $$
DECLARE
  r RECORD;
  cols TEXT[];
BEGIN
  FOR r IN
    SELECT c.oid AS con_oid, c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE t.relname = 'MachineryCheck'
      AND n.nspname = 'public'
      AND c.contype = 'u'
  LOOP
    SELECT coalesce(array_agg(a.attname::text ORDER BY u.ordinality), ARRAY[]::text[])
    INTO cols
    FROM pg_constraint c2
    JOIN LATERAL unnest(c2.conkey) WITH ORDINALITY AS u(attnum, ordinality) ON true
    JOIN pg_attribute a ON a.attrelid = c2.conrelid AND a.attnum = u.attnum AND NOT a.attisdropped
    WHERE c2.oid = r.con_oid;

    IF cardinality(cols) = 2 AND cols @> ARRAY['planId', 'postId'] AND cols <@ ARRAY['planId', 'postId'] THEN
      EXECUTE format('ALTER TABLE "MachineryCheck" DROP CONSTRAINT %I', r.conname);
    END IF;
  END LOOP;
END $$;

-- Standalone unique index (no table constraint), if any
DROP INDEX IF EXISTS "MachineryCheck_planId_postId_key";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MachineryCheck_planId_postId_workerId_key'
  ) THEN
    ALTER TABLE "MachineryCheck"
      ADD CONSTRAINT "MachineryCheck_planId_postId_workerId_key"
      UNIQUE ("planId", "postId", "workerId");
  END IF;
END $$;
