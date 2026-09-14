import { test } from 'node:test';
import assert from 'node:assert/strict';

// Placeholder so `npm test` has something to run before Phase 1 extracts
// pure modules (math, chunk, generator, physics) into src/.
test('test runner works', () => {
  assert.equal(1 + 1, 2);
});
