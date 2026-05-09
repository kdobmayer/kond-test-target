const { createApp } = require('../src/app');
const { getDb, closeDb, resetDb } = require('../src/db');
const path = require('path');

const API_KEY = 'test-api-key-123';

function setupTestDb() {
  process.env.DB_PATH = ':memory:';
  resetDb();
}

function teardownTestDb() {
  closeDb();
  delete process.env.DB_PATH;
}

function seedTestData() {
  const db = getDb();

  db.prepare("INSERT OR IGNORE INTO categories (id, name, description) VALUES (2, 'Electronics', 'Electronic devices')").run();
  db.prepare("INSERT OR IGNORE INTO categories (id, name, description) VALUES (3, 'Clothing', 'Apparel and accessories')").run();

  db.prepare("INSERT OR IGNORE INTO suppliers (id, name, contact_email, rating) VALUES (1, 'TechCorp', 'tech@corp.com', 4)").run();
  db.prepare("INSERT OR IGNORE INTO suppliers (id, name, contact_email, rating) VALUES (2, 'FashionInc', 'info@fashion.com', 3)").run();

  db.prepare(`INSERT OR IGNORE INTO products (id, name, sku, price, cost, quantity, reorder_level, category_id, supplier_id)
    VALUES (1, 'Laptop', 'LAPTOP-001', 999.99, 700, 50, 10, 2, 1)`).run();
  db.prepare(`INSERT OR IGNORE INTO products (id, name, sku, price, cost, quantity, reorder_level, category_id, supplier_id)
    VALUES (2, 'T-Shirt', 'TSHIRT-001', 29.99, 10, 5, 20, 3, 2)`).run();
  db.prepare(`INSERT OR IGNORE INTO products (id, name, sku, price, cost, quantity, reorder_level, category_id, supplier_id)
    VALUES (3, 'Headphones', 'HEAD-001', 149.99, 80, 100, 15, 2, 1)`).run();

  db.prepare("INSERT OR IGNORE INTO stock_adjustments (product_id, quantity_change, reason, type) VALUES (1, 50, 'Initial stock', 'receipt')").run();
  db.prepare("INSERT OR IGNORE INTO stock_adjustments (product_id, quantity_change, reason, type) VALUES (2, 5, 'Initial stock', 'receipt')").run();
}

module.exports = { createApp, setupTestDb, teardownTestDb, seedTestData, API_KEY, getDb };
