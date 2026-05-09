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

describe('GET /api/categories', () => {
  it('returns all categories with product counts', async () => {
    const res = await request(app).get('/api/categories').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    expect(res.body.pagination).toBeDefined();
  });
});

describe('GET /api/categories/:id', () => {
  it('returns category with products', async () => {
    const res = await request(app).get('/api/categories/2').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Electronics');
    expect(res.body.data.products).toBeDefined();
  });

  it('returns 404 for non-existent category', async () => {
    const res = await request(app).get('/api/categories/999').set('x-api-key', API_KEY);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/categories', () => {
  it('creates a new category', async () => {
    const res = await request(app).post('/api/categories').set('x-api-key', API_KEY).send({
      name: 'Books', description: 'Reading materials'
    });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Books');
  });

  it('returns 400 for missing name', async () => {
    const res = await request(app).post('/api/categories').set('x-api-key', API_KEY).send({ description: 'No name' });
    expect(res.status).toBe(400);
  });

  it('returns 409 for duplicate name', async () => {
    const res = await request(app).post('/api/categories').set('x-api-key', API_KEY).send({ name: 'Electronics' });
    expect(res.status).toBe(409);
  });
});

describe('PUT /api/categories/:id', () => {
  it('updates a category', async () => {
    const res = await request(app).put('/api/categories/2').set('x-api-key', API_KEY).send({ name: 'Tech' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Tech');
  });

  it('returns 404 for non-existent category', async () => {
    const res = await request(app).put('/api/categories/999').set('x-api-key', API_KEY).send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/categories/:id', () => {
  it('deletes category and reassigns products to Uncategorized', async () => {
    const res = await request(app).delete('/api/categories/2').set('x-api-key', API_KEY);
    expect(res.status).toBe(204);

    // Products should be reassigned to category 1 (Uncategorized)
    const product = await request(app).get('/api/products/1').set('x-api-key', API_KEY);
    expect(product.body.data.category_id).toBe(1);
  });

  it('cannot delete the default Uncategorized category', async () => {
    const res = await request(app).delete('/api/categories/1').set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent category', async () => {
    const res = await request(app).delete('/api/categories/999').set('x-api-key', API_KEY);
    expect(res.status).toBe(404);
  });
});
