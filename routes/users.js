const express = require('express');
const { logger } = require('../src/logger');

const router = express.Router();

/** @type {Array<{id: number, name: string, email: string}>} */
let users = [];
let nextId = 1;

function resetUsers() {
  users = [];
  nextId = 1;
}

router.get('/', (req, res) => {
  res.json(users);
});

router.post('/', (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
  }
  const user = { id: nextId++, name, email };
  users.push(user);
  logger.info(`Created user ${user.id}`);
  res.status(201).json(user);
});

router.get('/:id', (req, res, next) => {
  try {
    const user = users.find(u => u.id === parseInt(req.params.id, 10));
    if (!user) {
      throw Object.assign(new Error('User not found'), { status: 404 });
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', (req, res, next) => {
  try {
    const idx = users.findIndex(u => u.id === parseInt(req.params.id, 10));
    if (idx === -1) {
      throw Object.assign(new Error('User not found'), { status: 404 });
    }
    const { name, email } = req.body;
    if (name) users[idx].name = name;
    if (email) users[idx].email = email;
    logger.info(`Updated user ${users[idx].id}`);
    res.json(users[idx]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const idx = users.findIndex(u => u.id === parseInt(req.params.id, 10));
    if (idx === -1) {
      throw Object.assign(new Error('User not found'), { status: 404 });
    }
    users.splice(idx, 1);
    logger.info(`Deleted user ${req.params.id}`);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.resetUsers = resetUsers;
