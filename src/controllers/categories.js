const { getDb } = require('../db');
const { validateRequired, sanitizeString, validatePagination } = require('../validation');

function listCategories(req, res) {
  const db = getDb();
  const { page, limit, offset } = validatePagination(req.query);

  const total = db.prepare('SELECT COUNT(*) as total FROM categories').get().total;

  const categories = db.prepare(`
    SELECT c.*, COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name ASC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  res.json({
    data: categories,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
}

function getCategory(req, res) {
  const db = getDb();
  const category = db.prepare(`
    SELECT c.*, COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    WHERE c.id = ?
    GROUP BY c.id
  `).get(req.params.id);

  if (!category) {
    // Duplicated error formatting (intentional rough edge — same as products)
    return res.status(404).json({
      error: 'Not Found',
      message: `Category with id ${req.params.id} not found`,
      timestamp: new Date().toISOString()
    });
  }

  const products = db.prepare('SELECT id, name, sku, price, quantity FROM products WHERE category_id = ?').all(req.params.id);
  res.json({ data: { ...category, products } });
}

function createCategory(req, res) {
  const db = getDb();
  const body = req.body;

  const requiredCheck = validateRequired(['name'], body);
  if (!requiredCheck.valid) {
    return res.status(400).json({ error: 'Validation Error', message: requiredCheck.error });
  }

  const name = sanitizeString(body.name);
  const description = sanitizeString(body.description || '');

  try {
    const result = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)').run(name, description);
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ data: category });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      // Duplicated error formatting (intentional rough edge — same as products)
      return res.status(409).json({
        error: 'Conflict',
        message: `Category with name '${name}' already exists`,
        timestamp: new Date().toISOString()
      });
    }
    throw err;
  }
}

function updateCategory(req, res) {
  const db = getDb();
  const { id } = req.params;
  const body = req.body;

  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!existing) {
    // Duplicated error formatting (intentional rough edge)
    return res.status(404).json({
      error: 'Not Found',
      message: `Category with id ${id} not found`,
      timestamp: new Date().toISOString()
    });
  }

  const name = body.name ? sanitizeString(body.name) : existing.name;
  const description = body.description !== undefined ? sanitizeString(body.description) : existing.description;

  try {
    db.prepare("UPDATE categories SET name=?, description=?, updated_at=datetime('now') WHERE id=?").run(name, description, id);
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    res.json({ data: category });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({
        error: 'Conflict',
        message: `Category with name '${name}' already exists`,
        timestamp: new Date().toISOString()
      });
    }
    throw err;
  }
}

function deleteCategory(req, res) {
  const db = getDb();
  const { id } = req.params;

  if (Number(id) === 1) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Cannot delete the default Uncategorized category'
    });
  }

  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Category with id ${id} not found`,
      timestamp: new Date().toISOString()
    });
  }

  // Cross-module flow: reassign products to Uncategorized
  db.prepare('UPDATE products SET category_id = 1 WHERE category_id = ?').run(id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);

  res.status(204).send();
}

module.exports = { listCategories, getCategory, createCategory, updateCategory, deleteCategory };
