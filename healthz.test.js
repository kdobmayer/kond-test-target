const request = require('supertest');
const app = require('./app');

describe('GET /healthz', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
