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

describe('GET /api/products', () => {
  it('returns paginated product list', async () => {
    const res = await request(app).get('/api/products').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.total).toBe(3);
  });

  it('filters by category_id', async () => {
    const res = await request(app).get('/api/products?category_id=2').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('filters by search term', async () => {
    const res = await request(app).get('/api/products?search=laptop').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Laptop');
  });

  it('returns 401 without api key', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/products/:id', () => {
  it('returns a single product', async () => {
    const res = await request(app).get('/api/products/1').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Laptop');
    expect(res.body.data.category_name).toBe('Electronics');
  });

  it('returns 404 for non-existent product', async () => {
    const res = await request(app).get('/api/products/999').set('x-api-key', API_KEY);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/products/export', () => {
  it('returns CSV with correct content-type', async () => {
    const res = await request(app).get('/api/products/export').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
  });

  it('requires an api key', async () => {
    const res = await request(app).get('/api/products/export');
    expect(res.status).toBe(401);
  });

  it('includes header row and all products', async () => {
    const res = await request(app).get('/api/products/export').set('x-api-key', API_KEY);
    const lines = res.text.split('\n');
    expect(lines[0]).toBe('id,name,sku,quantity,price');
    expect(lines).toHaveLength(4); // header + 3 seeded products
  });

  it('contains correct data for seeded products', async () => {
    const res = await request(app).get('/api/products/export').set('x-api-key', API_KEY);
    const lines = res.text.split('\n');
    expect(lines[1]).toBe('1,Laptop,LAPTOP-001,50,999.99');
    expect(lines[2]).toBe('2,T-Shirt,TSHIRT-001,5,29.99');
    expect(lines[3]).toBe('3,Headphones,HEAD-001,100,149.99');
  });

  it('escapes spreadsheet formulas in exported text fields', async () => {
    await request(app)
      .post('/api/products')
      .set('x-api-key', API_KEY)
      .send({ name: '=cmd', sku: 'FORMULA-001', price: 10 });

    const res = await request(app).get('/api/products/export').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.text).toContain("'=cmd");
  });
});

describe('POST /api/products', () => {
  it('creates a new product', async () => {
    const res = await request(app).post('/api/products').set('x-api-key', API_KEY).send({
      name: 'Mouse', sku: 'MOUSE-001', price: 49.99, cost: 20, quantity: 200
    });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Mouse');
    expect(res.body.data.sku).toBe('MOUSE-001');
  });

  it('returns 400 for missing required fields', async () => {
    const res = await request(app).post('/api/products').set('x-api-key', API_KEY).send({ name: 'Mouse' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid SKU format', async () => {
    const res = await request(app).post('/api/products').set('x-api-key', API_KEY).send({
      name: 'Mouse', sku: 'invalid sku!', price: 10
    });
    expect(res.status).toBe(400);
  });

  it('returns 409 for duplicate SKU', async () => {
    const res = await request(app).post('/api/products').set('x-api-key', API_KEY).send({
      name: 'Another Laptop', sku: 'LAPTOP-001', price: 500
    });
    expect(res.status).toBe(409);
  });

  it('returns 400 for negative price', async () => {
    const res = await request(app).post('/api/products').set('x-api-key', API_KEY).send({
      name: 'Bad', sku: 'BAD-001', price: -10
    });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/products/:id', () => {
  it('updates an existing product', async () => {
    const res = await request(app).put('/api/products/1').set('x-api-key', API_KEY).send({ name: 'Gaming Laptop', price: 1299.99 });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Gaming Laptop');
    expect(res.body.data.price).toBe(1299.99);
  });

  it('returns 404 for non-existent product', async () => {
    const res = await request(app).put('/api/products/999').set('x-api-key', API_KEY).send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/products/:id', () => {
  it('deletes a product', async () => {
    const res = await request(app).delete('/api/products/1').set('x-api-key', API_KEY);
    expect(res.status).toBe(204);
    const check = await request(app).get('/api/products/1').set('x-api-key', API_KEY);
    expect(check.status).toBe(404);
  });

  it('returns 404 for non-existent product', async () => {
    const res = await request(app).delete('/api/products/999').set('x-api-key', API_KEY);
    expect(res.status).toBe(404);
  });
});
