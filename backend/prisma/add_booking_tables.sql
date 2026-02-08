-- Run this script if GET /api/bookings returns 500 (tables missing).
-- Idempotent: safe to run multiple times.
-- Usage: psql $DATABASE_URL -f prisma/add_booking_tables.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Booking') THEN
    CREATE TABLE "Booking" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "effectiveDate" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "Booking_effectiveDate_idx" ON "Booking"("effectiveDate");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'BookingAssignment') THEN
    CREATE TABLE "BookingAssignment" (
      "id" TEXT NOT NULL,
      "bookingId" TEXT NOT NULL,
      "workerId" TEXT NOT NULL,
      "postId" TEXT NOT NULL,
      CONSTRAINT "BookingAssignment_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX "BookingAssignment_bookingId_workerId_key" ON "BookingAssignment"("bookingId", "workerId");
    CREATE INDEX "BookingAssignment_bookingId_idx" ON "BookingAssignment"("bookingId");
    ALTER TABLE "BookingAssignment" ADD CONSTRAINT "BookingAssignment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "BookingAssignment" ADD CONSTRAINT "BookingAssignment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "BookingAssignment" ADD CONSTRAINT "BookingAssignment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
