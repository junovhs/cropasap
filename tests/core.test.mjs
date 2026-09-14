import test from 'node:test';
import assert from 'node:assert/strict';

import { acceptFrame, targetKey, useWholeImage } from '../dist/src/application/framing.js';
import { expandName, unique } from '../dist/src/export.js';
import { ratioLabel, search, wholeImageInside } from '../dist/src/search.js';
import { createAppStore } from '../dist/src/state.js';
import {
  encodedImageDimensions,
  previewDimensions,
} from '../dist/src/infrastructure/image-decoder.js';
import { makeZip } from '../dist/src/zip.js';

const adjustment = Object.freeze({ exposure: 0, contrast: 0, saturation: 0 });

test('huge editing previews preserve aspect while bounding decoded pixels', () => {
  assert.deepEqual(previewDimensions(30_000, 8_209), { width: 4_096, height: 1_121 });
  assert.deepEqual(previewDimensions(30_000, 8_209, 1_024), { width: 1_024, height: 280 });
  assert.deepEqual(previewDimensions(2_000, 1_000), { width: 2_000, height: 1_000 });
});

test('large JPEG and PNG dimensions are read without decoding pixels', () => {
  const jpeg = new Uint8Array(15);
  jpeg.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x20, 0x11, 0x75, 0x30]);
  assert.deepEqual(encodedImageDimensions(jpeg), { width: 30_000, height: 8_209 });

  const png = new Uint8Array(24);
  png.set([137, 80, 78, 71, 13, 10, 26, 10]);
  new DataView(png.buffer).setUint32(16, 30_000);
  new DataView(png.buffer).setUint32(20, 8_209);
  assert.deepEqual(encodedImageDimensions(png), { width: 30_000, height: 8_209 });
});

function fakeItem(overrides = {}) {
  return {
    id: 'item-1',
    file: { name: 'photo.jpg' },
    image: { naturalWidth: 2400, naturalHeight: 1600 },
    name: 'photo',
    frame: { cx: 1200, cy: 800, cropW: 1600, cropH: 1600 },
    adjust: adjustment,
    approved: false,
    auto: true,
    framedFor: '1080x1080',
    ...overrides,
  };
}

test('filename expansion sanitizes output and preserves known tokens', () => {
  const name = expandName('{name}-{size}-{n}', {
    name: 'Summer / Launch',
    index: 1,
    total: 12,
    w: 1200,
    h: 630,
    ext: 'png',
    label: 'Social',
  });
  assert.equal(name, 'Summer-Launch-1200x630-02.png');
});

test('size search accepts semantic names and exact dimensions', () => {
  const semantic = search('instagram story');
  assert.ok(semantic.some((result) => result.w === 1080 && result.h === 1920));

  const exact = search('1200 x 630');
  assert.ok(exact.some((result) => result.kind === 'custom' && result.w === 1200 && result.h === 630));
  assert.equal(ratioLabel(1920, 1080), '16:9');
  assert.deepEqual(wholeImageInside({ w: 2000, h: 1000 }, { w: 800, h: 800 }), { w: 800, h: 400 });
});

test('with nothing typed, pinned sizes lead the list and are not repeated below', () => {
  const pins = [{ id: '1640x624', name: 'Page cover', w: 1640, h: 624 }, { id: '300x400', name: 'Badge', w: 300, h: 400 }];
  const saved = [{ id: 's1', name: 'Badge copy', w: 300, h: 400 }, { id: 's2', name: 'Hero', w: 2400, h: 900 }];
  const rows = search('', ['fb-cover'], saved, null, pins);
  assert.deepEqual(rows.slice(0, 2).map((row) => [row.section, row.name]), [['Pinned', 'Page cover'], ['Pinned', 'Badge']]);
  assert.equal(rows.filter((row) => row.w === 300 && row.h === 400).length, 1);
  assert.equal(rows.filter((row) => row.w === 1640 && row.h === 624).length, 1);
  assert.ok(rows.some((row) => row.section === 'Saved' && row.name === 'Hero'));
  assert.equal(search('', [], saved, null, []).some((row) => row.section === 'Pinned'), false);
});

test('framing commands are immutable and explicit', () => {
  const source = fakeItem();
  const accepted = acceptFrame(source);
  assert.notEqual(accepted, source);
  assert.equal(accepted.approved, true);
  assert.equal(accepted.auto, false);
  assert.equal(source.approved, false);

  const whole = useWholeImage(source, { w: 2400, h: 1600, label: 'Original' });
  assert.deepEqual(whole.frame, { cx: 1200, cy: 800, cropW: 2400, cropH: 1600 });
  assert.equal(whole.framedFor, '2400x1600');
  assert.equal(targetKey({ w: 1200, h: 630, label: 'Card' }), '1200x630');
});

test('store publishes one frozen state per atomic change', () => {
  const item = fakeItem();
  const store = createAppStore({
    target: { w: 1080, h: 1080, label: 'Square' },
    items: [item],
    activeIndex: 0,
    batch: false,
  });

  let calls = 0;
  const unsubscribe = store.subscribe(() => { calls += 1; });
  assert.equal(calls, 1);

  store.updateItem('item-1', (current) => current);
  assert.equal(calls, 1, 'a no-op update must not publish');

  store.updateItem('item-1', (current) => ({ ...current, approved: true }));
  assert.equal(calls, 2);
  assert.equal(store.get().items[0].approved, true);
  assert.ok(Object.isFrozen(store.get()));
  assert.ok(Object.isFrozen(store.get().items[0]));
  assert.ok(Object.isFrozen(store.get().items[0].adjust));
  assert.ok(Object.isFrozen(store.get().items[0].frame));
  unsubscribe();
});

test('a size saved twice is one size with the newer name', async () => {
  // localStorage is the store; a minimal stand-in is enough to exercise the rule.
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  };
  const { addSaved } = await import('../dist/src/saved.js');

  const first = addSaved('Hero', 300, 400);
  assert.equal(first.length, 1);

  const again = addSaved('Hero banner', 300, 400);
  assert.equal(again.length, 1, 'the same pixels do not make a second row');
  assert.equal(again[0].name, 'Hero banner', 'the name just given wins');
  assert.equal(again[0].id, first[0].id, 'and it is the same saved size');

  assert.equal(addSaved('Tall', 300, 401).length, 2, 'different pixels, different size');
  // Rounded first, so 300.4 is the same size as 300.
  assert.equal(addSaved('Same', 300.4, 400).length, 2);
});

test('ZIP writer emits a valid empty-free archive envelope', async () => {
  const zip = await makeZip([
    { name: 'a.txt', blob: new Blob(['alpha'], { type: 'text/plain' }) },
    { name: 'b.txt', blob: new Blob(['beta'], { type: 'text/plain' }) },
  ]);
  const bytes = new Uint8Array(await zip.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
  assert.equal(zip.type, 'application/zip');
});


test('destination search understands a plain-language banner request', () => {
  for (const query of ['I need this image as a Facebook header banner', 'please resize this for a youtube thumbnail']) {
    const short = query.includes('Facebook') ? 'facebook header banner' : 'youtube thumbnail';
    assert.equal(search(query)[0]?.id, search(short)[0]?.id);
    assert.ok(search(query).length > 0);
  }
});

test('explicit tiny pixel sizes remain exact while unqualified small pairs remain ratios', () => {
  for (const query of ['32 x 32 pixels', 'resize to 32px x 32px', '1 by 1 pixel', '16 × 9 px']) {
    const result = search(query).find((row) => row.kind === 'custom');
    const [w, h] = query.match(/\d+/g).map(Number);
    assert.equal(result?.w, w, query);
    assert.equal(result?.h, h, query);
  }
  assert.equal(search('4x5')[0]?.w / search('4x5')[0]?.h, 4 / 5);
  assert.equal(search('16:9')[0]?.w / search('16:9')[0]?.h, 16 / 9);
});

test('decimal ratios keep both fractional components and reject partial invalid numbers', () => {
  for (const [query, ratio] of [['1.91:1', 1.91], ['2.39:1', 2.39], ['0.5:1', 0.5], ['3:1.5', 2], ['1.91x1', 1.91]]) {
    const result = search(query)[0];
    assert.ok(result, query);
    assert.ok(Math.abs(result.w / result.h - ratio) < 0.003, query);
  }
  for (const query of ['0:1', '1:0', '32768x32768', '99999', '123456 x 789012']) {
    assert.equal(search(query).filter((row) => row.kind === 'custom').length, 0, query);
  }
});


test('ZIP output names never collide with original or generated suffixes', () => {
  assert.deepEqual(unique(['a.png', 'a-2.png', 'a.png']), ['a.png', 'a-2.png', 'a-3.png']);
  assert.deepEqual(unique(['a.png', 'a.png', 'a-2.png']), ['a.png', 'a-3.png', 'a-2.png']);
  assert.deepEqual(unique(['photo', 'photo']), ['photo', 'photo-2']);
  assert.deepEqual(unique(['A.PNG', 'a.png']), ['A.PNG', 'a-2.png']);
  const originals = ['summer.png', 'winter.jpg', 'spring.webp'];
  assert.deepEqual(unique(originals), originals);
  const tricky = ['a.png', ...Array.from({ length: 80 }, (_, i) => `a-${i + 2}.png`), ...Array(100).fill('a.png'), 'A-2.PNG'];
  const output = unique(tricky);
  assert.equal(new Set(output.map((name) => name.toLowerCase())).size, tricky.length);
});
