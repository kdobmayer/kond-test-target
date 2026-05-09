const request = require('supertest');
const { createApp, setupTestDb, teardownTestDb, seedTestData, API_KEY } = require('./helpers');

let app;

beforeEach(() => {
  setupTestDb();
  app = createApp();
  seedTestData();
});

afterEach(() => {
  teardownTestDb();
});

describe('GET /api/stock', () => {
  it('returns stock levels for all products', async () => {
    const res = await request(app).get('/api/stock').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(3);
    expect(res.body.pagination).toBeDefined();
  });

  it('filters products below reorder level', async () => {
    const res = await request(app).get('/api/stock?below_reorder=true').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    // T-Shirt has quantity 5, reorder_level 20
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.some(p => p.sku === 'TSHIRT-001')).toBe(true);
  });
});

describe('GET /api/stock/:product_id/history', () => {
  it('returns stock adjustment history', async () => {
    const res = await request(app).get('/api/stock/1/history').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data.product.name).toBe('Laptop');
    expect(res.body.data.adjustments.length).toBeGreaterThanOrEqual(1);
  });

  it('returns 404 for non-existent product', async () => {
    const res = await request(app).get('/api/stock/999/history').set('x-api-key', API_KEY);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/stock/adjust', () => {
  it('adjusts stock and updates product quantity (cross-module flow)', async () => {
    const res = await request(app).post('/api/stock/adjust').set('x-api-key', API_KEY).send({
      product_id: 1, quantity_change: -10, reason: 'Sold', type: 'sale'
    });
    expect(res.status).toBe(201);
    expect(res.body.data.product.quantity).toBe(40);
    expect(res.body.data.adjustment.quantity_change).toBe(-10);

    // Verify product was actually updated
    const product = await request(app).get('/api/products/1').set('x-api-key', API_KEY);
    expect(product.body.data.quantity).toBe(40);
  });

  it('rejects adjustment that would make stock negative', async () => {
    const res = await request(app).post('/api/stock/adjust').set('x-api-key', API_KEY).send({
      product_id: 2, quantity_change: -100, reason: 'Too much'
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent product', async () => {
    const res = await request(app).post('/api/stock/adjust').set('x-api-key', API_KEY).send({
      product_id: 999, quantity_change: 10
    });
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/stock/adjust (bulk)', () => {
  it('adjusts multiple products at once', async () => {
    const res = await request(app).put('/api/stock/adjust').set('x-api-key', API_KEY).send({
      adjustments: [
        { product_id: 1, quantity_change: -5, reason: 'Bulk sale' },
        { product_id: 3, quantity_change: 20, reason: 'Restock' }
      ]
    });
    expect(res.status).toBe(200);
    expect(res.body.data.successful).toHaveLength(2);
    expect(res.body.data.errors).toHaveLength(0);
  });

  it('handles mixed success and failure', async () => {
    const res = await request(app).put('/api/stock/adjust').set('x-api-key', API_KEY).send({
      adjustments: [
        { product_id: 1, quantity_change: 10 },
        { product_id: 999, quantity_change: 5 }
      ]
    });
    expect(res.status).toBe(200);
    expect(res.body.data.successful).toHaveLength(1);
    expect(res.body.data.errors).toHaveLength(1);
  });

  it('returns 400 if adjustments is not an array', async () => {
    const res = await request(app).put('/api/stock/adjust').set('x-api-key', API_KEY).send({ adjustments: 'bad' });
    expect(res.status).toBe(400);
  });
});
