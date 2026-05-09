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

describe('GET /api/suppliers', () => {
  it('returns paginated supplier list', async () => {
    const res = await request(app).get('/api/suppliers').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.pagination).toBeDefined();
  });

  it('filters by search term', async () => {
    const res = await request(app).get('/api/suppliers?search=tech').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].name).toBe('TechCorp');
  });
});

describe('GET /api/suppliers/:id', () => {
  it('returns supplier with products', async () => {
    const res = await request(app).get('/api/suppliers/1').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('TechCorp');
    expect(res.body.data.products).toBeDefined();
    expect(res.body.data.products.length).toBe(2);
  });

  it('returns 404 for non-existent supplier', async () => {
    const res = await request(app).get('/api/suppliers/999').set('x-api-key', API_KEY);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/suppliers', () => {
  it('creates a supplier (no validation — intentional)', async () => {
    const res = await request(app).post('/api/suppliers').set('x-api-key', API_KEY).send({
      name: 'NewSupplier', contact_email: 'new@supplier.com'
    });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('NewSupplier');
  });

  it('creates supplier even with empty body fields (no validation)', async () => {
    const res = await request(app).post('/api/suppliers').set('x-api-key', API_KEY).send({
      name: 'Minimal'
    });
    expect(res.status).toBe(201);
  });
});

describe('PUT /api/suppliers/:id', () => {
  it('updates a supplier', async () => {
    const res = await request(app).put('/api/suppliers/1').set('x-api-key', API_KEY).send({
      name: 'TechCorp Updated', rating: 5
    });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('TechCorp Updated');
    expect(res.body.data.rating).toBe(5);
  });

  it('returns 404 for non-existent supplier', async () => {
    const res = await request(app).put('/api/suppliers/999').set('x-api-key', API_KEY).send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('rejects invalid email on update', async () => {
    const res = await request(app).put('/api/suppliers/1').set('x-api-key', API_KEY).send({
      name: 'TechCorp', contact_email: 'not-an-email'
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/suppliers/:id', () => {
  it('deletes supplier and nullifies product references', async () => {
    const res = await request(app).delete('/api/suppliers/1').set('x-api-key', API_KEY);
    expect(res.status).toBe(204);

    const product = await request(app).get('/api/products/1').set('x-api-key', API_KEY);
    expect(product.body.data.supplier_id).toBeNull();
  });

  it('returns 404 for non-existent supplier', async () => {
    const res = await request(app).delete('/api/suppliers/999').set('x-api-key', API_KEY);
    expect(res.status).toBe(404);
  });
});
