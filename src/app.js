const express = require('express');
const { authMiddleware } = require('./middleware/auth');
const { rateLimitMiddleware } = require('./middleware/rateLimit');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const apiRoutes = require('./routes/api');

function createApp() {
  const app = express();

  app.use(express.json());

  // Health check (no auth, no rate limiting)
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Auth then rate limiting for all API routes
  app.use('/api', authMiddleware);
  app.use('/api', rateLimitMiddleware);

  // API routes
  app.use('/api', apiRoutes);

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
