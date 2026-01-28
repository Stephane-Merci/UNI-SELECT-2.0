-- Migration script pour ajouter le système de plans avec données existantes
-- À exécuter manuellement si la migration automatique échoue

-- Étape 1 : Ajouter la colonne planId comme nullable temporairement
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "planId" TEXT;

-- Étape 2 : Créer les tables Plan et WorkerPresence (si elles n'existent pas)
CREATE TABLE IF NOT EXISTS "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkerPresence" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "type" "WorkerType" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkerPresence_pkey" PRIMARY KEY ("id")
);

-- Étape 3 : Créer un plan "Migration" pour les assignments existants
DO $$
DECLARE
    migration_plan_id TEXT;
BEGIN
    -- Générer un ID unique
    migration_plan_id := 'migration-' || gen_random_uuid()::text;
    
    -- Créer le plan de migration
    INSERT INTO "Plan" ("id", "name", "createdAt", "updatedAt")
    VALUES (migration_plan_id, 'Plan Migration (Assignments existants)', NOW(), NOW())
    ON CONFLICT DO NOTHING;
    
    -- Assigner tous les assignments existants au plan de migration
    UPDATE "Assignment" 
    SET "planId" = migration_plan_id
    WHERE "planId" IS NULL;
END $$;

-- Étape 4 : Rendre la colonne planId NOT NULL maintenant qu'elle a des valeurs
ALTER TABLE "Assignment" ALTER COLUMN "planId" SET NOT NULL;

-- Étape 5 : Ajouter les contraintes de clé étrangère
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Assignment_planId_fkey'
    ) THEN
        ALTER TABLE "Assignment" 
        ADD CONSTRAINT "Assignment_planId_fkey" 
        FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'WorkerPresence_planId_fkey'
    ) THEN
        ALTER TABLE "WorkerPresence" 
        ADD CONSTRAINT "WorkerPresence_planId_fkey" 
        FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'WorkerPresence_workerId_fkey'
    ) THEN
        ALTER TABLE "WorkerPresence" 
        ADD CONSTRAINT "WorkerPresence_workerId_fkey" 
        FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Étape 6 : Créer les index et contraintes uniques
CREATE UNIQUE INDEX IF NOT EXISTS "Assignment_planId_workerId_key" ON "Assignment"("planId", "workerId");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkerPresence_planId_workerId_key" ON "WorkerPresence"("planId", "workerId");
CREATE INDEX IF NOT EXISTS "Assignment_planId_idx" ON "Assignment"("planId");
CREATE INDEX IF NOT EXISTS "Plan_name_idx" ON "Plan"("name");
CREATE INDEX IF NOT EXISTS "Plan_date_idx" ON "Plan"("date");
CREATE INDEX IF NOT EXISTS "WorkerPresence_planId_idx" ON "WorkerPresence"("planId");
CREATE INDEX IF NOT EXISTS "WorkerPresence_workerId_idx" ON "WorkerPresence"("workerId");
CREATE INDEX IF NOT EXISTS "WorkerPresence_type_idx" ON "WorkerPresence"("type");
