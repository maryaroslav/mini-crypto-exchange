import { TradeOrderService } from '../tradeOrder.service';
import { PriceProvider } from '../../lib/priceProvider';
import { InsufficientFundsError } from '../../errors/AppError';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    wallet: {
      findUnique: jest.fn(),
    },
    tradeOrder: {
      create: jest.fn(),
    },
  },
}));

import { prisma } from '../../lib/prisma';

const mockPriceProvider: jest.Mocked<PriceProvider> = {
  getCurrentPrice: jest.fn(),
};
const WALLET_ID = '00000000-0000-0000-0000-000000000001';

function makeWallet(fiatBalance: number, assets: unknown[] = []) {
  return { id: WALLET_ID, fiatBalance, assets };
}

describe('TradeOrderService', () => {
  let service: TradeOrderService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TradeOrderService(mockPriceProvider);
  });

  describe('BR1 – BUY order rejected when fiat balance is insufficient', () => {
    it('throws InsufficientFundsError when balance < totalCost', async () => {
      (prisma.wallet.findUnique as jest.Mock).mockResolvedValue(
        makeWallet(100),
      );

      const dto = {
        walletId: WALLET_ID,
        symbol: 'BTC',
        type: 'BUY' as const,
        quantity: 1,
        targetPrice: 200,
      };

      await expect(service.createOrder(dto)).rejects.toThrow(InsufficientFundsError);
    });

    it('throws InsufficientFundsError when balance covers cost but NOT commission', async () => {
      (prisma.wallet.findUnique as jest.Mock).mockResolvedValue(
        makeWallet(200),
      );

      const dto = {
        walletId: WALLET_ID,
        symbol: 'ETH',
        type: 'BUY' as const,
        quantity: 1,
        targetPrice: 200,
      };

      await expect(service.createOrder(dto)).rejects.toThrow(InsufficientFundsError);
    });

    it('does NOT throw when fiat balance is exactly enough (cost + commission)', async () => {
      (prisma.wallet.findUnique as jest.Mock).mockResolvedValue(
        makeWallet(202),
      );
      mockPriceProvider.getCurrentPrice.mockResolvedValue(99999);
      (prisma.tradeOrder.create as jest.Mock).mockResolvedValue({
        id: 'order-1',
        status: 'PENDING',
      });

      const dto = {
        walletId: WALLET_ID,
        symbol: 'BTC',
        type: 'BUY' as const,
        quantity: 1,
        targetPrice: 200,
      };

      await expect(service.createOrder(dto)).resolves.toBeDefined();
    });
  });
});
