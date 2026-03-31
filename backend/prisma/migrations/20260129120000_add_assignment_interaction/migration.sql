-- CreateTable: AssignmentInteraction for plan export (interaction/migration history)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'AssignmentInteraction') THEN
    CREATE TABLE "AssignmentInteraction" (
      "id" TEXT NOT NULL,
      "planId" TEXT NOT NULL,
      "workerId" TEXT NOT NULL,
      "postId" TEXT NOT NULL,
      "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "endedAt" TIMESTAMP(3),
      CONSTRAINT "AssignmentInteraction_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "AssignmentInteraction_planId_idx" ON "AssignmentInteraction"("planId");
    CREATE INDEX "AssignmentInteraction_workerId_idx" ON "AssignmentInteraction"("workerId");
    ALTER TABLE "AssignmentInteraction" ADD CONSTRAINT "AssignmentInteraction_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "AssignmentInteraction" ADD CONSTRAINT "AssignmentInteraction_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "AssignmentInteraction" ADD CONSTRAINT "AssignmentInteraction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
