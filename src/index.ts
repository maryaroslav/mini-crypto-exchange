import { createApp } from './app';
import { prisma } from './lib/prisma';

const PORT = process.env.PORT ?? 3000;
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`[server] Mini Crypto Exchange running on http://localhost:${PORT}`);
});

process.on('SIGTERM', async () => {
  console.log('[server] SIGTERM received — shutting down gracefully');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});
