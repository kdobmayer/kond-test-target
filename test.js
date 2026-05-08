const { add, subtract, power } = require('./index');

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

assert(power(2, 10) === 1024, 'power(2,10) should be 1024');
assert(power(3, 3) === 27, 'power(3,3) should be 27');
assert(power(5, 0) === 1, 'power(5,0) should be 1');
assert(power(2, -1) === 0.5, 'power(2,-1) should be 0.5');

console.log(`Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
