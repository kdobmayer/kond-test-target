const request = require('supertest');
const { createApp, setupTestDb, teardownTestDb, API_KEY } = require('./helpers');
const { resetRateLimitStore } = require('../src/middleware/rateLimit');

const ADMIN_KEY = 'admin-key-456';

let app;

beforeEach(() => {
  setupTestDb();
  resetRateLimitStore();
  app = createApp();
});

afterEach(() => {
  teardownTestDb();
});

describe('Rate Limit Headers', () => {
  it('includes X-RateLimit-Limit on successful responses', async () => {
    const res = await request(app).get('/api/products').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBe('100');
  });

  it('includes X-RateLimit-Remaining on successful responses', async () => {
    const res = await request(app).get('/api/products').set('x-api-key', API_KEY);
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    expect(parseInt(res.headers['x-ratelimit-remaining'])).toBe(99);
  });

  it('includes X-RateLimit-Reset as a future unix timestamp', async () => {
    const beforeSec = Math.floor(Date.now() / 1000);
    const res = await request(app).get('/api/products').set('x-api-key', API_KEY);
    const reset = parseInt(res.headers['x-ratelimit-reset']);
    expect(reset).toBeGreaterThan(beforeSec);
    expect(reset).toBeLessThanOrEqual(beforeSec + 61);
  });

  it('decrements X-RateLimit-Remaining with each request', async () => {
    const res1 = await request(app).get('/api/products').set('x-api-key', API_KEY);
    const res2 = await request(app).get('/api/products').set('x-api-key', API_KEY);
    const res3 = await request(app).get('/api/products').set('x-api-key', API_KEY);
    expect(parseInt(res1.headers['x-ratelimit-remaining'])).toBe(99);
    expect(parseInt(res2.headers['x-ratelimit-remaining'])).toBe(98);
    expect(parseInt(res3.headers['x-ratelimit-remaining'])).toBe(97);
  });

  it('does not include rate limit headers on /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
    expect(res.headers['x-ratelimit-remaining']).toBeUndefined();
    expect(res.headers['x-ratelimit-reset']).toBeUndefined();
  });
});

describe('Rate Limit Enforcement', () => {
  it('returns 429 after exceeding 100 requests per minute', async () => {
    for (let i = 0; i < 100; i++) {
      await request(app).get('/api/products').set('x-api-key', API_KEY);
    }
    const res = await request(app).get('/api/products').set('x-api-key', API_KEY);
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('Too Many Requests');
    expect(res.body.message).toMatch(/rate limit exceeded/i);
  });

  it('100th request succeeds, 101st is rejected', async () => {
    for (let i = 0; i < 99; i++) {
      await request(app).get('/api/products').set('x-api-key', API_KEY);
    }
    const hundredth = await request(app).get('/api/products').set('x-api-key', API_KEY);
    expect(hundredth.status).toBe(200);
    expect(parseInt(hundredth.headers['x-ratelimit-remaining'])).toBe(0);

    const overLimit = await request(app).get('/api/products').set('x-api-key', API_KEY);
    expect(overLimit.status).toBe(429);
  });

  it('includes Retry-After header on 429 response', async () => {
    for (let i = 0; i < 100; i++) {
      await request(app).get('/api/products').set('x-api-key', API_KEY);
    }
    const res = await request(app).get('/api/products').set('x-api-key', API_KEY);
    expect(res.status).toBe(429);
    const retryAfter = parseInt(res.headers['retry-after']);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it('sets X-RateLimit-Remaining to 0 on 429 response', async () => {
    for (let i = 0; i < 100; i++) {
      await request(app).get('/api/products').set('x-api-key', API_KEY);
    }
    const res = await request(app).get('/api/products').set('x-api-key', API_KEY);
    expect(res.status).toBe(429);
    expect(res.headers['x-ratelimit-remaining']).toBe('0');
  });

  it('includes rate limit headers on 429 response', async () => {
    for (let i = 0; i < 100; i++) {
      await request(app).get('/api/products').set('x-api-key', API_KEY);
    }
    const res = await request(app).get('/api/products').set('x-api-key', API_KEY);
    expect(res.status).toBe(429);
    expect(res.headers['x-ratelimit-limit']).toBe('100');
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
  });
});

describe('Per-Key Rate Limiting', () => {
  it('tracks limits separately for different API keys', async () => {
    // Exhaust the limit for API_KEY
    for (let i = 0; i < 100; i++) {
      await request(app).get('/api/products').set('x-api-key', API_KEY);
    }
    const exhausted = await request(app).get('/api/products').set('x-api-key', API_KEY);
    expect(exhausted.status).toBe(429);

    // ADMIN_KEY should still have its full allowance
    const adminRes = await request(app).get('/api/products').set('x-api-key', ADMIN_KEY);
    expect(adminRes.status).toBe(200);
    expect(parseInt(adminRes.headers['x-ratelimit-remaining'])).toBe(99);
  });

  it('each key starts with a full 100-request allowance', async () => {
    const res1 = await request(app).get('/api/products').set('x-api-key', API_KEY);
    const res2 = await request(app).get('/api/products').set('x-api-key', ADMIN_KEY);
    expect(parseInt(res1.headers['x-ratelimit-remaining'])).toBe(99);
    expect(parseInt(res2.headers['x-ratelimit-remaining'])).toBe(99);
  });
});
