# 🔧 Correction des Erreurs de Migration

## Problème 1 : EPERM Error

L'erreur `EPERM: operation not permitted` signifie que le serveur backend est en cours d'exécution et verrouille les fichiers Prisma.

### Solution :
1. **Arrêtez le serveur backend** (Ctrl+C dans le terminal où il tourne)
2. **Puis régénérez** :
   ```bash
   npx prisma generate
   ```

## Problème 2 : Migration avec données existantes

Vous avez 6 assignments existants sans `planId`. Il faut créer un plan "Migration" et les y assigner.

### Solution : Migration en 3 étapes

#### Étape 1 : Créer la migration en mode "create-only"

```bash
npx prisma migrate dev --create-only --name add_plan_system
```

#### Étape 2 : Modifier le fichier de migration

Ouvrez le fichier créé dans `prisma/migrations/[timestamp]_add_plan_system/migration.sql`

**AVANT** (ne fonctionnera pas) :
```sql
ALTER TABLE "Assignment" ADD COLUMN "planId" TEXT NOT NULL;
```

**APRÈS** (modifiez pour) :
```sql
-- Étape 1 : Ajouter la colonne comme nullable temporairement
ALTER TABLE "Assignment" ADD COLUMN "planId" TEXT;

-- Étape 2 : Créer les tables Plan et WorkerPresence
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkerPresence" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "type" "WorkerType" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkerPresence_pkey" PRIMARY KEY ("id")
);

-- Étape 3 : Créer un plan "Migration" pour les assignments existants
INSERT INTO "Plan" ("id", "name", "createdAt", "updatedAt")
VALUES ('migration-plan-' || gen_random_uuid()::text, 'Plan Migration (Assignments existants)', NOW(), NOW());

-- Étape 4 : Assigner tous les assignments existants au plan de migration
UPDATE "Assignment" 
SET "planId" = (SELECT "id" FROM "Plan" WHERE "name" = 'Plan Migration (Assignments existants)' LIMIT 1)
WHERE "planId" IS NULL;

-- Étape 5 : Rendre la colonne planId NOT NULL maintenant qu'elle a des valeurs
ALTER TABLE "Assignment" ALTER COLUMN "planId" SET NOT NULL;

-- Étape 6 : Ajouter les contraintes et index
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkerPresence" ADD CONSTRAINT "WorkerPresence_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkerPresence" ADD CONSTRAINT "WorkerPresence_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Assignment_planId_workerId_key" ON "Assignment"("planId", "workerId");
CREATE UNIQUE INDEX "WorkerPresence_planId_workerId_key" ON "WorkerPresence"("planId", "workerId");
CREATE INDEX "Assignment_planId_idx" ON "Assignment"("planId");
CREATE INDEX "Plan_name_idx" ON "Plan"("name");
CREATE INDEX "Plan_date_idx" ON "Plan"("date");
CREATE INDEX "WorkerPresence_planId_idx" ON "WorkerPresence"("planId");
CREATE INDEX "WorkerPresence_workerId_idx" ON "WorkerPresence"("workerId");
CREATE INDEX "WorkerPresence_type_idx" ON "WorkerPresence"("type");
```

#### Étape 3 : Appliquer la migration

```bash
npx prisma migrate dev
```

## Solution Alternative (Plus Simple)

Si vous préférez, vous pouvez supprimer les assignments existants et recommencer :

```bash
# Se connecter à PostgreSQL
psql -U votre_user -d worker_management

# Supprimer les assignments existants
DELETE FROM "Assignment";

# Puis faire la migration normalement
npx prisma migrate dev --name add_plan_system
```

**⚠️ ATTENTION** : Cela supprimera toutes les assignments existantes !
