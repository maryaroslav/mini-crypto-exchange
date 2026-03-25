export interface PriceProvider {
  getCurrentPrice(symbol: string): Promise<number>;
}

export class MarketPriceProvider implements PriceProvider {
  async getCurrentPrice(symbol: string): Promise<number> {
    const mockPrices: Record<string, number> = {
      'BTC': 60000,
      'ETH': 3000,
      'SOL': 150
    };

    const price = mockPrices[symbol.toUpperCase()] || 100;
    console.log(`[MarketPriceProvider] Aktuální cena ${symbol.toUpperCase()}: $${price}`);

    return price;
  }
}