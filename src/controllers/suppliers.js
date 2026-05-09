const { getDb } = require('../db');
const { validateRequired, validateEmail, validateRating, sanitizeString, validatePagination } = require('../validation');

function listSuppliers(req, res) {
  const db = getDb();
  const { page, limit, offset } = validatePagination(req.query);
  const { active, search } = req.query;

  let sql = `SELECT s.*, COUNT(p.id) as product_count
    FROM suppliers s
    LEFT JOIN products p ON p.supplier_id = s.id
    WHERE 1=1`;
  const params = [];

  if (active !== undefined) {
    sql += ' AND s.active = ?';
    params.push(active === 'true' ? 1 : 0);
  }
  if (search) {
    sql += ' AND (s.name LIKE ? OR s.contact_email LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term);
  }

  sql += ' GROUP BY s.id ORDER BY s.name ASC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const suppliers = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT COUNT(*) as total FROM suppliers').get().total;

  res.json({
    data: suppliers,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
}

function getSupplier(req, res) {
  const db = getDb();
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);

  if (!supplier) {
    return res.status(404).json({ error: 'Not Found', message: `Supplier with id ${req.params.id} not found` });
  }

  const products = db.prepare('SELECT id, name, sku, price, quantity FROM products WHERE supplier_id = ?').all(req.params.id);
  res.json({ data: { ...supplier, products } });
}

// INTENTIONAL: No input validation on POST /suppliers (rough edge for KOND tasks)
function createSupplier(req, res) {
  const db = getDb();
  const body = req.body;

  const result = db.prepare(`
    INSERT INTO suppliers (name, contact_email, contact_phone, address, rating, active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    body.name,
    body.contact_email || null,
    body.contact_phone || null,
    body.address || null,
    body.rating || 0,
    body.active !== undefined ? (body.active ? 1 : 0) : 1
  );

  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ data: supplier });
}

function updateSupplier(req, res) {
  const db = getDb();
  const { id } = req.params;
  const body = req.body;

  const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Not Found', message: `Supplier with id ${id} not found` });
  }

  const requiredCheck = validateRequired(['name'], body);
  if (!requiredCheck.valid && body.name !== undefined) {
    return res.status(400).json({ error: 'Validation Error', message: requiredCheck.error });
  }

  if (body.contact_email) {
    const emailCheck = validateEmail(body.contact_email);
    if (!emailCheck.valid) {
      return res.status(400).json({ error: 'Validation Error', message: emailCheck.error });
    }
  }

  if (body.rating !== undefined) {
    const ratingCheck = validateRating(body.rating);
    if (!ratingCheck.valid) {
      return res.status(400).json({ error: 'Validation Error', message: ratingCheck.error });
    }
  }

  const name = body.name ? sanitizeString(body.name) : existing.name;
  const contact_email = body.contact_email !== undefined ? body.contact_email : existing.contact_email;
  const contact_phone = body.contact_phone !== undefined ? body.contact_phone : existing.contact_phone;
  const address = body.address !== undefined ? sanitizeString(body.address) : existing.address;
  const rating = body.rating !== undefined ? Number(body.rating) : existing.rating;
  const active = body.active !== undefined ? (body.active ? 1 : 0) : existing.active;

  db.prepare(`
    UPDATE suppliers SET name=?, contact_email=?, contact_phone=?, address=?, rating=?, active=?, updated_at=datetime('now')
    WHERE id=?
  `).run(name, contact_email, contact_phone, address, rating, active, id);

  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  res.json({ data: supplier });
}

function deleteSupplier(req, res) {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Not Found', message: `Supplier with id ${id} not found` });
  }

  db.prepare('UPDATE products SET supplier_id = NULL WHERE supplier_id = ?').run(id);
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);

  res.status(204).send();
}

module.exports = { listSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier };
