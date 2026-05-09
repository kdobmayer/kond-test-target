const { Router } = require('express');

const router = Router();

/**
 * GET /health
 * Returns service health status.
 */
router.get('/', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

module.exports = router;
