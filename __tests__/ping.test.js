const request = require('supertest');
const app = require('../app');

describe('GET /ping', () => {
  it('responds with 200 and pong message', async () => {
    const res = await request(app).get('/ping');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'pong' });
  });
});
