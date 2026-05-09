const { getDb } = require('../db');
const { validateRequired, validateNumeric, validatePositive, validateSku, validatePagination, sanitizeString } = require('../validation');

function listProducts(req, res) {
  const db = getDb();
  const { page, limit, offset } = validatePagination(req.query);
  const { category_id, supplier_id, active, search } = req.query;

  let sql = `SELECT p.*, c.name as category_name, s.name as supplier_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE 1=1`;
  const params = [];

  if (category_id) {
    sql += ' AND p.category_id = ?';
    params.push(category_id);
  }
  if (supplier_id) {
    sql += ' AND p.supplier_id = ?';
    params.push(supplier_id);
  }
  if (active !== undefined) {
    sql += ' AND p.active = ?';
    params.push(active === 'true' ? 1 : 0);
  }
  if (search) {
    sql += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  const countParams = [...params];
  const countSql = `SELECT COUNT(*) as total FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE 1=1` + sql.split('WHERE 1=1')[1].split('ORDER BY')[0];
  const total = db.prepare(countSql).get(...countParams).total;

  sql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const products = db.prepare(sql).all(...params);

  res.json({
    data: products,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
}

function getProduct(req, res) {
  const db = getDb();
  const product = db.prepare(`
    SELECT p.*, c.name as category_name, s.name as supplier_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!product) {
    // Duplicated error formatting (intentional rough edge)
    return res.status(404).json({
      error: 'Not Found',
      message: `Product with id ${req.params.id} not found`,
      timestamp: new Date().toISOString()
    });
  }

  res.json({ data: product });
}

function createProduct(req, res) {
  const db = getDb();
  const body = req.body;

  const requiredCheck = validateRequired(['name', 'sku', 'price'], body);
  if (!requiredCheck.valid) {
    return res.status(400).json({ error: 'Validation Error', message: requiredCheck.error });
  }

  const skuCheck = validateSku(body.sku);
  if (!skuCheck.valid) {
    return res.status(400).json({ error: 'Validation Error', message: skuCheck.error });
  }

  const numericCheck = validateNumeric(['price', 'cost', 'quantity', 'reorder_level'], body);
  if (!numericCheck.valid) {
    return res.status(400).json({ error: 'Validation Error', message: numericCheck.error });
  }

  const positiveCheck = validatePositive(['price', 'cost', 'quantity', 'reorder_level'], body);
  if (!positiveCheck.valid) {
    return res.status(400).json({ error: 'Validation Error', message: positiveCheck.error });
  }

  const name = sanitizeString(body.name);
  const sku = body.sku.toUpperCase();
  const description = sanitizeString(body.description || '');
  const price = Number(body.price);
  const cost = Number(body.cost || 0);
  const quantity = Number(body.quantity || 0);
  const reorder_level = Number(body.reorder_level || 10);
  const category_id = body.category_id || null;
  const supplier_id = body.supplier_id || null;

  try {
    const result = db.prepare(`
      INSERT INTO products (name, sku, description, price, cost, quantity, reorder_level, category_id, supplier_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, sku, description, price, cost, quantity, reorder_level, category_id, supplier_id);

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ data: product });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      // Duplicated error formatting (intentional rough edge)
      return res.status(409).json({
        error: 'Conflict',
        message: `Product with SKU ${sku} already exists`,
        timestamp: new Date().toISOString()
      });
    }
    throw err;
  }
}

function updateProduct(req, res) {
  const db = getDb();
  const { id } = req.params;
  const body = req.body;

  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) {
    // Duplicated error formatting (intentional rough edge)
    return res.status(404).json({
      error: 'Not Found',
      message: `Product with id ${id} not found`,
      timestamp: new Date().toISOString()
    });
  }

  const numericCheck = validateNumeric(['price', 'cost', 'quantity', 'reorder_level'], body);
  if (!numericCheck.valid) {
    return res.status(400).json({ error: 'Validation Error', message: numericCheck.error });
  }

  const positiveCheck = validatePositive(['price', 'cost', 'quantity', 'reorder_level'], body);
  if (!positiveCheck.valid) {
    return res.status(400).json({ error: 'Validation Error', message: positiveCheck.error });
  }

  const name = body.name ? sanitizeString(body.name) : existing.name;
  const description = body.description !== undefined ? sanitizeString(body.description) : existing.description;
  const price = body.price !== undefined ? Number(body.price) : existing.price;
  const cost = body.cost !== undefined ? Number(body.cost) : existing.cost;
  const quantity = body.quantity !== undefined ? Number(body.quantity) : existing.quantity;
  const reorder_level = body.reorder_level !== undefined ? Number(body.reorder_level) : existing.reorder_level;
  const category_id = body.category_id !== undefined ? body.category_id : existing.category_id;
  const supplier_id = body.supplier_id !== undefined ? body.supplier_id : existing.supplier_id;
  const active = body.active !== undefined ? (body.active ? 1 : 0) : existing.active;

  db.prepare(`
    UPDATE products SET name=?, description=?, price=?, cost=?, quantity=?, reorder_level=?,
    category_id=?, supplier_id=?, active=?, updated_at=datetime('now') WHERE id=?
  `).run(name, description, price, cost, quantity, reorder_level, category_id, supplier_id, active, id);

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  res.json({ data: product });
}

function deleteProduct(req, res) {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Product with id ${id} not found`,
      timestamp: new Date().toISOString()
    });
  }

  db.prepare('DELETE FROM stock_adjustments WHERE product_id = ?').run(id);
  db.prepare('DELETE FROM products WHERE id = ?').run(id);

  res.status(204).send();
}

module.exports = { listProducts, getProduct, createProduct, updateProduct, deleteProduct };
