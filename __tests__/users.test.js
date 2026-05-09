const request = require('supertest');
const app = require('../app');
const { resetUsers } = require('../routes/users');
const { logger } = require('../src/logger');

beforeEach(() => {
  resetUsers();
});

describe('GET /healthz', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('Users CRUD', () => {
  it('GET /users returns empty array initially', async () => {
    const res = await request(app).get('/users');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /users creates a user', async () => {
    const res = await request(app)
      .post('/users')
      .send({ name: 'Alice', email: 'alice@example.com' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 1, name: 'Alice', email: 'alice@example.com' });
  });

  it('GET /users/:id returns user', async () => {
    await request(app).post('/users').send({ name: 'Bob', email: 'bob@example.com' });
    const res = await request(app).get('/users/1');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Bob');
  });

  it('GET /users/:id returns 404 for unknown user', async () => {
    const res = await request(app).get('/users/999');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'User not found' });
  });

  it('PUT /users/:id updates a user', async () => {
    await request(app).post('/users').send({ name: 'Carol', email: 'carol@example.com' });
    const res = await request(app).put('/users/1').send({ name: 'Caroline' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Caroline');
  });

  it('DELETE /users/:id removes a user', async () => {
    await request(app).post('/users').send({ name: 'Dave', email: 'dave@example.com' });
    const res = await request(app).delete('/users/1');
    expect(res.status).toBe(204);
  });

  it('POST /users returns 400 when name is missing', async () => {
    const res = await request(app).post('/users').send({ email: 'x@example.com' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'name and email are required' });
  });
});

describe('logger middleware', () => {
  it('calls logger.info on each request', async () => {
    const spy = jest.spyOn(logger, 'info');
    await request(app).get('/healthz');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('GET /healthz'));
    spy.mockRestore();
  });
});
