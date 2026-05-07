const { add, subtract } = require('./index');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}`); }
}

assert(add(1, 2) === 3, 'add(1,2) should be 3');
assert(add(0, 0) === 0, 'add(0,0) should be 0');
assert(subtract(5, 3) === 2, 'subtract(5,3) should be 2');
assert(subtract(0, 1) === -1, 'subtract(0,1) should be -1');

console.log(`Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
