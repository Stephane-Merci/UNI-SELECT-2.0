@echo off
REM Script to run database migrations on Windows

echo Generating Prisma Client...
call npx prisma generate

echo Running migrations...
call npx prisma migrate dev --name add_plan_system

echo Migration complete!
pause