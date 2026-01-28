# ⚠️ ERREUR : Cannot read properties of undefined (reading 'create')

## 🔴 Problème

L'erreur `Cannot read properties of undefined (reading 'create')` signifie que le client Prisma n'a pas été régénéré après l'ajout du modèle `Plan` dans le schéma.

## ✅ Solution IMMÉDIATE

### Étape 1 : Régénérer le client Prisma

```bash
cd backend
npx prisma generate
```

### Étape 2 : Redémarrer le serveur backend

Arrêtez le serveur (Ctrl+C) et redémarrez-le :

```bash
npm run dev
```

## 📋 Pourquoi cette erreur ?

Quand vous ajoutez un nouveau modèle (comme `Plan`) dans `schema.prisma`, Prisma doit régénérer son client TypeScript pour inclure les nouvelles méthodes comme `prisma.plan.create()`.

Sans régénération, le client Prisma ne connaît pas le modèle `Plan`, donc `prisma.plan` est `undefined`.

## 🔄 Workflow complet (si vous n'avez pas encore fait la migration)

Si vous n'avez pas encore exécuté la migration, faites ceci dans l'ordre :

```bash
cd backend

# 1. Générer le client Prisma
npx prisma generate

# 2. Créer et appliquer la migration
npx prisma migrate dev --name add_plan_system

# 3. Redémarrer le serveur
npm run dev
```

## ✅ Vérification

Après `prisma generate`, vous devriez voir :

```
✔ Generated Prisma Client (X.XX s)
```

Ensuite, `prisma.plan` sera disponible et l'erreur disparaîtra.
