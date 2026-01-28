# 🚀 Solution Rapide - Migration avec Données Existantes

## ⚠️ Problèmes Identifiés

1. **EPERM Error** : Le serveur backend est en cours d'exécution
2. **Migration Error** : 6 assignments existants sans `planId`

## ✅ Solution Rapide (Recommandée)

### Étape 1 : Arrêter le serveur backend

Appuyez sur `Ctrl+C` dans le terminal où le serveur tourne.

### Étape 2 : Créer la migration en mode "create-only"

```bash
cd backend
npx prisma migrate dev --create-only --name add_plan_system
```

### Étape 3 : Modifier le fichier de migration

Ouvrez le fichier créé dans :
`prisma/migrations/[timestamp]_add_plan_system/migration.sql`

**Remplacez tout le contenu par** :

```sql
-- Créer les tables Plan et WorkerPresence
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

-- Ajouter planId comme nullable temporairement
ALTER TABLE "Assignment" ADD COLUMN "planId" TEXT;

-- Créer un plan "Migration" pour les assignments existants
INSERT INTO "Plan" ("id", "name", "createdAt", "updatedAt")
VALUES ('migration-' || gen_random_uuid()::text, 'Plan Migration', NOW(), NOW());

-- Assigner tous les assignments existants au plan de migration
UPDATE "Assignment" 
SET "planId" = (SELECT "id" FROM "Plan" WHERE "name" = 'Plan Migration' LIMIT 1)
WHERE "planId" IS NULL;

-- Rendre planId NOT NULL maintenant qu'il a des valeurs
ALTER TABLE "Assignment" ALTER COLUMN "planId" SET NOT NULL;

-- Ajouter les contraintes de clé étrangère
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkerPresence" ADD CONSTRAINT "WorkerPresence_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkerPresence" ADD CONSTRAINT "WorkerPresence_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Créer les index et contraintes uniques
CREATE UNIQUE INDEX "Assignment_planId_workerId_key" ON "Assignment"("planId", "workerId");
CREATE UNIQUE INDEX "WorkerPresence_planId_workerId_key" ON "WorkerPresence"("planId", "workerId");
CREATE INDEX "Assignment_planId_idx" ON "Assignment"("planId");
CREATE INDEX "Plan_name_idx" ON "Plan"("name");
CREATE INDEX "Plan_date_idx" ON "Plan"("date");
CREATE INDEX "WorkerPresence_planId_idx" ON "WorkerPresence"("planId");
CREATE INDEX "WorkerPresence_workerId_idx" ON "WorkerPresence"("workerId");
CREATE INDEX "WorkerPresence_type_idx" ON "WorkerPresence"("type");
```

### Étape 4 : Appliquer la migration

```bash
npx prisma migrate dev
```

### Étape 5 : Régénérer le client Prisma

```bash
npx prisma generate
```

### Étape 6 : Redémarrer le serveur

```bash
npm run dev
```

## ✅ Vérification

Après ces étapes :
- ✅ Les tables `Plan` et `WorkerPresence` sont créées
- ✅ Les 6 assignments existants sont assignés au "Plan Migration"
- ✅ Le client Prisma est régénéré
- ✅ Vous pouvez créer de nouveaux plans

## 📝 Note

Le "Plan Migration" contient vos assignments existants. Vous pouvez :
- Le renommer dans l'interface
- Le supprimer si vous n'en avez plus besoin
- Le garder comme référence
