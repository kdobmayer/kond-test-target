const { getDb } = require('../db');

// Cross-module flow: reports aggregate across categories and products
function lowStock(req, res) {
  const db = getDb();
  const threshold = req.query.threshold ? Number(req.query.threshold) : null;

  let sql = `SELECT p.id, p.name, p.sku, p.quantity, p.reorder_level,
    p.price, p.cost, c.name as category_name, s.name as supplier_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE p.active = 1`;
  const params = [];

  if (threshold !== null) {
    sql += ' AND p.quantity <= ?';
    params.push(threshold);
  } else {
    sql += ' AND p.quantity <= p.reorder_level';
  }

  sql += ' ORDER BY p.quantity ASC';

  const products = db.prepare(sql).all(...params);

  const totalValue = products.reduce((sum, p) => sum + (p.quantity * p.cost), 0);

  res.json({
    data: {
      products,
      summary: {
        total_products: products.length,
        total_value_at_risk: Math.round(totalValue * 100) / 100
      }
    }
  });
}

// Cross-module flow: aggregates across categories
function categorySummary(req, res) {
  const db = getDb();

  const categories = db.prepare(`
    SELECT c.id, c.name,
      COUNT(p.id) as product_count,
      COALESCE(SUM(p.quantity), 0) as total_quantity,
      COALESCE(SUM(p.quantity * p.price), 0) as total_retail_value,
      COALESCE(SUM(p.quantity * p.cost), 0) as total_cost_value,
      COALESCE(AVG(p.price), 0) as avg_price
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id AND p.active = 1
    GROUP BY c.id
    ORDER BY total_retail_value DESC
  `).all();

  const totals = categories.reduce((acc, cat) => {
    acc.total_products += cat.product_count;
    acc.total_quantity += cat.total_quantity;
    acc.total_retail_value += cat.total_retail_value;
    acc.total_cost_value += cat.total_cost_value;
    return acc;
  }, { total_products: 0, total_quantity: 0, total_retail_value: 0, total_cost_value: 0 });

  totals.total_retail_value = Math.round(totals.total_retail_value * 100) / 100;
  totals.total_cost_value = Math.round(totals.total_cost_value * 100) / 100;
  totals.potential_profit = Math.round((totals.total_retail_value - totals.total_cost_value) * 100) / 100;

  res.json({ data: { categories, totals } });
}

function supplierSummary(req, res) {
  const db = getDb();

  const suppliers = db.prepare(`
    SELECT s.id, s.name, s.rating, s.active,
      COUNT(p.id) as product_count,
      COALESCE(SUM(p.quantity), 0) as total_quantity,
      COALESCE(SUM(p.quantity * p.cost), 0) as total_cost_value,
      COALESCE(SUM(p.quantity * p.price), 0) as total_retail_value
    FROM suppliers s
    LEFT JOIN products p ON p.supplier_id = s.id AND p.active = 1
    GROUP BY s.id
    ORDER BY total_cost_value DESC
  `).all();

  const totals = suppliers.reduce((acc, sup) => {
    acc.total_suppliers += 1;
    acc.total_products += sup.product_count;
    acc.total_cost_value += sup.total_cost_value;
    acc.total_retail_value += sup.total_retail_value;
    return acc;
  }, { total_suppliers: 0, total_products: 0, total_cost_value: 0, total_retail_value: 0 });

  totals.total_cost_value = Math.round(totals.total_cost_value * 100) / 100;
  totals.total_retail_value = Math.round(totals.total_retail_value * 100) / 100;

  res.json({ data: { suppliers, totals } });
}

function stockMovements(req, res) {
  const db = getDb();
  const days = req.query.days ? Number(req.query.days) : 30;

  const movements = db.prepare(`
    SELECT sa.*, p.name as product_name, p.sku
    FROM stock_adjustments sa
    JOIN products p ON sa.product_id = p.id
    WHERE sa.created_at >= datetime('now', ?)
    ORDER BY sa.created_at DESC
    LIMIT 100
  `).all(`-${days} days`);

  const summary = db.prepare(`
    SELECT
      COUNT(*) as total_adjustments,
      SUM(CASE WHEN quantity_change > 0 THEN quantity_change ELSE 0 END) as total_added,
      SUM(CASE WHEN quantity_change < 0 THEN ABS(quantity_change) ELSE 0 END) as total_removed,
      COUNT(DISTINCT product_id) as products_affected
    FROM stock_adjustments
    WHERE created_at >= datetime('now', ?)
  `).get(`-${days} days`);

  res.json({ data: { movements, summary, period_days: days } });
}

module.exports = { lowStock, categorySummary, supplierSummary, stockMovements };
