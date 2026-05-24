const request = require('supertest');
const { createApp, setupTestDb, teardownTestDb, seedTestData, API_KEY, getDb } = require('./helpers');

let app;

beforeEach(() => {
  setupTestDb();
  app = createApp();
  seedTestData();
});

afterEach(() => {
  teardownTestDb();
});

describe('POST /api/orders', () => {
  it('creates an order with status pending', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('x-api-key', API_KEY)
      .send({ customer_name: 'Alice' });

    expect(res.status).toBe(201);
    expect(res.body.data.customer_name).toBe('Alice');
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.created_at).toBeDefined();
  });

  it('returns 400 when customer_name is missing', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('x-api-key', API_KEY)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  it('returns 400 when customer_name is blank after sanitization', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('x-api-key', API_KEY)
      .send({ customer_name: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
    expect(res.body.timestamp).toBeDefined();
  });

  it('returns 400 when customer_name is not a string', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('x-api-key', API_KEY)
      .send({ customer_name: { first: 'Alice' } });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
    expect(res.body.timestamp).toBeDefined();
  });

  it('returns 401 without API key', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ customer_name: 'Alice' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/orders', () => {
  it('returns a list with pagination', async () => {
    await request(app).post('/api/orders').set('x-api-key', API_KEY).send({ customer_name: 'Alice' });
    await request(app).post('/api/orders').set('x-api-key', API_KEY).send({ customer_name: 'Bob' });

    const res = await request(app)
      .get('/api/orders')
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.total).toBe(2);
    expect(res.body.pagination.page).toBe(1);
  });

  it('returns empty list when no orders exist', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  it('returns 401 without API key', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/orders/:id', () => {
  it('returns an order by id', async () => {
    const createRes = await request(app)
      .post('/api/orders')
      .set('x-api-key', API_KEY)
      .send({ customer_name: 'Charlie' });

    const id = createRes.body.data.id;

    const res = await request(app)
      .get(`/api/orders/${id}`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
    expect(res.body.data.customer_name).toBe('Charlie');
    expect(res.body.data.status).toBe('pending');
  });

  it('returns 404 for non-existent order', async () => {
    const res = await request(app)
      .get('/api/orders/99999')
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
    expect(res.body.timestamp).toBeDefined();
  });

  it('returns 401 without API key', async () => {
    const res = await request(app).get('/api/orders/1');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/orders/:id/items', () => {
  let orderId;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('x-api-key', API_KEY)
      .send({ customer_name: 'Alice' });
    orderId = res.body.data.id;
  });

  it('adds an item and decrements product stock', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('x-api-key', API_KEY)
      .send({ product_id: 1, quantity: 3 });

    expect(res.status).toBe(201);
    expect(res.body.data.order_item.order_id).toBe(orderId);
    expect(res.body.data.order_item.product_id).toBe(1);
    expect(res.body.data.order_item.quantity).toBe(3);
    expect(res.body.data.product.id).toBe(1);
    expect(res.body.data.product.quantity).toBe(47);

    const adjustment = getDb().prepare(
      'SELECT * FROM stock_adjustments WHERE product_id = ? ORDER BY id DESC LIMIT 1'
    ).get(1);
    expect(adjustment.quantity_change).toBe(-3);
    expect(adjustment.type).toBe('order');
    expect(adjustment.reference_id).toBe(String(orderId));
  });

  it('returns 409 when quantity exceeds available stock', async () => {
    // T-Shirt has qty=5, request 10
    const res = await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('x-api-key', API_KEY)
      .send({ product_id: 2, quantity: 10 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Conflict');
    expect(res.body.timestamp).toBeDefined();
  });

  it('returns 404 for non-existent order', async () => {
    const res = await request(app)
      .post('/api/orders/99999/items')
      .set('x-api-key', API_KEY)
      .send({ product_id: 1, quantity: 1 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
    expect(res.body.timestamp).toBeDefined();
  });

  it('returns 404 for non-existent product', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('x-api-key', API_KEY)
      .send({ product_id: 99999, quantity: 1 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
    expect(res.body.timestamp).toBeDefined();
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('x-api-key', API_KEY)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
    expect(res.body.timestamp).toBeDefined();
  });

  it('returns 400 when quantity is zero', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('x-api-key', API_KEY)
      .send({ product_id: 1, quantity: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
    expect(res.body.timestamp).toBeDefined();
  });

  it('returns 400 when product_id is not a positive integer', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('x-api-key', API_KEY)
      .send({ product_id: 1.5, quantity: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
    expect(res.body.timestamp).toBeDefined();
  });

  it('cumulative deductions when adding two items to the same order', async () => {
    // Laptop starts at qty=50
    await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('x-api-key', API_KEY)
      .send({ product_id: 1, quantity: 10 });

    const res = await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('x-api-key', API_KEY)
      .send({ product_id: 1, quantity: 5 });

    expect(res.status).toBe(201);
    expect(res.body.data.product.quantity).toBe(35);
  });

  it('returns 401 without API key', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/items`)
      .send({ product_id: 1, quantity: 1 });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/orders/:id/items', () => {
  let orderId;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('x-api-key', API_KEY)
      .send({ customer_name: 'Bob' });
    orderId = res.body.data.id;
  });

  it('returns items for an order', async () => {
    await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('x-api-key', API_KEY)
      .send({ product_id: 1, quantity: 2 });

    const res = await request(app)
      .get(`/api/orders/${orderId}/items`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].product_id).toBe(1);
    expect(res.body.data[0].quantity).toBe(2);
    expect(res.body.data[0].product_name).toBe('Laptop');
    expect(res.body.data[0].product_sku).toBe('LAPTOP-001');
  });

  it('returns empty array for order with no items', async () => {
    const res = await request(app)
      .get(`/api/orders/${orderId}/items`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns 404 for non-existent order', async () => {
    const res = await request(app)
      .get('/api/orders/99999/items')
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
    expect(res.body.timestamp).toBeDefined();
  });

  it('returns items from multiple additions in order', async () => {
    await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('x-api-key', API_KEY)
      .send({ product_id: 1, quantity: 2 });
    await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('x-api-key', API_KEY)
      .send({ product_id: 3, quantity: 5 });

    const res = await request(app)
      .get(`/api/orders/${orderId}/items`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });

  it('returns 401 without API key', async () => {
    const res = await request(app)
      .get(`/api/orders/${orderId}/items`);

    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/orders/:id/status', () => {
  let orderId;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('x-api-key', API_KEY)
      .send({ customer_name: 'Dave' });
    orderId = res.body.data.id;
  });

  it('transitions pending -> confirmed', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-api-key', API_KEY)
      .send({ status: 'confirmed' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('confirmed');
    expect(res.body.data.id).toBe(orderId);
  });

  it('transitions confirmed -> shipped -> delivered', async () => {
    await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-api-key', API_KEY)
      .send({ status: 'confirmed' });

    const shippedRes = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-api-key', API_KEY)
      .send({ status: 'shipped' });

    expect(shippedRes.status).toBe(200);
    expect(shippedRes.body.data.status).toBe('shipped');

    const deliveredRes = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-api-key', API_KEY)
      .send({ status: 'delivered' });

    expect(deliveredRes.status).toBe(200);
    expect(deliveredRes.body.data.status).toBe('delivered');
  });

  it('transitions pending -> cancelled and restores stock', async () => {
    // Add items to reserve stock (Laptop qty=50, reserve 5)
    await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('x-api-key', API_KEY)
      .send({ product_id: 1, quantity: 5 });

    const cancelRes = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-api-key', API_KEY)
      .send({ status: 'cancelled' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('cancelled');

    // Stock should be restored to original 50
    const productRes = await request(app)
      .get('/api/products/1')
      .set('x-api-key', API_KEY);

    expect(productRes.body.data.quantity).toBe(50);
  });

  it('cancellation with multiple items restores all quantities atomically', async () => {
    // Laptop (id=1, qty=50) reserve 10, T-Shirt (id=2, qty=5) reserve 3
    await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('x-api-key', API_KEY)
      .send({ product_id: 1, quantity: 10 });
    await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('x-api-key', API_KEY)
      .send({ product_id: 2, quantity: 3 });

    await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-api-key', API_KEY)
      .send({ status: 'cancelled' });

    const laptopRes = await request(app).get('/api/products/1').set('x-api-key', API_KEY);
    const tshirtRes = await request(app).get('/api/products/2').set('x-api-key', API_KEY);

    expect(laptopRes.body.data.quantity).toBe(50);
    expect(tshirtRes.body.data.quantity).toBe(5);
  });

  it('cancellation writes compensating stock history entries', async () => {
    await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('x-api-key', API_KEY)
      .send({ product_id: 1, quantity: 4 });

    await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-api-key', API_KEY)
      .send({ status: 'cancelled' });

    const historyRes = await request(app)
      .get('/api/stock/1/history')
      .set('x-api-key', API_KEY);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data.adjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          quantity_change: -4,
          type: 'order',
          reference_id: String(orderId)
        }),
        expect.objectContaining({
          quantity_change: 4,
          type: 'order_cancel',
          reference_id: String(orderId)
        })
      ])
    );
  });

  it('confirm does not change product quantities', async () => {
    await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('x-api-key', API_KEY)
      .send({ product_id: 1, quantity: 5 });

    await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-api-key', API_KEY)
      .send({ status: 'confirmed' });

    const productRes = await request(app)
      .get('/api/products/1')
      .set('x-api-key', API_KEY);

    expect(productRes.body.data.quantity).toBe(45);
  });

  it('returns 422 for invalid transition pending -> shipped', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-api-key', API_KEY)
      .send({ status: 'shipped' });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('Unprocessable Entity');
    expect(res.body.timestamp).toBeDefined();
  });

  it('returns 422 for invalid transition confirmed -> cancelled', async () => {
    await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-api-key', API_KEY)
      .send({ status: 'confirmed' });

    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-api-key', API_KEY)
      .send({ status: 'cancelled' });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('Unprocessable Entity');
  });

  it('returns 409 when adding items after leaving pending status', async () => {
    await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-api-key', API_KEY)
      .send({ status: 'confirmed' });

    const res = await request(app)
      .post(`/api/orders/${orderId}/items`)
      .set('x-api-key', API_KEY)
      .send({ product_id: 1, quantity: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Conflict');
    expect(res.body.timestamp).toBeDefined();
  });

  it('returns 422 for invalid transition delivered -> pending', async () => {
    await request(app).patch(`/api/orders/${orderId}/status`).set('x-api-key', API_KEY).send({ status: 'confirmed' });
    await request(app).patch(`/api/orders/${orderId}/status`).set('x-api-key', API_KEY).send({ status: 'shipped' });
    await request(app).patch(`/api/orders/${orderId}/status`).set('x-api-key', API_KEY).send({ status: 'delivered' });

    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-api-key', API_KEY)
      .send({ status: 'pending' });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('Unprocessable Entity');
  });

  it('returns 404 for non-existent order', async () => {
    const res = await request(app)
      .patch('/api/orders/99999/status')
      .set('x-api-key', API_KEY)
      .send({ status: 'confirmed' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
    expect(res.body.timestamp).toBeDefined();
  });

  it('returns 400 when status field is missing', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('x-api-key', API_KEY)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  it('returns 401 without API key', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .send({ status: 'confirmed' });

    expect(res.status).toBe(401);
  });
});
