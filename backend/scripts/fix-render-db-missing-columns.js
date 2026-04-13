const { PrismaClient } = require('../src/generated/prisma');

const RENDER_DB_URL = "postgresql://uni_select_db_user:VQ4YJBrnTQWv84teEfF33CmUai4X3aQ2@dpg-d5t29uf5r7bs73bd0l80-a.oregon-postgres.render.com/uni_select_db";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: RENDER_DB_URL,
    },
  },
});

async function main() {
  console.log('Adding missing columns to Post table in Render database...');
  try {
    // Add isMachineryFaulty
    console.log('Adding isMachineryFaulty...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "isMachineryFaulty" BOOLEAN NOT NULL DEFAULT false`);
    
    // Add needsMachinery
    console.log('Adding needsMachinery...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "needsMachinery" BOOLEAN NOT NULL DEFAULT false`);
    
    console.log('Successfully added missing columns to Render database.');
  } catch (error) {
    console.error('Failed to update Render database:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
