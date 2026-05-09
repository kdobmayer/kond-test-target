const express = require('express');
const { log } = require('./src/logger');

const app = express();

app.use(express.json());
app.use((req, _res, next) => {
  log(`${req.method} ${req.url}`);
  next();
});

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/ping', (_req, res) => {
  res.json({ message: 'pong' });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = app;
