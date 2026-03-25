import { CreateWalletSchema, CreateTradeOrderSchema } from '../index';

// ── CreateWalletSchema ────────────────────────────────────────────────────────
describe('CreateWalletSchema', () => {
  describe('valid inputs', () => {
    it('accepts a name with a positive fiatBalance', () => {
      const result = CreateWalletSchema.safeParse({ name: 'My Wallet', fiatBalance: 1000 });
      expect(result.success).toBe(true);
    });

    it('defaults fiatBalance to 0 when not provided', () => {
      const result = CreateWalletSchema.safeParse({ name: 'Empty Wallet' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.fiatBalance).toBe(0);
    });

    it('accepts fiatBalance of exactly 0', () => {
      const result = CreateWalletSchema.safeParse({ name: 'Zero Wallet', fiatBalance: 0 });
      expect(result.success).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    it('rejects empty name', () => {
      const result = CreateWalletSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Name is required');
      }
    });

    it('rejects missing name', () => {
      const result = CreateWalletSchema.safeParse({ fiatBalance: 100 });
      expect(result.success).toBe(false);
    });

    it('rejects negative fiatBalance', () => {
      const result = CreateWalletSchema.safeParse({ name: 'Bad Wallet', fiatBalance: -1 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Balance must be >= 0');
      }
    });
  });
});

// ── CreateTradeOrderSchema ────────────────────────────────────────────────────
describe('CreateTradeOrderSchema', () => {
  const validOrder = {
    walletId: '123e4567-e89b-12d3-a456-426614174000',
    symbol: 'btc',        // lowercase — schema transforms to uppercase
    type: 'BUY',
    quantity: 1,
    targetPrice: 30000,
  };

  describe('valid inputs', () => {
    it('accepts a complete valid BUY order', () => {
      const result = CreateTradeOrderSchema.safeParse(validOrder);
      expect(result.success).toBe(true);
    });

    it('transforms symbol to uppercase', () => {
      const result = CreateTradeOrderSchema.safeParse({ ...validOrder, symbol: 'eth' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.symbol).toBe('ETH');
    });

    it('accepts SELL type', () => {
      const result = CreateTradeOrderSchema.safeParse({ ...validOrder, type: 'SELL' });
      expect(result.success).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    it('rejects invalid walletId (not a UUID)', () => {
      const result = CreateTradeOrderSchema.safeParse({ ...validOrder, walletId: 'not-a-uuid' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('walletId must be a valid UUID');
      }
    });

    it('rejects empty symbol', () => {
      const result = CreateTradeOrderSchema.safeParse({ ...validOrder, symbol: '' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid order type', () => {
      const result = CreateTradeOrderSchema.safeParse({ ...validOrder, type: 'HOLD' });
      expect(result.success).toBe(false);
    });

    it('rejects zero quantity', () => {
      const result = CreateTradeOrderSchema.safeParse({ ...validOrder, quantity: 0 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Quantity must be > 0');
      }
    });

    it('rejects negative quantity', () => {
      const result = CreateTradeOrderSchema.safeParse({ ...validOrder, quantity: -5 });
      expect(result.success).toBe(false);
    });

    it('rejects zero targetPrice', () => {
      const result = CreateTradeOrderSchema.safeParse({ ...validOrder, targetPrice: 0 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Target price must be > 0');
      }
    });

    it('rejects missing required fields', () => {
      const result = CreateTradeOrderSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
