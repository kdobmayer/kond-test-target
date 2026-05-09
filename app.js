const express = require('express');
const { log, error } = require('./src/logger');
const { version } = require('./package.json');

const app = express();

app.use(express.json());

app.use((req, _res, next) => {
  log(`${req.method} ${req.url}`);
  next();
});

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/version', (_req, res) => {
  res.json({ version });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use((err, _req, res, _next) => {
  error(err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = app;
