import request from 'supertest';
import { createApp } from '../../app';
import { prisma } from '../../lib/prisma';

const app = createApp();

afterEach(async () => {
  await prisma.tradeOrder.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.wallet.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /wallets', () => {
  it('201 — creates a wallet and returns it', async () => {
    const res = await request(app)
      .post('/wallets')
      .send({ name: 'Alice', fiatBalance: 5000 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Alice',
      fiatBalance: 5000,
    });
    expect(res.body.id).toBeDefined();
  });

  it('201 — creates wallet with default fiatBalance 0 when not provided', async () => {
    const res = await request(app)
      .post('/wallets')
      .send({ name: 'Bob' });

    expect(res.status).toBe(201);
    expect(res.body.fiatBalance).toBe(0);
  });

  it('400 — rejects empty name', async () => {
    const res = await request(app)
      .post('/wallets')
      .send({ name: '', fiatBalance: 100 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  it('400 — rejects negative fiatBalance', async () => {
    const res = await request(app)
      .post('/wallets')
      .send({ name: 'Charlie', fiatBalance: -100 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  it('400 — rejects missing name entirely', async () => {
    const res = await request(app)
      .post('/wallets')
      .send({ fiatBalance: 100 });

    expect(res.status).toBe(400);
  });
});

describe('GET /wallets/:id', () => {
  it('200 — returns wallet with empty assets array', async () => {
    const created = await prisma.wallet.create({
      data: { name: 'Dana', fiatBalance: 1000 },
    });

    const res = await request(app).get(`/wallets/${created.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: created.id,
      name: 'Dana',
      fiatBalance: 1000,
      assets: [],
    });
  });

  it('200 — returns wallet with its assets', async () => {
    const wallet = await prisma.wallet.create({
      data: {
        name: 'Eve',
        fiatBalance: 0,
        assets: { create: [{ symbol: 'BTC', quantity: 0.5 }] },
      },
      include: { assets: true },
    });

    const res = await request(app).get(`/wallets/${wallet.id}`);

    expect(res.status).toBe(200);
    expect(res.body.assets).toHaveLength(1);
    expect(res.body.assets[0].symbol).toBe('BTC');
  });

  it('404 — returns Not Found for non-existent id', async () => {
    const res = await request(app).get('/wallets/00000000-0000-0000-0000-000000000000');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});
