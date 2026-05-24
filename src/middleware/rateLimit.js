const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 100;

// Map<apiKey, number[]> — timestamps of requests within the sliding window
const requestLog = new Map();

function rateLimitMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const prev = requestLog.get(apiKey) || [];
  const inWindow = prev.filter(t => t > windowStart);

  if (inWindow.length >= MAX_REQUESTS) {
    const resetAt = Math.ceil((inWindow[0] + WINDOW_MS) / 1000);
    const retryAfter = Math.max(1, Math.ceil((inWindow[0] + WINDOW_MS - now) / 1000));
    res.set('X-RateLimit-Limit', String(MAX_REQUESTS));
    res.set('X-RateLimit-Remaining', '0');
    res.set('X-RateLimit-Reset', String(resetAt));
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`
    });
  }

  inWindow.push(now);
  requestLog.set(apiKey, inWindow);

  const resetAt = Math.ceil((inWindow[0] + WINDOW_MS) / 1000);
  res.set('X-RateLimit-Limit', String(MAX_REQUESTS));
  res.set('X-RateLimit-Remaining', String(MAX_REQUESTS - inWindow.length));
  res.set('X-RateLimit-Reset', String(resetAt));

  next();
}

function resetRateLimitStore() {
  requestLog.clear();
}

module.exports = { rateLimitMiddleware, resetRateLimitStore };
