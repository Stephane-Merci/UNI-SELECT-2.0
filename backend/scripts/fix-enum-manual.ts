import { PrismaClient } from './src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('Ensuring WorkerType enum values TRAVAIL_LEGER, FORMATION...');
  try {
    // We use $executeRawUnsafe because ADD VALUE cannot be used in a transaction
    // and Prisma wraps everything in a transaction by default if not careful.
    // However, ADD VALUE 'TRAVAIL_LEGER' should be fine in a simple executeRaw if it's the only thing.
    // Actually, in Postgres, ALTER TYPE ... ADD VALUE cannot be executed inside a transaction block.
    
    // So we'll try to execute it.
    await prisma.$executeRawUnsafe(`ALTER TYPE "WorkerType" ADD VALUE IF NOT EXISTS 'TRAVAIL_LEGER'`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "WorkerType" ADD VALUE IF NOT EXISTS 'FORMATION'`);
    console.log('Successfully added TRAVAIL_LEGER / FORMATION to WorkerType enum (or they already existed).');
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      console.log('TRAVAIL_LEGER / FORMATION already exists in WorkerType enum.');
    } else {
      console.error('Failed to add WorkerType value:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
