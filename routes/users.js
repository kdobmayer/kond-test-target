const express = require('express');

const router = express.Router();

let users = [];

/**
 * Reset in-memory users store (used in tests).
 */
function resetUsers() {
  users = [];
}

router.get('/', (req, res) => {
  res.json(users);
});

module.exports = router;
module.exports.resetUsers = resetUsers;
