-- AlterTable
ALTER TABLE "Worker" ADD COLUMN "absenceStartDate" TIMESTAMP(3),
ADD COLUMN "absenceEndDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Manager" ADD COLUMN "resetToken" TEXT,
ADD COLUMN "resetTokenExpiry" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "BookingReplacement" 
ADD COLUMN "replacement5WorkerId" TEXT,
ADD COLUMN "replacement6WorkerId" TEXT,
ADD COLUMN "replacement7WorkerId" TEXT,
ADD COLUMN "replacement8WorkerId" TEXT;

-- CreateTable
CREATE TABLE "UnfilledPosition" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnfilledPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnfilledPosition_planId_idx" ON "UnfilledPosition"("planId");
CREATE INDEX "UnfilledPosition_postId_idx" ON "UnfilledPosition"("postId");

-- AddForeignKey
ALTER TABLE "UnfilledPosition" ADD CONSTRAINT "UnfilledPosition_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnfilledPosition" ADD CONSTRAINT "UnfilledPosition_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_replacement5WorkerId_fkey" FOREIGN KEY ("replacement5WorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_replacement6WorkerId_fkey" FOREIGN KEY ("replacement6WorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_replacement7WorkerId_fkey" FOREIGN KEY ("replacement7WorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_replacement8WorkerId_fkey" FOREIGN KEY ("replacement8WorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "Manager_resetToken_key" ON "Manager"("resetToken");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_workerId_postId_assignedAt_key" ON "Assignment"("workerId", "postId", "assignedAt");

-- DropTable
DROP TABLE IF EXISTS "AssignmentInteraction";
