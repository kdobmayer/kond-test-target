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

describe('GET /api/reports/low-stock', () => {
  it('returns 401 without api key', async () => {
    const res = await request(app).get('/api/reports/low-stock');
    expect(res.status).toBe(401);
  });

  it('returns only products below reorder level by default', async () => {
    const res = await request(app).get('/api/reports/low-stock').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    // Only T-Shirt qualifies (qty=5 <= reorder=20); Laptop (50>10) and Headphones (100>15) do not
    expect(res.body.data.products).toHaveLength(1);
    expect(res.body.data.products[0].name).toBe('T-Shirt');
  });

  it('includes category_name and supplier_name on each product', async () => {
    const res = await request(app).get('/api/reports/low-stock').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    const product = res.body.data.products[0];
    expect(product.category_name).toBe('Clothing');
    expect(product.supplier_name).toBe('FashionInc');
  });

  it('computes correct summary for default threshold', async () => {
    const res = await request(app).get('/api/reports/low-stock').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    const { summary } = res.body.data;
    expect(summary.total_products).toBe(1);
    // T-Shirt: 5 * 10 = 50
    expect(summary.total_value_at_risk).toBe(50);
  });

  it('filters by ?threshold=60 (Laptop and T-Shirt, not Headphones)', async () => {
    const res = await request(app).get('/api/reports/low-stock?threshold=60').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    // Laptop qty=50 <=60, T-Shirt qty=5 <=60, Headphones qty=100 >60
    expect(res.body.data.products).toHaveLength(2);
    expect(res.body.data.summary.total_products).toBe(2);
  });

  it('returns empty list when threshold is below all quantities', async () => {
    const res = await request(app).get('/api/reports/low-stock?threshold=3').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data.products).toHaveLength(0);
    expect(res.body.data.summary.total_products).toBe(0);
    expect(res.body.data.summary.total_value_at_risk).toBe(0);
  });

  it('returns all products when threshold is above all quantities', async () => {
    const res = await request(app).get('/api/reports/low-stock?threshold=200').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data.products).toHaveLength(3);
  });

  it('returns 400 for a non-numeric threshold', async () => {
    const res = await request(app).get('/api/reports/low-stock?threshold=nope').set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Validation Error',
      message: 'Fields must be numeric: threshold'
    });
  });

  it('returns 400 for a negative threshold', async () => {
    const res = await request(app).get('/api/reports/low-stock?threshold=-1').set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Validation Error',
      message: 'Fields must be non-negative: threshold'
    });
  });
});

describe('GET /api/reports/category-summary', () => {
  it('returns 401 without api key', async () => {
    const res = await request(app).get('/api/reports/category-summary');
    expect(res.status).toBe(401);
  });

  it('returns all categories including Uncategorized', async () => {
    const res = await request(app).get('/api/reports/category-summary').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    const ids = res.body.data.categories.map(c => c.id);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    expect(ids).toContain(3);
  });

  it('computes correct aggregates for Electronics', async () => {
    const res = await request(app).get('/api/reports/category-summary').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    const electronics = res.body.data.categories.find(c => c.id === 2);
    expect(electronics.product_count).toBe(2);
    expect(electronics.total_quantity).toBe(150); // 50+100
    // (50*999.99)+(100*149.99) = 49999.5+14999 = 64998.5
    expect(electronics.total_retail_value).toBe(64998.5);
    // (50*700)+(100*80) = 35000+8000 = 43000
    expect(electronics.total_cost_value).toBe(43000);
  });

  it('computes correct aggregates for Clothing', async () => {
    const res = await request(app).get('/api/reports/category-summary').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    const clothing = res.body.data.categories.find(c => c.id === 3);
    expect(clothing.product_count).toBe(1);
    expect(clothing.total_quantity).toBe(5);
    expect(clothing.total_retail_value).toBe(149.95); // 5*29.99
    expect(clothing.total_cost_value).toBe(50); // 5*10
  });

  it('returns zeros for Uncategorized category', async () => {
    const res = await request(app).get('/api/reports/category-summary').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    const uncategorized = res.body.data.categories.find(c => c.id === 1);
    expect(uncategorized.product_count).toBe(0);
    expect(uncategorized.total_quantity).toBe(0);
    expect(uncategorized.total_retail_value).toBe(0);
    expect(uncategorized.total_cost_value).toBe(0);
  });

  it('computes correct cross-category totals', async () => {
    const res = await request(app).get('/api/reports/category-summary').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    const { totals } = res.body.data;
    expect(totals.total_products).toBe(3);
    expect(totals.total_quantity).toBe(155); // 50+100+5
    expect(totals.total_retail_value).toBe(65148.45); // 64998.5+149.95
    expect(totals.total_cost_value).toBe(43050); // 43000+50
    expect(totals.potential_profit).toBe(22098.45); // 65148.45-43050
  });
});

describe('GET /api/reports/supplier-summary', () => {
  it('returns 401 without api key', async () => {
    const res = await request(app).get('/api/reports/supplier-summary');
    expect(res.status).toBe(401);
  });

  it('returns all suppliers', async () => {
    const res = await request(app).get('/api/reports/supplier-summary').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data.suppliers).toHaveLength(2);
  });

  it('computes correct aggregates for TechCorp', async () => {
    const res = await request(app).get('/api/reports/supplier-summary').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    const techcorp = res.body.data.suppliers.find(s => s.id === 1);
    expect(techcorp.product_count).toBe(2);
    expect(techcorp.total_quantity).toBe(150); // 50+100
    expect(techcorp.rating).toBe(4);
  });

  it('computes correct aggregates for FashionInc', async () => {
    const res = await request(app).get('/api/reports/supplier-summary').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    const fashioninc = res.body.data.suppliers.find(s => s.id === 2);
    expect(fashioninc.product_count).toBe(1);
    expect(fashioninc.total_quantity).toBe(5);
    expect(fashioninc.rating).toBe(3);
  });

  it('includes active field on each supplier', async () => {
    const res = await request(app).get('/api/reports/supplier-summary').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    for (const supplier of res.body.data.suppliers) {
      expect(supplier).toHaveProperty('active');
    }
  });

  it('computes correct cross-supplier totals', async () => {
    const res = await request(app).get('/api/reports/supplier-summary').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    const { totals } = res.body.data;
    expect(totals.total_suppliers).toBe(2);
    expect(totals.total_products).toBe(3);
    expect(totals.total_cost_value).toBe(43050); // 43000+50
    expect(totals.total_retail_value).toBe(65148.45); // 64998.5+149.95
  });
});

describe('GET /api/reports/stock-movements', () => {
  it('returns 401 without api key', async () => {
    const res = await request(app).get('/api/reports/stock-movements');
    expect(res.status).toBe(401);
  });

  it('returns both seeded movements within default 30-day window', async () => {
    const res = await request(app).get('/api/reports/stock-movements').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data.movements).toHaveLength(2);
    expect(res.body.data.period_days).toBe(30);
  });

  it('includes product_name and sku on each movement', async () => {
    const res = await request(app).get('/api/reports/stock-movements').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    const laptop = res.body.data.movements.find(m => m.product_id === 1);
    expect(laptop.product_name).toBe('Laptop');
    expect(laptop.sku).toBe('LAPTOP-001');
  });

  it('computes correct summary totals', async () => {
    const res = await request(app).get('/api/reports/stock-movements').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    const { summary } = res.body.data;
    expect(summary.total_adjustments).toBe(2);
    expect(summary.total_added).toBe(55); // 50+5
    expect(summary.total_removed).toBe(0);
    expect(summary.products_affected).toBe(2);
  });

  it('echoes period_days=1 when ?days=1 is passed', async () => {
    const res = await request(app).get('/api/reports/stock-movements?days=1').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data.period_days).toBe(1);
    // Seeded adjustments are inserted at test runtime, so still within 1 day
    expect(res.body.data.movements).toHaveLength(2);
  });

  it('echoes period_days=365 when ?days=365 is passed', async () => {
    const res = await request(app).get('/api/reports/stock-movements?days=365').set('x-api-key', API_KEY);
    expect(res.status).toBe(200);
    expect(res.body.data.period_days).toBe(365);
    expect(res.body.data.movements).toHaveLength(2);
  });

  it('returns 400 for a non-numeric days value', async () => {
    const res = await request(app).get('/api/reports/stock-movements?days=abc').set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Validation Error',
      message: 'Fields must be numeric: days'
    });
  });

  it('returns 400 for a non-positive or non-integer days value', async () => {
    const zeroRes = await request(app).get('/api/reports/stock-movements?days=0').set('x-api-key', API_KEY);
    expect(zeroRes.status).toBe(400);
    expect(zeroRes.body).toEqual({
      error: 'Validation Error',
      message: 'days must be a positive integer'
    });

    const floatRes = await request(app).get('/api/reports/stock-movements?days=1.5').set('x-api-key', API_KEY);
    expect(floatRes.status).toBe(400);
    expect(floatRes.body).toEqual({
      error: 'Validation Error',
      message: 'days must be a positive integer'
    });
  });
});
