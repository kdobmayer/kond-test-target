'use strict';

const express = require('express');
const usersRouter = require('./routes/users');

const app = express();

app.use(express.json());

app.use('/', usersRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal Server Error' });
});

module.exports = app;
