const request = require('supertest');
const app = require('../app');
const { resetUsers } = require('../routes/users');

beforeEach(() => {
  resetUsers();
});

// ---------------------------------------------------------------------------
// Legacy (no pagination params) – returns plain array
// ---------------------------------------------------------------------------

describe('GET /users – legacy (no params)', () => {
  it('returns all users as an array', async () => {
    const res = await request(app).get('/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Paginated – limit only
// ---------------------------------------------------------------------------

describe('GET /users – default pagination', () => {
  it('returns data + next_cursor shape when limit param is present', async () => {
    const res = await request(app).get('/users?limit=2');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('next_cursor');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('respects limit and returns first page', async () => {
    const res = await request(app).get('/users?limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.next_cursor).not.toBeNull();
  });

  it('returns all users when limit exceeds total count', async () => {
    const res = await request(app).get('/users?limit=100');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.next_cursor).toBeNull();
  });

  it('caps limit at 100', async () => {
    // Seed enough users so limit=200 would return more than 100 if uncapped
    for (let i = 0; i < 110; i++) {
      await request(app)
        .post('/users')
        .send({ name: `User${i}`, email: `u${i}@example.com` });
    }
    const res = await request(app).get('/users?limit=200');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// Cursor-based next page
// ---------------------------------------------------------------------------

describe('GET /users – cursor navigation', () => {
  it('fetches second page using next_cursor from first page', async () => {
    const page1 = await request(app).get('/users?limit=2');
    expect(page1.status).toBe(200);
    const cursor = page1.body.next_cursor;
    expect(cursor).not.toBeNull();

    const page2 = await request(app).get(`/users?limit=2&cursor=${cursor}`);
    expect(page2.status).toBe(200);
    expect(page2.body.data).toHaveLength(1); // only Carol left
    expect(page2.body.next_cursor).toBeNull();
  });

  it('returns no overlap between pages', async () => {
    const page1 = await request(app).get('/users?limit=2');
    const page2 = await request(app).get(`/users?limit=2&cursor=${page1.body.next_cursor}`);

    const ids1 = page1.body.data.map((u) => u.id);
    const ids2 = page2.body.data.map((u) => u.id);
    const overlap = ids1.filter((id) => ids2.includes(id));
    expect(overlap).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Empty result set
// ---------------------------------------------------------------------------

describe('GET /users – empty results', () => {
  it('returns empty data and null next_cursor when cursor is past all records', async () => {
    // Get last page to get a cursor pointing past all records
    const page1 = await request(app).get('/users?limit=3');
    expect(page1.body.next_cursor).toBeNull();

    // Manually build a cursor for the last known user id (3)
    const cursorForLast = Buffer.from('3').toString('base64');
    const res = await request(app).get(`/users?limit=10&cursor=${cursorForLast}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.next_cursor).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Invalid cursor → 400
// ---------------------------------------------------------------------------

describe('GET /users – invalid cursor', () => {
  it('returns 400 for a garbage cursor string', async () => {
    const res = await request(app).get('/users?cursor=notavalidcursor!!!');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 for a base64 string that decodes to non-integer', async () => {
    const bad = Buffer.from('not-a-number').toString('base64');
    const res = await request(app).get(`/users?cursor=${bad}`);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 for a base64 cursor that decodes to zero', async () => {
    const bad = Buffer.from('0').toString('base64');
    const res = await request(app).get(`/users?cursor=${bad}`);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});
