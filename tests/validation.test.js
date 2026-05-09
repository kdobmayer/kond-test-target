const {
  validateRequired,
  validateNumeric,
  validatePositive,
  validateEmail,
  validateSku,
  validatePagination,
  sanitizeString,
  validateRating
} = require('../src/validation');

describe('validateRequired', () => {
  it('returns valid when all fields present', () => {
    const result = validateRequired(['name', 'email'], { name: 'John', email: 'j@j.com' });
    expect(result.valid).toBe(true);
  });

  it('returns invalid with missing fields', () => {
    const result = validateRequired(['name', 'email'], { name: 'John' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('email');
  });

  it('treats empty string as missing', () => {
    const result = validateRequired(['name'], { name: '' });
    expect(result.valid).toBe(false);
  });

  it('treats null as missing', () => {
    const result = validateRequired(['name'], { name: null });
    expect(result.valid).toBe(false);
  });
});

describe('validateNumeric', () => {
  it('returns valid for numeric values', () => {
    const result = validateNumeric(['price'], { price: 10.5 });
    expect(result.valid).toBe(true);
  });

  it('returns invalid for non-numeric values', () => {
    const result = validateNumeric(['price'], { price: 'abc' });
    expect(result.valid).toBe(false);
  });

  it('skips undefined fields', () => {
    const result = validateNumeric(['price'], {});
    expect(result.valid).toBe(true);
  });
});

describe('validatePositive', () => {
  it('returns valid for positive values', () => {
    const result = validatePositive(['qty'], { qty: 5 });
    expect(result.valid).toBe(true);
  });

  it('returns invalid for negative values', () => {
    const result = validatePositive(['qty'], { qty: -1 });
    expect(result.valid).toBe(false);
  });

  it('allows zero', () => {
    const result = validatePositive(['qty'], { qty: 0 });
    expect(result.valid).toBe(true);
  });
});

describe('validateEmail', () => {
  it('returns valid for correct email', () => {
    expect(validateEmail('test@example.com').valid).toBe(true);
  });

  it('returns invalid for bad email', () => {
    expect(validateEmail('not-an-email').valid).toBe(false);
  });

  it('returns valid for empty/null email', () => {
    expect(validateEmail(null).valid).toBe(true);
    expect(validateEmail('').valid).toBe(true);
  });
});

describe('validateSku', () => {
  it('returns valid for correct SKU', () => {
    expect(validateSku('ABC-123').valid).toBe(true);
  });

  it('returns invalid for lowercase', () => {
    expect(validateSku('abc-123').valid).toBe(false);
  });

  it('returns invalid for too short', () => {
    expect(validateSku('AB').valid).toBe(false);
  });

  it('returns invalid for empty', () => {
    expect(validateSku('').valid).toBe(false);
  });
});

describe('validatePagination', () => {
  it('returns defaults for empty query', () => {
    const result = validatePagination({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it('calculates offset correctly', () => {
    const result = validatePagination({ page: '3', limit: '10' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(20);
  });

  it('caps limit at 100', () => {
    const result = validatePagination({ limit: '500' });
    expect(result.limit).toBe(100);
  });
});

describe('sanitizeString', () => {
  it('trims whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  it('removes angle brackets', () => {
    expect(sanitizeString('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
  });

  it('returns non-strings unchanged', () => {
    expect(sanitizeString(123)).toBe(123);
  });
});

describe('validateRating', () => {
  it('returns valid for rating in range', () => {
    expect(validateRating(3).valid).toBe(true);
  });

  it('returns invalid for rating above 5', () => {
    expect(validateRating(6).valid).toBe(false);
  });

  it('returns invalid for negative rating', () => {
    expect(validateRating(-1).valid).toBe(false);
  });

  it('returns valid for undefined', () => {
    expect(validateRating(undefined).valid).toBe(true);
  });
});
