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
  try {
    const columns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Post' AND (column_name = 'isMachineryFaulty' OR column_name = 'needsMachinery' OR column_name = 'machineryStatus');
    `;
    console.log('Result:', columns);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
