import express from 'express';
import { walletRouter } from './routes/wallet.routes';
import { tradeOrderRouter } from './routes/tradeOrder.routes';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): express.Application {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/wallets', walletRouter);
  app.use('/orders', tradeOrderRouter);

  app.use(errorHandler);

  return app;
}
