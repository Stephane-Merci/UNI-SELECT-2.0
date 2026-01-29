-- This migration was a full init for an older schema. When the DB was already
-- initialized by 20250124000000_init (WorkerType, Worker, Post, etc. exist),
-- we skip it to avoid "type WorkerType already exists" and duplicate tables.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Worker') THEN
    NULL; -- Schema already exists, no-op
  ELSIF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkerType') THEN
    -- Original migration: create enum and tables (old schema without Plan/WorkerPresence)
    CREATE TYPE "WorkerType" AS ENUM ('JOUR', 'SOIR', 'ABSENT', 'OCCASIONEL_DU_JOUR', 'OCCASIONEL_SOIR', 'VACANCES', 'LIBERATION_EXTERNE', 'INVALIDITE', 'PRERETRAITE', 'CONGE_PARENTAL');
    CREATE TABLE "Worker" (
      "id" TEXT NOT NULL,
      "matricule" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "type" "WorkerType" NOT NULL DEFAULT 'JOUR',
      "originalPostId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
    );
    CREATE TABLE "Post" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
    );
    CREATE TABLE "Assignment" (
      "id" TEXT NOT NULL,
      "workerId" TEXT NOT NULL,
      "postId" TEXT NOT NULL,
      "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "assignedBy" TEXT,
      CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
    );
    CREATE TABLE "Manager" (
      "id" TEXT NOT NULL,
      "username" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Manager_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX "Worker_matricule_key" ON "Worker"("matricule");
    CREATE INDEX "Worker_matricule_idx" ON "Worker"("matricule");
    CREATE INDEX "Worker_type_idx" ON "Worker"("type");
    CREATE INDEX "Post_name_idx" ON "Post"("name");
    CREATE INDEX "Assignment_workerId_idx" ON "Assignment"("workerId");
    CREATE INDEX "Assignment_postId_idx" ON "Assignment"("postId");
    CREATE UNIQUE INDEX "Assignment_workerId_postId_assignedAt_key" ON "Assignment"("workerId", "postId", "assignedAt");
    CREATE UNIQUE INDEX "Manager_username_key" ON "Manager"("username");
    CREATE UNIQUE INDEX "Manager_email_key" ON "Manager"("email");
    CREATE INDEX "Manager_username_idx" ON "Manager"("username");
    CREATE INDEX "Manager_email_idx" ON "Manager"("email");
    ALTER TABLE "Worker" ADD CONSTRAINT "Worker_originalPostId_fkey" FOREIGN KEY ("originalPostId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
