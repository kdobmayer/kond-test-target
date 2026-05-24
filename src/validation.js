function validateRequired(fields, body) {
  const missing = [];
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      missing.push(field);
    }
  }
  if (missing.length > 0) {
    return { valid: false, error: `Missing required fields: ${missing.join(', ')}` };
  }
  return { valid: true };
}

function validateNumeric(fields, body) {
  const invalid = [];
  for (const field of fields) {
    if (body[field] !== undefined && body[field] !== null) {
      const num = Number(body[field]);
      if (isNaN(num)) {
        invalid.push(field);
      }
    }
  }
  if (invalid.length > 0) {
    return { valid: false, error: `Fields must be numeric: ${invalid.join(', ')}` };
  }
  return { valid: true };
}

function validatePositive(fields, body) {
  const invalid = [];
  for (const field of fields) {
    if (body[field] !== undefined && body[field] !== null) {
      const num = Number(body[field]);
      if (num < 0) {
        invalid.push(field);
      }
    }
  }
  if (invalid.length > 0) {
    return { valid: false, error: `Fields must be non-negative: ${invalid.join(', ')}` };
  }
  return { valid: true };
}

function validateEmail(email) {
  if (!email) return { valid: true };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  return { valid: true };
}

function validateSku(sku) {
  if (!sku) return { valid: false, error: 'SKU is required' };
  const skuRegex = /^[A-Z0-9-]{3,20}$/;
  if (!skuRegex.test(sku)) {
    return { valid: false, error: 'SKU must be 3-20 characters, uppercase alphanumeric with hyphens' };
  }
  return { valid: true };
}

function validatePagination(query) {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 20;
  const offset = (page - 1) * limit;
  return {
    page: Math.max(1, page),
    limit: Math.min(100, Math.max(1, limit)),
    offset: Math.max(0, offset)
  };
}

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/[<>]/g, '');
}

function validateRating(rating) {
  if (rating === undefined || rating === null) return { valid: true };
  const num = Number(rating);
  if (isNaN(num) || num < 0 || num > 5) {
    return { valid: false, error: 'Rating must be between 0 and 5' };
  }
  return { valid: true };
}

const STATUS_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: []
};

function validateStatusTransition(currentStatus, nextStatus) {
  const allowed = STATUS_TRANSITIONS[currentStatus];
  if (!allowed) {
    return { valid: false, error: `Unknown status: ${currentStatus}` };
  }
  if (!allowed.includes(nextStatus)) {
    return { valid: false, error: `Cannot transition from '${currentStatus}' to '${nextStatus}'` };
  }
  return { valid: true };
}

module.exports = {
  validateRequired,
  validateNumeric,
  validatePositive,
  validateEmail,
  validateSku,
  validatePagination,
  sanitizeString,
  validateRating,
  validateStatusTransition
};
