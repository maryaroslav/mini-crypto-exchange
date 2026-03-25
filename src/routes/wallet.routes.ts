import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { CreateWalletSchema } from '../schemas';
import { NotFoundError } from '../errors/AppError';

export const walletRouter = Router();

walletRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = CreateWalletSchema.parse(req.body);
    const wallet = await prisma.wallet.create({ data: dto });
    res.status(201).json(wallet);
  } catch (err) {
    next(err);
  }
});

walletRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const wallet = await prisma.wallet.findUnique({
      where: { id: req.params.id as string },
      include: { assets: true },
    });
    if (!wallet) throw new NotFoundError('Wallet');
    res.json(wallet);
  } catch (err) {
    next(err);
  }
});
