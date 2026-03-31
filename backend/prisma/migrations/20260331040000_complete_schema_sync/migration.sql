-- AlterTable
DO $$ 
BEGIN 
    BEGIN
        ALTER TABLE "Worker" ADD COLUMN "absenceStartDate" TIMESTAMP(3);
    EXCEPTION
        WHEN duplicate_column THEN RAISE NOTICE 'column absenceStartDate already exists in Worker, skipping';
    END;
    BEGIN
        ALTER TABLE "Worker" ADD COLUMN "absenceEndDate" TIMESTAMP(3);
    EXCEPTION
        WHEN duplicate_column THEN RAISE NOTICE 'column absenceEndDate already exists in Worker, skipping';
    END;
    BEGIN
        ALTER TABLE "Manager" ADD COLUMN "resetToken" TEXT;
    EXCEPTION
        WHEN duplicate_column THEN RAISE NOTICE 'column resetToken already exists in Manager, skipping';
    END;
    BEGIN
        ALTER TABLE "Manager" ADD COLUMN "resetTokenExpiry" TIMESTAMP(3);
    EXCEPTION
        WHEN duplicate_column THEN RAISE NOTICE 'column resetTokenExpiry already exists in Manager, skipping';
    END;
    BEGIN
        ALTER TABLE "BookingReplacement" ADD COLUMN "replacement5WorkerId" TEXT;
    EXCEPTION
        WHEN duplicate_column THEN RAISE NOTICE 'column replacement5WorkerId already exists in BookingReplacement, skipping';
    END;
    BEGIN
        ALTER TABLE "BookingReplacement" ADD COLUMN "replacement6WorkerId" TEXT;
    EXCEPTION
        WHEN duplicate_column THEN RAISE NOTICE 'column replacement6WorkerId already exists in BookingReplacement, skipping';
    END;
    BEGIN
        ALTER TABLE "BookingReplacement" ADD COLUMN "replacement7WorkerId" TEXT;
    EXCEPTION
        WHEN duplicate_column THEN RAISE NOTICE 'column replacement7WorkerId already exists in BookingReplacement, skipping';
    END;
    BEGIN
        ALTER TABLE "BookingReplacement" ADD COLUMN "replacement8WorkerId" TEXT;
    EXCEPTION
        WHEN duplicate_column THEN RAISE NOTICE 'column replacement8WorkerId already exists in BookingReplacement, skipping';
    END;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "UnfilledPosition" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnfilledPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'UnfilledPosition_planId_idx' AND n.nspname = 'public') THEN
        CREATE INDEX "UnfilledPosition_planId_idx" ON "UnfilledPosition"("planId");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'UnfilledPosition_postId_idx' AND n.nspname = 'public') THEN
        CREATE INDEX "UnfilledPosition_postId_idx" ON "UnfilledPosition"("postId");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'Manager_resetToken_key' AND n.nspname = 'public') THEN
        CREATE UNIQUE INDEX "Manager_resetToken_key" ON "Manager"("resetToken");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'Assignment_workerId_postId_assignedAt_key' AND n.nspname = 'public') THEN
        CREATE UNIQUE INDEX "Assignment_workerId_postId_assignedAt_key" ON "Assignment"("workerId", "postId", "assignedAt");
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'UnfilledPosition_planId_fkey') THEN
        ALTER TABLE "UnfilledPosition" ADD CONSTRAINT "UnfilledPosition_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'UnfilledPosition_postId_fkey') THEN
        ALTER TABLE "UnfilledPosition" ADD CONSTRAINT "UnfilledPosition_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'BookingReplacement_replacement5WorkerId_fkey') THEN
        ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_replacement5WorkerId_fkey" FOREIGN KEY ("replacement5WorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'BookingReplacement_replacement6WorkerId_fkey') THEN
        ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_replacement6WorkerId_fkey" FOREIGN KEY ("replacement6WorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'BookingReplacement_replacement7WorkerId_fkey') THEN
        ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_replacement7WorkerId_fkey" FOREIGN KEY ("replacement7WorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'BookingReplacement_replacement8WorkerId_fkey') THEN
        ALTER TABLE "BookingReplacement" ADD CONSTRAINT "BookingReplacement_replacement8WorkerId_fkey" FOREIGN KEY ("replacement8WorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- DropTable
DROP TABLE IF EXISTS "AssignmentInteraction";
