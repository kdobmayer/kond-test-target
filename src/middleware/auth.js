const { getDb } = require('../db');

function authMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Missing x-api-key header'
    });
  }

  const db = getDb();
  const key = db.prepare('SELECT * FROM api_keys WHERE key = ? AND active = 1').get(apiKey);

  if (!key) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or inactive API key'
    });
  }

  req.apiKeyName = key.name;
  next();
}

function optionalAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    const db = getDb();
    const key = db.prepare('SELECT * FROM api_keys WHERE key = ? AND active = 1').get(apiKey);
    if (key) {
      req.apiKeyName = key.name;
    }
  }
  next();
}

module.exports = { authMiddleware, optionalAuth };
