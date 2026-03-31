-- AlterTable
ALTER TABLE "BookingReplacement" ADD COLUMN "replacement4WorkerId" TEXT;

-- AddForeignKey
ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_replacement4WorkerId_fkey" FOREIGN KEY ("replacement4WorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
