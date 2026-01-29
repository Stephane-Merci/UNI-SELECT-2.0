# Database Migrations

After updating the schema, run:

```bash
cd backend
npx prisma migrate dev --name add_plan_system
```

This will:
1. Create a new migration
2. Apply it to your database
3. Regenerate the Prisma client
