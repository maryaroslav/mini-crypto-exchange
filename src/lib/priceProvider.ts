export interface PriceProvider {
  getCurrentPrice(symbol: string): Promise<number>;
}

export class MarketPriceProvider implements PriceProvider {
  async getCurrentPrice(symbol: string): Promise<number> {
    throw new Error(`MarketPriceProvider not implemented for symbol: ${symbol}`);
  }
}
