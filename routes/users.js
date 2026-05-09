'use strict';

const { Router } = require('express');
const { trace, context, propagation } = require('@opentelemetry/api');

const tracer = trace.getTracer('users-router', '1.0.0');
const router = Router();

const DEFAULT_USERS = [{ id: 1, name: 'Alice' }];
let users = [...DEFAULT_USERS];
let nextId = 2;

/**
 * Reset user store to initial state.
 * Called in beforeEach hooks to ensure test isolation.
 */
function resetUsers() {
  users = [...DEFAULT_USERS];
  nextId = 2;
}

function injectTraceparent(res) {
  const carrier = {};
  propagation.inject(context.active(), carrier);
  if (carrier.traceparent) res.setHeader('traceparent', carrier.traceparent);
  if (carrier.tracestate) res.setHeader('tracestate', carrier.tracestate);
}

/** GET /users — list all users */
router.get('/users', (req, res, next) => {
  tracer.startActiveSpan('HTTP GET /users', (span) => {
    try {
      injectTraceparent(res);
      res.json(users);
    } catch (err) {
      span.recordException(err);
      next(err);
    } finally {
      span.end();
    }
  });
});

/** POST /users — create a user */
router.post('/users', (req, res, next) => {
  tracer.startActiveSpan('HTTP POST /users', (span) => {
    try {
      injectTraceparent(res);
      const { name } = req.body;
      if (!name) {
        throw Object.assign(new Error('name is required'), { status: 400 });
      }
      const user = { id: nextId++, name };
      users.push(user);
      res.status(201).json(user);
    } catch (err) {
      span.recordException(err);
      next(err);
    } finally {
      span.end();
    }
  });
});

/** GET /users/:id — get a user by id */
router.get('/users/:id', (req, res, next) => {
  tracer.startActiveSpan('HTTP GET /users/:id', (span) => {
    try {
      injectTraceparent(res);
      const user = users.find((u) => u.id === Number(req.params.id));
      if (!user) {
        throw Object.assign(new Error('User not found'), { status: 404 });
      }
      res.json(user);
    } catch (err) {
      span.recordException(err);
      next(err);
    } finally {
      span.end();
    }
  });
});

/** PUT /users/:id — replace a user's name */
router.put('/users/:id', (req, res, next) => {
  tracer.startActiveSpan('HTTP PUT /users/:id', (span) => {
    try {
      injectTraceparent(res);
      const idx = users.findIndex((u) => u.id === Number(req.params.id));
      if (idx === -1) {
        throw Object.assign(new Error('User not found'), { status: 404 });
      }
      const { name } = req.body;
      if (!name) {
        throw Object.assign(new Error('name is required'), { status: 400 });
      }
      users[idx] = { ...users[idx], name };
      res.json(users[idx]);
    } catch (err) {
      span.recordException(err);
      next(err);
    } finally {
      span.end();
    }
  });
});

/** DELETE /users/:id — remove a user */
router.delete('/users/:id', (req, res, next) => {
  tracer.startActiveSpan('HTTP DELETE /users/:id', (span) => {
    try {
      injectTraceparent(res);
      const idx = users.findIndex((u) => u.id === Number(req.params.id));
      if (idx === -1) {
        throw Object.assign(new Error('User not found'), { status: 404 });
      }
      users.splice(idx, 1);
      res.status(204).send();
    } catch (err) {
      span.recordException(err);
      next(err);
    } finally {
      span.end();
    }
  });
});

module.exports = router;
module.exports.resetUsers = resetUsers;
