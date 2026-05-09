const express = require('express');
const logger = require('./src/logger');

const app = express();

app.use(express.json());

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error(err.message || 'Internal Server Error');
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = app;
