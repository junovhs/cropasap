import test from 'node:test';
import assert from 'node:assert/strict';

import { store } from '../dist/src/state.js';
import { createHistory, sameEdit } from '../dist/src/history.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cx = () => store.get().items[0].frame.cx;
const item = (id) => ({
  id, file: {}, image: {}, name: `${id}.jpg`, approved: false, auto: false, framedFor: null,
  frame: { cx: 500, cy: 500, cropW: 400, cropH: 400 },
  adjust: { exposure: 0 },
});
const fresh = () => store.set({ items: [item('a')], activeIndex: 0, batch: false, cropMode: 'preset' });
const moveBy = (dx) => store.updateItem('a', (it) => ({ ...it, frame: { ...it.frame, cx: it.frame.cx + dx } }));

test('every distinct edit is one undo step, in order, and redo walks them forward', async () => {
  fresh();
  const history = createHistory({ settleMs: 5, onChange() {}, onRestore() {} });
  for (let i = 0; i < 5; i += 1) { moveBy(10); await wait(15); }
  assert.equal(cx(), 550);
  for (const expected of [540, 530, 520, 510, 500]) {
    assert.ok(history.undo());
    assert.equal(cx(), expected);
  }
  assert.equal(history.undo(), false);
  for (const expected of [510, 520, 530, 540, 550]) {
    assert.ok(history.redo());
    assert.equal(cx(), expected);
  }
  assert.equal(history.redo(), false);
});

test('the viewfinder echo after a restore is not a step, but a real edit right after an undo is', async () => {
  fresh();
  const history = createHistory({ settleMs: 5, onChange() {}, onRestore() {} });
  moveBy(10); await wait(15);
  moveBy(10); await wait(15);
  assert.ok(history.undo());
  assert.equal(cx(), 510);
  // The restore lands, and the springs republish the same crop — as close as
  // the store's own dead-band lets it get.
  moveBy(0.009); await wait(15);
  assert.ok(history.canRedo(), 'an echo must not throw the redo stack away');
  assert.ok(history.redo());
  assert.equal(cx(), 520);
  assert.ok(history.undo());
  // Now a deliberate edit immediately after the undo, inside the settle window.
  moveBy(-100); await wait(15);
  assert.equal(history.canRedo(), false, 'a fresh edit is a new branch');
  assert.ok(history.undo());
  assert.ok(Math.abs(cx() - 510) < 0.02, 'the edit made straight after an undo is its own step');
});

test('sameEdit tolerates float noise and nothing more', () => {
  fresh();
  const a = store.get();
  const b = store.updateItem('a', (it) => ({ ...it, frame: { ...it.frame, cx: it.frame.cx + 0.009, cy: it.frame.cy - 0.009 } }));
  assert.ok(sameEdit(a, b));
  const nudge = store.updateItem('a', (it) => ({ ...it, frame: { ...it.frame, cx: it.frame.cx + 0.25 } }));
  assert.equal(sameEdit(a, nudge), false, 'one screen pixel at 4x is a real edit');
  const c = store.updateItem('a', (it) => ({ ...it, frame: { ...it.frame, cx: it.frame.cx + 1 } }));
  assert.equal(sameEdit(a, c), false);
  const d = store.updateItem('a', (it) => ({ ...it, adjust: { exposure: 0.2 } }));
  assert.equal(sameEdit(a, d), false);
});
