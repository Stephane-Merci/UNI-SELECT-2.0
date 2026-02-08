-- Run this if replacements feature returns 500 (BookingReplacement table missing).
-- Idempotent: safe to run multiple times.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'BookingReplacement') THEN
    CREATE TABLE "BookingReplacement" (
      "id" TEXT NOT NULL,
      "bookingId" TEXT NOT NULL,
      "postId" TEXT NOT NULL,
      "replacement1WorkerId" TEXT,
      "replacement2WorkerId" TEXT,
      "replacement3WorkerId" TEXT,
      CONSTRAINT "BookingReplacement_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX "BookingReplacement_bookingId_postId_key" ON "BookingReplacement"("bookingId", "postId");
    CREATE INDEX "BookingReplacement_bookingId_idx" ON "BookingReplacement"("bookingId");
    ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_replacement1WorkerId_fkey" FOREIGN KEY ("replacement1WorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_replacement2WorkerId_fkey" FOREIGN KEY ("replacement2WorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_replacement3WorkerId_fkey" FOREIGN KEY ("replacement3WorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
