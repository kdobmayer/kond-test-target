const express = require('express');
const usersRouter = require('./routes/users');

const app = express();

app.use(express.json());

app.use('/users', usersRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = app;
