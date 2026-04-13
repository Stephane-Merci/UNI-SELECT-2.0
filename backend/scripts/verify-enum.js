const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.$queryRaw`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = 'public."WorkerType"'::regtype;
    `;
    console.log('Current WorkerType enum values in DB:', result);
  } catch (error) {
    console.error('Error fetching enum values:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
