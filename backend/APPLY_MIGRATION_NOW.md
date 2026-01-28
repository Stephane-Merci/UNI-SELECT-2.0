# 🚨 URGENT : Appliquer la Migration

## Erreur Actuelle
```
The table `public.Plan` does not exist in the current database.
```

Cela signifie que la migration n'a pas encore été appliquée à la base de données.

## ✅ Solution Immédiate

### Option 1 : Utiliser le script SQL (RECOMMANDÉ - Plus Simple)

#### Étape 1 : Arrêter le serveur
Appuyez sur `Ctrl+C` dans le terminal où le serveur tourne.

#### Étape 2 : Exécuter le script SQL

**Méthode A : Via psql (si vous avez accès)**
```bash
cd backend
psql -U votre_user -d worker_management -f migrate-with-existing-data.sql
```

**Méthode B : Via un client PostgreSQL (pgAdmin, DBeaver, etc.)**
1. Ouvrez votre client PostgreSQL
2. Connectez-vous à la base de données `worker_management`
3. Ouvrez le fichier `backend/migrate-with-existing-data.sql`
4. Exécutez tout le contenu

#### Étape 3 : Marquer la migration comme appliquée
```bash
cd backend
npx prisma migrate resolve --applied add_plan_system
```

#### Étape 4 : Régénérer le client Prisma
```bash
npx prisma generate
```

#### Étape 5 : Redémarrer le serveur
```bash
npm run dev
```

---

### Option 2 : Modifier et appliquer la migration Prisma

#### Étape 1 : Arrêter le serveur
Appuyez sur `Ctrl+C`

#### Étape 2 : Créer la migration en mode create-only (si pas déjà fait)
```bash
cd backend
npx prisma migrate dev --create-only --name add_plan_system
```

#### Étape 3 : Trouver et modifier le fichier de migration
Le fichier se trouve dans :
`prisma/migrations/[timestamp]_add_plan_system/migration.sql`

**Remplacez TOUT le contenu** par le contenu du fichier `QUICK_FIX.md` (section SQL).

#### Étape 4 : Appliquer la migration
```bash
npx prisma migrate dev
```

#### Étape 5 : Régénérer le client
```bash
npx prisma generate
```

#### Étape 6 : Redémarrer le serveur
```bash
npm run dev
```

---

## 🔍 Vérification

Après avoir appliqué la migration, vérifiez que les tables existent :

```sql
-- Dans psql ou votre client PostgreSQL
\dt

-- Vous devriez voir :
-- Plan
-- WorkerPresence
-- Assignment (avec la colonne planId)
```

## ⚠️ Si vous avez des erreurs

Si vous rencontrez des erreurs lors de l'exécution du script SQL, vérifiez :
1. Que vous êtes connecté à la bonne base de données
2. Que PostgreSQL est en cours d'exécution
3. Que vous avez les permissions nécessaires
