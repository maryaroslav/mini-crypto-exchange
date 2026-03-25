import { Router, Request, Response, NextFunction } from 'express';
import { CreateTradeOrderSchema } from '../schemas';
import { TradeOrderService } from '../services/tradeOrder.service';
import { MarketPriceProvider } from '../lib/priceProvider';

export const tradeOrderRouter = Router();

tradeOrderRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = CreateTradeOrderSchema.parse(req.body);
    const service = new TradeOrderService(new MarketPriceProvider());
    const order = await service.createOrder(dto);
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

tradeOrderRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = new TradeOrderService(new MarketPriceProvider());
    const order = await service.getOrderById(req.params.id as string);
    res.json(order);
  } catch (err) {
    next(err);
  }
});
