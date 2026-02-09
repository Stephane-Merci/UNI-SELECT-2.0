-- Add 4th replacement slot to existing BookingReplacement table (run on production if you already have the table).
-- Usage: npx prisma db execute --file prisma/add_replacement4_column.sql

ALTER TABLE "BookingReplacement" ADD COLUMN IF NOT EXISTS "replacement4WorkerId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingReplacement_replacement4WorkerId_fkey') THEN
    ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_replacement4WorkerId_fkey" FOREIGN KEY ("replacement4WorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
