import { TradeOrderService, calculateCommission } from '../tradeOrder.service';
import { PriceProvider } from '../../lib/priceProvider';
import { InsufficientFundsError } from '../../errors/AppError';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
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

  describe('BR2 – SELL order rejected when asset quantity is insufficient', () => {
    it('throws InsufficientFundsError when wallet has no assets at all', async () => {
      (prisma.wallet.findUnique as jest.Mock).mockResolvedValue(
        makeWallet(99999, []),
      );

      const dto = {
        walletId: WALLET_ID,
        symbol: 'BTC',
        type: 'SELL' as const,
        quantity: 1,
        targetPrice: 30000,
      };

      await expect(service.createOrder(dto)).rejects.toThrow(InsufficientFundsError);
    });

    it('throws InsufficientFundsError when asset exists but quantity is insufficient', async () => {
      (prisma.wallet.findUnique as jest.Mock).mockResolvedValue(
        makeWallet(99999, [{ symbol: 'BTC', quantity: 0.5 }]),
      );

      const dto = {
        walletId: WALLET_ID,
        symbol: 'BTC',
        type: 'SELL' as const,
        quantity: 1,
        targetPrice: 30000,
      };

      await expect(service.createOrder(dto)).rejects.toThrow(InsufficientFundsError);
    });

    it('does NOT throw when asset quantity is exactly enough', async () => {
      (prisma.wallet.findUnique as jest.Mock).mockResolvedValue(
        makeWallet(0, [{ symbol: 'BTC', quantity: 1 }]),
      );

      mockPriceProvider.getCurrentPrice.mockResolvedValue(1);
      (prisma.tradeOrder.create as jest.Mock).mockResolvedValue({
        id: 'order-2',
        status: 'PENDING',
      });

      const dto = {
        walletId: WALLET_ID,
        symbol: 'BTC',
        type: 'SELL' as const,
        quantity: 1,
        targetPrice: 30000,
      };

      await expect(service.createOrder(dto)).resolves.toBeDefined();
    });
  });
});

describe('BR3 - calculateCommission', () => {
  it('applies 1% commission when trade total is <= 1000', () => {
    // 5 units × 100 USD = 500 USD  →  1% of 500 = 5
    expect(calculateCommission(5, 100)).toBeCloseTo(5);
  });

  it('applies 1% commission when trade total is exactly 1000', () => {
    // boundary: 1000 is NOT > 1000, so still 1%
    expect(calculateCommission(10, 100)).toBeCloseTo(10);
  });

  it('applies 0.2% commission when trade total is > 1000', () => {
    // 2 × 600 = 1200 USD  →  0.2% of 1200 = 2.4
    expect(calculateCommission(2, 600)).toBeCloseTo(2.4);
  });

  it('applies 0.2% commission on a large trade', () => {
    // 1 × 50000 = 50000 USD  →  0.2% of 50000 = 100
    expect(calculateCommission(1, 50000)).toBeCloseTo(100);
  });

  it('boundary: 1000.01 triggers the reduced 0.2% rate', () => {
    // slightly above 1000 → 0.2%
    expect(calculateCommission(1, 1000.01)).toBeCloseTo(1000.01 * 0.002);
  });
});

describe('TradeOrderService – BR4: order status based on market price', () => {
  let service: TradeOrderService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TradeOrderService(mockPriceProvider);
  });

  describe('BUY orders', () => {
    it('creates PENDING order when current price is ABOVE target (market too expensive)', async () => {
      (prisma.wallet.findUnique as jest.Mock).mockResolvedValue(
        makeWallet(100_000),
      );
      mockPriceProvider.getCurrentPrice.mockResolvedValue(35_000);
      (prisma.tradeOrder.create as jest.Mock).mockImplementation(
        ({ data }: { data: { status: string } }) => Promise.resolve({ id: 'o1', ...data }),
      );

      const dto = { walletId: WALLET_ID, symbol: 'BTC', type: 'BUY' as const, quantity: 1, targetPrice: 30_000 };

      const order = await service.createOrder(dto);

      expect(order.status).toBe('PENDING');
    });

    it('creates COMPLETED order when current price is AT or BELOW target (good deal)', async () => {
      (prisma.wallet.findUnique as jest.Mock).mockResolvedValue(
        makeWallet(100_000),
      );
      mockPriceProvider.getCurrentPrice.mockResolvedValue(28_000);
      (prisma.$transaction as jest.Mock).mockResolvedValue({ id: 'o2', status: 'COMPLETED' });

      const dto = { walletId: WALLET_ID, symbol: 'BTC', type: 'BUY' as const, quantity: 1, targetPrice: 30_000 };

      const order = await service.createOrder(dto);

      expect(order.status).toBe('COMPLETED');
    });
  });

  describe('SELL orders', () => {
    it('creates PENDING order when current price is BELOW target (not profitable yet)', async () => {
      (prisma.wallet.findUnique as jest.Mock).mockResolvedValue(
        makeWallet(0, [{ symbol: 'BTC', quantity: 2 }]),
      );
      mockPriceProvider.getCurrentPrice.mockResolvedValue(28_000);
      (prisma.tradeOrder.create as jest.Mock).mockImplementation(
        ({ data }: { data: { status: string } }) => Promise.resolve({ id: 'o3', ...data }),
      );

      const dto = { walletId: WALLET_ID, symbol: 'BTC', type: 'SELL' as const, quantity: 1, targetPrice: 30_000 };

      const order = await service.createOrder(dto);

      expect(order.status).toBe('PENDING');
    });

    it('creates COMPLETED order when current price is AT or ABOVE target (sold!)', async () => {
      (prisma.wallet.findUnique as jest.Mock).mockResolvedValue(
        makeWallet(0, [{ symbol: 'BTC', quantity: 2 }]),
      );
      mockPriceProvider.getCurrentPrice.mockResolvedValue(32_000);
      (prisma.$transaction as jest.Mock).mockResolvedValue({ id: 'o4', status: 'COMPLETED' });

      const dto = { walletId: WALLET_ID, symbol: 'BTC', type: 'SELL' as const, quantity: 1, targetPrice: 30_000 };

      const order = await service.createOrder(dto);

      expect(order.status).toBe('COMPLETED');
    });
  });
});

describe('TradeOrderService – BR5: transactional balance update', () => {
  let service: TradeOrderService;

  const mockTx = {
    wallet: { update: jest.fn() },
    asset: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    tradeOrder: { create: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TradeOrderService(mockPriceProvider);

    (prisma.$transaction as jest.Mock).mockImplementation(
      (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
    );
  });

  describe('BUY order that becomes COMPLETED', () => {
    const buyDto = {
      walletId: WALLET_ID,
      symbol: 'BTC',
      type: 'BUY' as const,
      quantity: 2,
      targetPrice: 100,
    };

    beforeEach(() => {
      (prisma.wallet.findUnique as jest.Mock).mockResolvedValue(
        makeWallet(500),
      );
      mockPriceProvider.getCurrentPrice.mockResolvedValue(90);
      mockTx.tradeOrder.create.mockResolvedValue({ id: 'o5', status: 'COMPLETED' });
    });

    it('calls prisma.$transaction when order is COMPLETED', async () => {
      await service.createOrder(buyDto);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('decrements wallet fiatBalance by totalCost + commission on BUY', async () => {
      await service.createOrder(buyDto);
      expect(mockTx.wallet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: WALLET_ID },
          data: { fiatBalance: { decrement: 202 } },
        }),
      );
    });

    it('upserts asset with incremented quantity on BUY', async () => {
      await service.createOrder(buyDto);
      expect(mockTx.asset.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { walletId_symbol: { walletId: WALLET_ID, symbol: 'BTC' } },
          update: { quantity: { increment: 2 } },
          create: { walletId: WALLET_ID, symbol: 'BTC', quantity: 2 },
        }),
      );
    });
  });

  describe('SELL order that becomes COMPLETED', () => {
    const sellDto = {
      walletId: WALLET_ID,
      symbol: 'ETH',
      type: 'SELL' as const,
      quantity: 3,
      targetPrice: 200,
    };

    beforeEach(() => {
      (prisma.wallet.findUnique as jest.Mock).mockResolvedValue(
        makeWallet(0, [{ symbol: 'ETH', quantity: 5 }]),
      );
      mockPriceProvider.getCurrentPrice.mockResolvedValue(250);
      mockTx.tradeOrder.create.mockResolvedValue({ id: 'o6', status: 'COMPLETED' });
    });

    it('calls prisma.$transaction when order is COMPLETED', async () => {
      await service.createOrder(sellDto);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('increments wallet fiatBalance by totalCost - commission on SELL', async () => {
      await service.createOrder(sellDto);
      expect(mockTx.wallet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: WALLET_ID },
          data: { fiatBalance: { increment: 594 } },
        }),
      );
    });

    it('decrements asset quantity on SELL', async () => {
      await service.createOrder(sellDto);
      expect(mockTx.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { walletId_symbol: { walletId: WALLET_ID, symbol: 'ETH' } },
          data: { quantity: { decrement: 3 } },
        }),
      );
    });
  });

  describe('PENDING order — no transaction', () => {
    it('does NOT call prisma.$transaction when order stays PENDING', async () => {
      (prisma.wallet.findUnique as jest.Mock).mockResolvedValue(
        makeWallet(500),
      );
      mockPriceProvider.getCurrentPrice.mockResolvedValue(99999);
      (prisma.tradeOrder.create as jest.Mock).mockResolvedValue({ id: 'o7', status: 'PENDING' });

      await service.createOrder({
        walletId: WALLET_ID, symbol: 'BTC', type: 'BUY', quantity: 1, targetPrice: 100,
      });

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
