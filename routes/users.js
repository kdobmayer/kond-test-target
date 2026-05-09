const { Router } = require('express');

const router = Router();

/** @type {Array<{id: number, name: string, email: string}>} */
let users = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
  { id: 3, name: 'Carol', email: 'carol@example.com' },
];
let nextId = 4;

/** Resets the user store to the initial seed state (used in tests). */
function resetUsers() {
  users = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
    { id: 3, name: 'Carol', email: 'carol@example.com' },
  ];
  nextId = 4;
}

/**
 * Encode a user ID as an opaque cursor string.
 * @param {number} id
 * @returns {string}
 */
function encodeCursor(id) {
  return Buffer.from(String(id)).toString('base64');
}

/**
 * Decode a cursor string back to a user ID.
 * Returns null if the cursor is invalid or does not represent a positive integer.
 * @param {string} cursor
 * @returns {number|null}
 */
function decodeCursor(cursor) {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf8');
    const id = parseInt(decoded, 10);
    if (!Number.isInteger(id) || id <= 0 || String(id) !== decoded) return null;
    return id;
  } catch {
    return null;
  }
}

/**
 * GET /users
 *
 * Without query params: returns all users (legacy shape).
 * With limit and/or cursor: returns paginated results.
 *
 * Query params:
 *   limit  {number}  Max results per page (default 20, max 100).
 *   cursor {string}  Opaque cursor from a previous response's next_cursor.
 *
 * Paginated response: { data: [...], next_cursor: string|null }
 * Legacy response:    [...] (array)
 */
router.get('/', async (req, res, next) => {
  try {
    const hasPaginationParams = req.query.limit !== undefined || req.query.cursor !== undefined;

    if (!hasPaginationParams) {
      return res.json(users);
    }

    // Parse limit
    const rawLimit = req.query.limit !== undefined ? parseInt(req.query.limit, 10) : 20;
    if (!Number.isInteger(rawLimit) || rawLimit < 1) {
      return res.status(400).json({ error: 'Invalid limit' });
    }
    const limit = Math.min(rawLimit, 100);

    // Parse cursor
    let afterId = 0;
    if (req.query.cursor !== undefined) {
      const decoded = decodeCursor(req.query.cursor);
      if (decoded === null) {
        return res.status(400).json({ error: 'Invalid cursor' });
      }
      afterId = decoded;
    }

    // Users are stored in insertion order; cursor filters to IDs > afterId
    const slice = users.filter((u) => u.id > afterId).slice(0, limit);
    const lastItem = slice[slice.length - 1];

    // Determine whether there is a next page
    const hasMore = lastItem !== undefined && users.some((u) => u.id > lastItem.id);
    const next_cursor = hasMore ? encodeCursor(lastItem.id) : null;

    return res.json({ data: slice, next_cursor });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /users
 * Body: { name, email }
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required' });
    }
    const user = { id: nextId++, name, email };
    users.push(user);
    return res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.resetUsers = resetUsers;
