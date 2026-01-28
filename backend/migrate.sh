#!/bin/bash
# Script to run database migrations

echo "Generating Prisma Client..."
npx prisma generate

echo "Running migrations..."
npx prisma migrate dev --name add_plan_system

echo "Migration complete!"