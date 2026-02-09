-- Run this script on your database if you see: "The table public.Booking does not exist"
-- Use either:  npx prisma db execute --file prisma/create_booking_tables_if_missing.sql
-- Or connect with psql/your DB client and run this file.
-- Safe to run multiple times: tables are created only if they don't exist.

-- 1. Booking
CREATE TABLE IF NOT EXISTS "Booking" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Booking_effectiveDate_idx" ON "Booking"("effectiveDate");

-- 2. BookingAssignment
CREATE TABLE IF NOT EXISTS "BookingAssignment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,

    CONSTRAINT "BookingAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BookingAssignment_bookingId_workerId_key" ON "BookingAssignment"("bookingId", "workerId");
CREATE INDEX IF NOT EXISTS "BookingAssignment_bookingId_idx" ON "BookingAssignment"("bookingId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingAssignment_bookingId_fkey') THEN
    ALTER TABLE "BookingAssignment" ADD CONSTRAINT "BookingAssignment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingAssignment_workerId_fkey') THEN
    ALTER TABLE "BookingAssignment" ADD CONSTRAINT "BookingAssignment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingAssignment_postId_fkey') THEN
    ALTER TABLE "BookingAssignment" ADD CONSTRAINT "BookingAssignment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. BookingReplacement (if not already created)
CREATE TABLE IF NOT EXISTS "BookingReplacement" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "replacement1WorkerId" TEXT,
    "replacement2WorkerId" TEXT,
    "replacement3WorkerId" TEXT,
    "replacement4WorkerId" TEXT,

    CONSTRAINT "BookingReplacement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BookingReplacement_bookingId_postId_key" ON "BookingReplacement"("bookingId", "postId");
CREATE INDEX IF NOT EXISTS "BookingReplacement_bookingId_idx" ON "BookingReplacement"("bookingId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingReplacement_bookingId_fkey') THEN
    ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingReplacement_postId_fkey') THEN
    ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingReplacement_replacement1WorkerId_fkey') THEN
    ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_replacement1WorkerId_fkey" FOREIGN KEY ("replacement1WorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingReplacement_replacement2WorkerId_fkey') THEN
    ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_replacement2WorkerId_fkey" FOREIGN KEY ("replacement2WorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingReplacement_replacement3WorkerId_fkey') THEN
    ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_replacement3WorkerId_fkey" FOREIGN KEY ("replacement3WorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingReplacement_replacement4WorkerId_fkey') THEN
    ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_replacement4WorkerId_fkey" FOREIGN KEY ("replacement4WorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
