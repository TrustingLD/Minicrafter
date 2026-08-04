import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand } from '../src/core/commands.js';
import { COMMANDS } from '../src/data/commands.js';

test('parseCommand: plain chat text (no leading slash) is not a command', () => {
  assert.equal(parseCommand('hello there', COMMANDS), null);
  assert.equal(parseCommand('', COMMANDS), null);
});

test('parseCommand: splits a valid command into name + args', () => {
  assert.deepEqual(parseCommand('/give stone 64', COMMANDS), {
    name: 'give',
    args: ['stone', '64'],
  });
});

test('parseCommand: collapses repeated whitespace between arguments', () => {
  assert.deepEqual(parseCommand('/tp   1   2   3', COMMANDS), {
    name: 'tp',
    args: ['1', '2', '3'],
  });
});

test('parseCommand: an optional trailing arg may be omitted', () => {
  assert.deepEqual(parseCommand('/give stone', COMMANDS), { name: 'give', args: ['stone'] });
});

test('parseCommand: a zero-arg command needs no arguments', () => {
  assert.deepEqual(parseCommand('/heal', COMMANDS), { name: 'heal', args: [] });
  assert.deepEqual(parseCommand('/fly', COMMANDS), { name: 'fly', args: [] });
});

test('parseCommand: unknown command name returns an error, not a throw', () => {
  const result = parseCommand('/xyzzy', COMMANDS);
  assert.ok(result.error);
  assert.match(result.error, /inconnue/);
});

test('parseCommand: too few required arguments returns a usage error', () => {
  const result = parseCommand('/tp 1 2', COMMANDS);
  assert.ok(result.error);
  assert.match(result.error, /Usage/);
});

test('parseCommand: too many arguments (beyond the optional ones) returns a usage error', () => {
  const result = parseCommand('/give stone 64 extra', COMMANDS);
  assert.ok(result.error);
  assert.match(result.error, /Usage/);
});

test('parseCommand: a bare slash with nothing after it is an error, not a crash', () => {
  const result = parseCommand('/', COMMANDS);
  assert.ok(result.error);
});
