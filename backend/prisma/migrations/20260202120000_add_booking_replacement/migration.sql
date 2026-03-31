-- CreateTable
CREATE TABLE "BookingReplacement" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "replacement1WorkerId" TEXT,
    "replacement2WorkerId" TEXT,
    "replacement3WorkerId" TEXT,

    CONSTRAINT "BookingReplacement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingReplacement_bookingId_postId_key" ON "BookingReplacement"("bookingId", "postId");

-- CreateIndex
CREATE INDEX "BookingReplacement_bookingId_idx" ON "BookingReplacement"("bookingId");

-- AddForeignKey
ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_replacement1WorkerId_fkey" FOREIGN KEY ("replacement1WorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_replacement2WorkerId_fkey" FOREIGN KEY ("replacement2WorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_replacement3WorkerId_fkey" FOREIGN KEY ("replacement3WorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
