const { getDb } = require('../db');
const { validatePagination } = require('../validation');

function listStock(req, res) {
  const db = getDb();
  const { page, limit, offset } = validatePagination(req.query);
  const { below_reorder } = req.query;

  let sql = `SELECT p.id, p.name, p.sku, p.quantity, p.reorder_level, p.cost, p.price,
    c.name as category_name, s.name as supplier_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE p.active = 1`;
  const params = [];

  if (below_reorder === 'true') {
    sql += ' AND p.quantity <= p.reorder_level';
  }

  const countParams = [...params];
  const countSql = `SELECT COUNT(*) as total FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE p.active = 1` + (below_reorder === 'true' ? ' AND p.quantity <= p.reorder_level' : '');
  const total = db.prepare(countSql).get(...countParams).total;

  sql += ' ORDER BY p.quantity ASC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const stock = db.prepare(sql).all(...params);

  res.json({
    data: stock,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
}

function getStockHistory(req, res) {
  const db = getDb();
  const { product_id } = req.params;
  const { page, limit, offset } = validatePagination(req.query);

  const product = db.prepare('SELECT id, name, sku, quantity FROM products WHERE id = ?').get(product_id);
  if (!product) {
    return res.status(404).json({ error: 'Not Found', message: `Product with id ${product_id} not found` });
  }

  const total = db.prepare('SELECT COUNT(*) as total FROM stock_adjustments WHERE product_id = ?').get(product_id).total;

  const adjustments = db.prepare(`
    SELECT * FROM stock_adjustments WHERE product_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(product_id, limit, offset);

  res.json({
    data: { product, adjustments },
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
}

// INTENTIONAL: No input validation on POST /stock/adjust (rough edge for KOND tasks)
// Cross-module flow: stock adjustment updates product quantity
function adjustStock(req, res) {
  const db = getDb();
  const { product_id, quantity_change, reason, type, reference_id } = req.body;

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
  if (!product) {
    return res.status(404).json({ error: 'Not Found', message: `Product with id ${product_id} not found` });
  }

  const newQuantity = product.quantity + quantity_change;
  if (newQuantity < 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: `Insufficient stock. Current: ${product.quantity}, requested change: ${quantity_change}`
    });
  }

  const adjustInsert = db.prepare(`
    INSERT INTO stock_adjustments (product_id, quantity_change, reason, type, reference_id)
    VALUES (?, ?, ?, ?, ?)
  `);

  const productUpdate = db.prepare("UPDATE products SET quantity = ?, updated_at = datetime('now') WHERE id = ?");

  const transaction = db.transaction(() => {
    adjustInsert.run(product_id, quantity_change, reason || null, type || 'manual', reference_id || null);
    productUpdate.run(newQuantity, product_id);
  });

  transaction();

  const updatedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
  const adjustment = db.prepare('SELECT * FROM stock_adjustments WHERE product_id = ? ORDER BY id DESC LIMIT 1').get(product_id);

  res.status(201).json({
    data: {
      adjustment,
      product: { id: updatedProduct.id, name: updatedProduct.name, quantity: updatedProduct.quantity }
    }
  });
}

// INTENTIONAL: No input validation on PUT /stock/adjust (rough edge for KOND tasks)
function bulkAdjustStock(req, res) {
  const db = getDb();
  const { adjustments } = req.body;

  if (!Array.isArray(adjustments)) {
    return res.status(400).json({ error: 'Bad Request', message: 'adjustments must be an array' });
  }

  const results = [];
  const errors = [];

  const adjustInsert = db.prepare(`
    INSERT INTO stock_adjustments (product_id, quantity_change, reason, type, reference_id)
    VALUES (?, ?, ?, ?, ?)
  `);
  const productUpdate = db.prepare("UPDATE products SET quantity = ?, updated_at = datetime('now') WHERE id = ?");

  const transaction = db.transaction(() => {
    for (const adj of adjustments) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(adj.product_id);
      if (!product) {
        errors.push({ product_id: adj.product_id, error: 'Product not found' });
        continue;
      }

      const newQuantity = product.quantity + adj.quantity_change;
      if (newQuantity < 0) {
        errors.push({ product_id: adj.product_id, error: 'Insufficient stock' });
        continue;
      }

      adjustInsert.run(adj.product_id, adj.quantity_change, adj.reason || null, adj.type || 'bulk', adj.reference_id || null);
      productUpdate.run(newQuantity, adj.product_id);
      results.push({ product_id: adj.product_id, new_quantity: newQuantity });
    }
  });

  transaction();

  res.json({ data: { successful: results, errors } });
}

module.exports = { listStock, getStockHistory, adjustStock, bulkAdjustStock };
