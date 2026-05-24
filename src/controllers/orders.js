const { getDb } = require('../db');
const { validateRequired, validateNumeric, validatePagination, sanitizeString, validateStatusTransition } = require('../validation');

function sendError(res, status, error, message) {
  return res.status(status).json({
    error,
    message,
    timestamp: new Date().toISOString()
  });
}

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
    return sendError(res, 404, 'Not Found', `Order with id ${req.params.id} not found`);
  }

  res.json({ data: order });
}

function createOrder(req, res) {
  const db = getDb();
  const body = req.body;

  const requiredCheck = validateRequired(['customer_name'], body);
  if (!requiredCheck.valid) {
    return sendError(res, 400, 'Validation Error', requiredCheck.error);
  }

  const customer_name = sanitizeString(body.customer_name);
  if (typeof customer_name !== 'string' || customer_name.length === 0) {
    return sendError(res, 400, 'Validation Error', 'customer_name must be a non-empty string');
  }

  const result = db.prepare(
    "INSERT INTO orders (customer_name, status) VALUES (?, 'pending')"
  ).run(customer_name);

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ data: order });
}

function addOrderItem(req, res) {
  const db = getDb();
  const { id } = req.params;
  const body = req.body;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) {
    return sendError(res, 404, 'Not Found', `Order with id ${id} not found`);
  }
  if (order.status !== 'pending') {
    return sendError(
      res,
      409,
      'Conflict',
      `Cannot add items to order ${id} while status is '${order.status}'`
    );
  }

  const requiredCheck = validateRequired(['product_id', 'quantity'], body);
  if (!requiredCheck.valid) {
    return sendError(res, 400, 'Validation Error', requiredCheck.error);
  }

  const numericCheck = validateNumeric(['product_id', 'quantity'], body);
  if (!numericCheck.valid) {
    return sendError(res, 400, 'Validation Error', numericCheck.error);
  }

  const product_id = Number(body.product_id);
  const quantity = Number(body.quantity);

  if (!Number.isInteger(product_id) || product_id <= 0) {
    return sendError(res, 400, 'Validation Error', 'product_id must be a positive integer');
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return sendError(res, 400, 'Validation Error', 'quantity must be a positive integer');
  }

  const productSelect = db.prepare('SELECT * FROM products WHERE id = ?');
  const itemInsert = db.prepare(
    'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)'
  );
  const stockAdjustInsert = db.prepare(`
    INSERT INTO stock_adjustments (product_id, quantity_change, reason, type, reference_id)
    VALUES (?, ?, ?, ?, ?)
  `);
  const productUpdate = db.prepare(
    "UPDATE products SET quantity = quantity - ?, updated_at = datetime('now') WHERE id = ?"
  );
  const productSummarySelect = db.prepare('SELECT id, name, quantity FROM products WHERE id = ?');

  let orderItemId;
  let updatedProduct;
  let availableQuantity = null;
  let productExists = true;
  const transaction = db.transaction(() => {
    const product = productSelect.get(product_id);
    if (!product) {
      productExists = false;
      return;
    }

    if (product.quantity < quantity) {
      availableQuantity = product.quantity;
      return;
    }

    const result = itemInsert.run(id, product_id, quantity, product.price);
    orderItemId = result.lastInsertRowid;
    stockAdjustInsert.run(product_id, -quantity, `Order item added to order ${id}`, 'order', String(id));
    productUpdate.run(quantity, product_id);
    updatedProduct = productSummarySelect.get(product_id);
  });

  transaction();

  if (!productExists) {
    return sendError(res, 404, 'Not Found', `Product with id ${product_id} not found`);
  }

  if (availableQuantity !== null) {
    return sendError(
      res,
      409,
      'Conflict',
      `Insufficient stock. Available: ${availableQuantity}, requested: ${quantity}`
    );
  }

  const orderItem = db.prepare('SELECT * FROM order_items WHERE id = ?').get(orderItemId);
  res.status(201).json({ data: { order_item: orderItem, product: updatedProduct } });
}

function listOrderItems(req, res) {
  const db = getDb();
  const { id } = req.params;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) {
    return sendError(res, 404, 'Not Found', `Order with id ${id} not found`);
  }

  const items = db.prepare(`
    SELECT oi.*, p.name as product_name, p.sku as product_sku
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
    ORDER BY oi.id ASC
  `).all(id);

  res.json({ data: items });
}

function updateOrderStatus(req, res) {
  const db = getDb();
  const { id } = req.params;
  const body = req.body;

  const requiredCheck = validateRequired(['status'], body);
  if (!requiredCheck.valid) {
    return sendError(res, 400, 'Validation Error', requiredCheck.error);
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) {
    return sendError(res, 404, 'Not Found', `Order with id ${id} not found`);
  }

  const transitionCheck = validateStatusTransition(order.status, body.status);
  if (!transitionCheck.valid) {
    return sendError(res, 422, 'Unprocessable Entity', transitionCheck.error);
  }

  const nextStatus = body.status;

  if (nextStatus === 'cancelled') {
    const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(id);
    const stockAdjustInsert = db.prepare(`
      INSERT INTO stock_adjustments (product_id, quantity_change, reason, type, reference_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    const productUpdate = db.prepare(
      "UPDATE products SET quantity = quantity + ?, updated_at = datetime('now') WHERE id = ?"
    );
    const orderUpdate = db.prepare(
      "UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?"
    );
    const transaction = db.transaction(() => {
      for (const item of items) {
        stockAdjustInsert.run(
          item.product_id,
          item.quantity,
          `Order ${id} cancelled`,
          'order_cancel',
          String(id)
        );
        productUpdate.run(item.quantity, item.product_id);
      }
      orderUpdate.run(nextStatus, id);
    });
    transaction();
  } else {
    db.prepare(
      "UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(nextStatus, id);
  }

  const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  res.json({ data: updatedOrder });
}

module.exports = { listOrders, getOrder, createOrder, addOrderItem, listOrderItems, updateOrderStatus };
