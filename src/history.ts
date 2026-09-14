// Undo and redo over whole application states.
//
// The store already publishes one complete, frozen state per atomic change, so
// history is just a stack of the states it went through — no diffing, no
// inverse operations, no second source of truth to drift.
//
// Two things stop that from being unusable. Framing fires on every animation
// frame while a drag is in flight, so entries are only recorded once the state
// has stopped moving: one drag is one undo, not four hundred. And moving
// between queued images is navigation rather than an edit, so a state that
// differs only in `activeIndex` is not worth a step.

import { store } from './state.js';
import type { AppState } from './domain/types.js';

export interface HistoryOptions {
  /** How long the state must hold still before it counts as one edit. */
  readonly settleMs?: number;
  /** How many steps to keep. Old entries fall off the bottom. */
  readonly limit?: number;
  /** Called whenever `canUndo`/`canRedo` may have changed. */
  onChange(): void;
  /** Put a restored state back on screen (viewfinder, panels, filmstrip). */
  onRestore(state: AppState): void;
}

export interface History {
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): boolean;
  redo(): boolean;
  /** Forget everything. Used when the work itself is replaced. */
  reset(): void;
}

/** Everything that makes a state an *edit* rather than a change of selection. */
function isEdit(a: AppState, b: AppState): boolean {
  return a.items !== b.items || a.target !== b.target || a.batch !== b.batch
    || a.cropMode !== b.cropMode;
}

// A restored state comes back through the viewfinder, which republishes the
// framing it lands on — the same crop, give or take what the store keeps: it
// ignores frame changes under a hundredth of a source pixel, so the last echo
// can trail the true landing by that much in each number. Half a tenth covers
// that with room to spare and is still far inside anything a person could do
// on purpose — one screen pixel at the deepest zoom is a quarter of a source
// pixel.
const ECHO = 0.05;
const near = (a: number, b: number): boolean => Math.abs(a - b) <= ECHO;

/** True when `b` is `a` as the viewfinder would republish it. */
export function sameEdit(a: AppState, b: AppState): boolean {
  if (a.batch !== b.batch || a.cropMode !== b.cropMode) return false;
  if (a.target.w !== b.target.w || a.target.h !== b.target.h) return false;
  if (a.items.length !== b.items.length) return false;
  return a.items.every((item, index) => {
    const other = b.items[index];
    if (!other || other.id !== item.id || (other.adjust !== item.adjust && !sameAdjust(item, other))) return false;
    if (item.approved !== other.approved || item.auto !== other.auto) return false;
    if (!item.frame || !other.frame) return item.frame === other.frame;
    return near(item.frame.cx, other.frame.cx) && near(item.frame.cy, other.frame.cy)
      && near(item.frame.cropW, other.frame.cropW) && near(item.frame.cropH, other.frame.cropH);
  });
}

function sameAdjust(a: AppState['items'][number], b: AppState['items'][number]): boolean {
  const keys = new Set([...Object.keys(a.adjust), ...Object.keys(b.adjust)]);
  for (const key of keys) {
    if ((a.adjust as Record<string, unknown>)[key] !== (b.adjust as Record<string, unknown>)[key]) return false;
  }
  return true;
}

export function createHistory(options: HistoryOptions): History {
  const { settleMs = 400, limit = 60, onChange, onRestore } = options;

  const past: AppState[] = [];
  const future: AppState[] = [];
  // The last state we consider committed. Everything before it is in `past`.
  let baseline = store.get();
  let timer: ReturnType<typeof setTimeout> | null = null;
  // Our own writes must not be recorded as new edits, or undo would only ever
  // toggle between the last two states.
  let restoring = false;

  const cancelPending = (): void => {
    if (timer !== null) { clearTimeout(timer); timer = null; }
  };

  const commit = (): void => {
    timer = null;
    const settled = store.get();
    // Putting a state back on screen makes the viewfinder animate into the
    // restored shape, and it republishes the store on the way. Those echoes are
    // the restore finishing rather than a new edit — recorded as one, the first
    // undo would throw the redo stack away. So a settle that lands on the
    // baseline itself, within float noise, is folded in rather than pushed;
    // a real edit made straight after an undo still counts, because it lands
    // somewhere else.
    if (!isEdit(baseline, settled) || sameEdit(baseline, settled)) { baseline = settled; return; }
    past.push(baseline);
    if (past.length > limit) past.shift();
    // A fresh edit is a new branch: whatever had been undone is now unreachable.
    future.length = 0;
    baseline = settled;
    onChange();
  };

  store.subscribe((next) => {
    // subscribe() delivers the current value straight away; that is the
    // baseline, not a change.
    if (restoring || next === baseline) return;
    cancelPending();
    timer = setTimeout(commit, settleMs);
  });

  const travel = (from: AppState[], to: AppState[]): boolean => {
    // A half-finished edit is still the user's most recent intent, so land it
    // before stepping away from it — otherwise the first undo after a drag
    // throws that drag away instead of reversing it.
    if (timer !== null) { cancelPending(); commit(); }
    const target = from.pop();
    if (!target) return false;
    to.push(baseline);
    baseline = target;

    restoring = true;
    try {
      store.transact(() => target);
      onRestore(target);
    } finally {
      restoring = false;
    }

    onChange();
    return true;
  };

  return {
    // A pending settle counts only if it will actually record something.
    canUndo: () => past.length > 0 || (timer !== null && isEdit(baseline, store.get()) && !sameEdit(baseline, store.get())),
    canRedo: () => future.length > 0,
    undo: () => travel(past, future),
    redo: () => travel(future, past),
    reset() {
      cancelPending();
      past.length = 0;
      future.length = 0;
      baseline = store.get();
      onChange();
    },
  };
}
