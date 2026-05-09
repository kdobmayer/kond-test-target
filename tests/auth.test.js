const request = require('supertest');
const { createApp, setupTestDb, teardownTestDb, API_KEY } = require('./helpers');

let app;

beforeEach(() => {
  setupTestDb();
  app = createApp();
});

afterEach(() => {
  teardownTestDb();
});

describe('Auth Middleware', () => {
  it('returns 401 when no api key provided', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  it('returns 403 for invalid api key', async () => {
    const res = await request(app).get('/api/products').set('x-api-key', 'invalid-key');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('allows access with valid api key', async () => {
    const res = await request(app).get('/api/products').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
  });

  it('health endpoint does not require auth', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Error Handling', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/unknown').set('x-api-key', API_KEY);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('x-api-key', API_KEY)
      .set('Content-Type', 'application/json')
      .send('{"invalid json');
    expect(res.status).toBe(400);
  });
});
