import test from 'node:test';
import assert from 'node:assert/strict';
import { searchSizeBudget } from '../dist/src/application/size-budget.js';

const blob = (size) => new Blob([new Uint8Array(size)], { type: 'image/jpeg' });

test('size budget returns a measured fit near the highest available quality in bounded work', async () => {
  const qualities = [], progress = [];
  const result = await searchSizeBudget(async (quality) => {
    qualities.push(quality);
    return blob(Math.ceil(1000 + quality * 10000));
  }, 5000, (fraction) => progress.push(fraction));
  assert.equal(result.met, true);
  assert.ok(result.blob.size <= 5000);
  assert.ok(result.quality <= 0.4 && result.quality > 0.39);
  assert.ok(qualities.length <= 10);
  assert.equal(progress.at(-1), 1);
  assert.ok(progress.every((value, i) => i === 0 || value >= progress[i - 1]));
});

test('already-small images keep maximum quality without unnecessary encodes', async () => {
  let passes = 0;
  const result = await searchSizeBudget(async () => { passes++; return blob(200); }, 200);
  assert.equal(result.quality, 1);
  assert.equal(result.met, true);
  assert.equal(passes, 1);
});

test('impossible limits return an explicitly unmet result and measured fallback', async () => {
  const result = await searchSizeBudget(async (quality) => blob(Math.round(1000 + quality * 1000)), 1000);
  assert.equal(result.met, false);
  assert.equal(result.blob.size, 1100);
  assert.equal(result.quality, 0.1);
});

test('invalid limits and encoder failures never masquerade as successful fits', async () => {
  for (const limit of [0, -1, Infinity, NaN, 1.5]) {
    await assert.rejects(searchSizeBudget(async () => blob(10), limit), /positive whole-byte/);
  }
  await assert.rejects(searchSizeBudget(async () => { throw new Error('codec unavailable'); }, 2000), /codec unavailable/);
});
