import { PriceProvider } from '../lib/priceProvider';
export class TradeOrderService {
  constructor(private readonly priceProvider: PriceProvider) { }
  async createOrder(_dto: any): Promise<any> {
    throw new Error('Not implemented');
  }
}