const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

async function main() {
  console.log('Ensuring WorkerType enum values TRAVAIL_LEGER, FORMATION...');
  try {
    // ALTER TYPE ... ADD VALUE cannot be executed in a transaction.
    // By default, $executeRaw might wrap it. 
    // However, some versions of Prisma allow it if it's a single statement.
    await prisma.$executeRawUnsafe(`ALTER TYPE "public"."WorkerType" ADD VALUE IF NOT EXISTS 'TRAVAIL_LEGER'`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "public"."WorkerType" ADD VALUE IF NOT EXISTS 'FORMATION'`);
    console.log('Successfully completed enum update.');
  } catch (error) {
    console.error('Error during enum update:', error.message);
    if (error.message.includes('already exists')) {
      console.log('Note: The value might already exist.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
