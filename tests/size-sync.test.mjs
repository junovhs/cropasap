import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeSizeStates, readSizeState, sameSizeState } from '../dist/src/size-sync.js';

const saved = (name, w, h, id = `saved-${w}x${h}`) => ({ id, name, w, h });
const pin = (name, w, h) => ({ id: `${w}x${h}`, name, w, h });
const state = (s = [], p = []) => ({ schemaVersion: 1, saved: s, pinned: p });

test('merging is a union by pixels: nothing kept on either side is lost', () => {
  const local = state([saved('Hero', 1600, 600)], [pin('Hero', 1600, 600)]);
  const remote = state([saved('OG', 1200, 630)], [pin('OG', 1200, 630), pin('Story', 1080, 1920)]);
  const merged = mergeSizeStates(local, remote);
  assert.deepEqual(merged.saved.map((s) => s.name), ['OG', 'Hero']);
  assert.deepEqual(merged.pinned.map((p) => p.id), ['1200x630', '1080x1920', '1600x600']);
});

test('the same rectangle on both sides is one size, and the local name wins', () => {
  const local = state([saved('Banner', 1600, 600, 'saved-local')], [pin('Banner', 1600, 600)]);
  const remote = state([saved('Hero', 1600, 600, 'saved-remote')], [pin('Hero', 1600, 600)]);
  const merged = mergeSizeStates(local, remote);
  assert.equal(merged.saved.length, 1);
  assert.deepEqual(merged.saved[0], { id: 'saved-remote', name: 'Banner', w: 1600, h: 600 });
  assert.deepEqual(merged.pinned, [{ id: '1600x600', name: 'Banner', w: 1600, h: 600 }]);
});

test('pins stay capped at the top bar limit, remote first', () => {
  const remote = state([], Array.from({ length: 8 }, (_, i) => pin(`r${i}`, 100 + i, 100)));
  const local = state([], [pin('extra', 999, 999)]);
  const merged = mergeSizeStates(local, remote);
  assert.equal(merged.pinned.length, 8);
  assert.equal(merged.pinned.some((p) => p.id === '999x999'), false);
});

test('a malformed account row reads as empty and never crashes the app', () => {
  assert.deepEqual(readSizeState(null), state());
  assert.deepEqual(readSizeState('nope'), state());
  assert.deepEqual(readSizeState({ schemaVersion: 2, saved: [saved('x', 1, 1)] }), state());
  const read = readSizeState({ schemaVersion: 1, saved: [saved('ok', 10.4, 20.6), { name: 'no id', w: 1, h: 1 }, saved('neg', -1, 5)], pinned: [{ id: 'wrong', name: 'p', w: 30, h: 40 }] });
  assert.deepEqual(read.saved, [saved('ok', 10, 21, 'saved-10.4x20.6')]);
  assert.deepEqual(read.pinned, [{ id: '30x40', name: 'p', w: 30, h: 40 }]);
});

test('sameSizeState compares by value', () => {
  assert.equal(sameSizeState(state([saved('a', 1, 2)]), state([saved('a', 1, 2)])), true);
  assert.equal(sameSizeState(state([saved('a', 1, 2)]), state([saved('b', 1, 2)])), false);
});
