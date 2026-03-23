import { prisma } from '../lib/prisma';
import { PriceProvider } from '../lib/priceProvider';
import { CreateTradeOrderDTO } from '../schemas';
import { InsufficientFundsError, NotFoundError } from '../errors/AppError';
import { TradeOrder } from '@prisma/client';

export function calculateCommission(quantity: number, price: number): number {
  const total = quantity * price;
  const rate = total > 1000 ? 0.002 : 0.01;
  return total * rate;
}

export class TradeOrderService {
  constructor(private readonly priceProvider: PriceProvider) { }

  async createOrder(dto: CreateTradeOrderDTO): Promise<TradeOrder> {
    const wallet = await prisma.wallet.findUnique({
      where: { id: dto.walletId },
      include: { assets: true },
    });
    if (!wallet) throw new NotFoundError('Wallet');

    const totalCost = dto.quantity * dto.targetPrice;
    const commission = calculateCommission(dto.quantity, dto.targetPrice);

    if (dto.type === 'BUY' && wallet.fiatBalance < totalCost + commission) {
      throw new InsufficientFundsError(
        `Insufficient fiat balance. Required: ${totalCost + commission}, Available: ${wallet.fiatBalance}`,
      );
    }

    if (dto.type === 'SELL') {
      const asset = wallet.assets.find((a) => a.symbol === dto.symbol);
      if (!asset || asset.quantity < dto.quantity) {
        throw new InsufficientFundsError(
          `Insufficient ${dto.symbol} balance. Required: ${dto.quantity}, Available: ${asset?.quantity ?? 0}`,
        );
      }
    }

    const currentPrice = await this.priceProvider.getCurrentPrice(dto.symbol);
    const isCompleted = dto.type === 'BUY'
      ? currentPrice <= dto.targetPrice
      : currentPrice >= dto.targetPrice;

    return prisma.tradeOrder.create({
      data: {
        walletId: dto.walletId,
        symbol: dto.symbol,
        type: dto.type,
        quantity: dto.quantity,
        targetPrice: dto.targetPrice,
        commission,
        status: isCompleted ? 'COMPLETED' : 'PENDING',
      },
    });
  }

  async getOrderById(id: string): Promise<TradeOrder> {
    const order = await prisma.tradeOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundError('TradeOrder');
    return order;
  }
}