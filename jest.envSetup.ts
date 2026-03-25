/**
 * Runs in every Jest worker process before any test module is loaded.
 * Sets DATABASE_URL so the Prisma singleton picks up the test database.
 */
process.env.DATABASE_URL = 'file:./prisma/test.db';
