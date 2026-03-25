import { PrismaClient } from '@prisma/client';

export default async function globalTeardown() {
  const prisma = new PrismaClient({
    datasources: { db: { url: 'file:./prisma/test.db' } },
  });
  await prisma.$disconnect();
}
