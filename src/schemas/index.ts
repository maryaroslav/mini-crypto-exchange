import { z } from 'zod';

export const CreateWalletSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  fiatBalance: z.number().nonnegative('Balance must be >= 0').default(0),
});
export type CreateWalletDTO = z.infer<typeof CreateWalletSchema>;

export const OrderTypeEnum = z.enum(['BUY', 'SELL']);
export type OrderType = z.infer<typeof OrderTypeEnum>;

export const CreateTradeOrderSchema = z.object({
  walletId: z.string().uuid('walletId must be a valid UUID'),
  symbol: z.string().min(1, 'Symbol is required').toUpperCase(),
  type: OrderTypeEnum,
  quantity: z.number().positive('Quantity must be > 0'),
  targetPrice: z.number().positive('Target price must be > 0'),
});

export type CreateTradeOrderDTO = z.infer<typeof CreateTradeOrderSchema>;
