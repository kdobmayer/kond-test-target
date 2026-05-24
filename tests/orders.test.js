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
