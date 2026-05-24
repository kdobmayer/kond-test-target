const { getDb } = require('../db');
const { validateRequired, validatePagination, sanitizeString } = require('../validation');

function listOrders(req, res) {
  const db = getDb();
  const { page, limit, offset } = validatePagination(req.query);

  const total = db.prepare('SELECT COUNT(*) as total FROM orders').get().total;
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);

  res.json({
    data: orders,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
}

function getOrder(req, res) {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);

  if (!order) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Order with id ${req.params.id} not found`,
      timestamp: new Date().toISOString()
    });
  }

  res.json({ data: order });
}

function createOrder(req, res) {
  const db = getDb();
  const body = req.body;

  const requiredCheck = validateRequired(['customer_name'], body);
  if (!requiredCheck.valid) {
    return res.status(400).json({
      error: 'Validation Error',
      message: requiredCheck.error,
      timestamp: new Date().toISOString()
    });
  }

  const customer_name = sanitizeString(body.customer_name);
  if (typeof customer_name !== 'string' || customer_name.length === 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'customer_name must be a non-empty string',
      timestamp: new Date().toISOString()
    });
  }

  const result = db.prepare(
    "INSERT INTO orders (customer_name, status) VALUES (?, 'pending')"
  ).run(customer_name);

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ data: order });
}

module.exports = { listOrders, getOrder, createOrder };
