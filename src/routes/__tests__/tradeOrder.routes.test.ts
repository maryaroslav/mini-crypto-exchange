import request from 'supertest';
import { createApp } from '../../app';
import { prisma } from '../../lib/prisma';

jest.mock('../../lib/priceProvider', () => ({
  MarketPriceProvider: jest.fn().mockImplementation(() => ({
    getCurrentPrice: jest.fn().mockResolvedValue(999_999),
  })),
}));

import { MarketPriceProvider } from '../../lib/priceProvider';

const app = createApp();

async function createWallet(fiatBalance = 100_000) {
  return prisma.wallet.create({ data: { name: 'Test Wallet', fiatBalance } });
}

async function addAsset(walletId: string, symbol: string, quantity: number) {
  return prisma.asset.create({ data: { walletId, symbol, quantity } });
}

afterEach(async () => {
  await prisma.tradeOrder.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.wallet.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /orders', () => {
  it('201 — creates a PENDING BUY order when market price is above target', async () => {
    const wallet = await createWallet(100_000);

    const res = await request(app).post('/orders').send({
      walletId: wallet.id,
      symbol: 'BTC',
      type: 'BUY',
      quantity: 1,
      targetPrice: 30_000,
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      symbol: 'BTC',
      type: 'BUY',
      status: 'PENDING',
      quantity: 1,
      targetPrice: 30_000,
    });
    expect(res.body.id).toBeDefined();
  });

  it('201 — creates a COMPLETED BUY order when market price is at or below target', async () => {
    const wallet = await createWallet(100_000);

    (MarketPriceProvider as jest.Mock).mockImplementationOnce(() => ({
      getCurrentPrice: jest.fn().mockResolvedValue(25_000),
    }));

    const res = await request(app).post('/orders').send({
      walletId: wallet.id,
      symbol: 'BTC',
      type: 'BUY',
      quantity: 1,
      targetPrice: 30_000,
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('COMPLETED');
  });

  it('422 — rejects BUY when fiat balance is insufficient (BR1)', async () => {
    const wallet = await createWallet(100);

    const res = await request(app).post('/orders').send({
      walletId: wallet.id,
      symbol: 'BTC',
      type: 'BUY',
      quantity: 1,
      targetPrice: 30_000,
    });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/insufficient fiat/i);
  });

  it('422 — rejects SELL when asset quantity is insufficient (BR2)', async () => {
    const wallet = await createWallet(0);
    await addAsset(wallet.id, 'BTC', 0.1);

    const res = await request(app).post('/orders').send({
      walletId: wallet.id,
      symbol: 'BTC',
      type: 'SELL',
      quantity: 1,
      targetPrice: 30_000,
    });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/insufficient btc/i);
  });

  it('400 — rejects invalid walletId (not a UUID)', async () => {
    const res = await request(app).post('/orders').send({
      walletId: 'not-a-uuid',
      symbol: 'BTC',
      type: 'BUY',
      quantity: 1,
      targetPrice: 30_000,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  it('400 — rejects zero quantity', async () => {
    const wallet = await createWallet();

    const res = await request(app).post('/orders').send({
      walletId: wallet.id,
      symbol: 'BTC',
      type: 'BUY',
      quantity: 0,
      targetPrice: 30_000,
    });

    expect(res.status).toBe(400);
  });
});

describe('GET /orders/:id', () => {
  it('200 — returns an existing order', async () => {
    const wallet = await createWallet();
    const order = await prisma.tradeOrder.create({
      data: {
        walletId: wallet.id,
        symbol: 'ETH',
        type: 'BUY',
        quantity: 2,
        targetPrice: 2000,
        commission: 40,
        status: 'PENDING',
      },
    });

    const res = await request(app).get(`/orders/${order.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: order.id,
      symbol: 'ETH',
      status: 'PENDING',
    });
  });

  it('404 — returns Not Found for non-existent order id', async () => {
    const res = await request(app).get('/orders/00000000-0000-0000-0000-000000000000');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});
