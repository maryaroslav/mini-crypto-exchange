/**
 * Runs once after all test suites.
 * Disconnects the Prisma client used for the test DB.
 */
import { PrismaClient } from '@prisma/client';

export default async function globalTeardown() {
  const prisma = new PrismaClient({
    datasources: { db: { url: 'file:./prisma/test.db' } },
  });
  await prisma.$disconnect();
}
