// Saved and pinned sizes, kept with the account.
//
// The account exists so the sizes you keep are there on the next machine
// (DEC-05). The rules are few:
//
//   - Local storage stays the store the app reads. Sync copies into and out of
//     it; nothing else in the app knows an account exists.
//   - The first time an account is used on a device, what was already here is
//     merged in, so signing in never loses a size you saved as a guest.
//   - After that, the account's copy is the truth: signing in adopts it, a
//     local write pushes it, and a push that lost a race pulls, merges and
//     pushes again.
//   - Signing out puts the guest's own sizes back, so the next person at this
//     keyboard does not inherit yours.
//   - Every failure is a note on the account card, never a broken app.

import type { Session } from '@supabase/supabase-js';
import type { PinnedSize, SavedSize } from './domain/types.js';
import { loadSaved, replaceSaved } from './saved.js';
import { loadPinned, pinId, replacePinned } from './pinned.js';
import { onSizesWritten } from './size-store-events.js';
import type { Client } from './supabase.js';

export interface SizeState {
  schemaVersion: 1;
  saved: SavedSize[];
  pinned: PinnedSize[];
}

export type SyncStatus =
  | { kind: 'off' }
  | { kind: 'syncing' }
  | { kind: 'synced'; count: number }
  | { kind: 'unavailable'; reason: 'not-installed' | 'offline' | 'error' };

const TABLE = 'cropasap_sizes';
const SAVE_RPC = 'cropasap_save_sizes';
const GUEST_KEY = 'cropasap.sync.guest';
const SEEN_KEY = (userId: string): string => `cropasap.sync.${userId}`;
const MAX_PINS = 8;

const sizeKey = (size: { w: number; h: number }): string => pinId(size.w, size.h);

const isSize = (value: unknown): value is { id: string; name: string; w: number; h: number } => {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return typeof s.id === 'string' && typeof s.name === 'string'
    && typeof s.w === 'number' && typeof s.h === 'number' && s.w > 0 && s.h > 0;
};

/** What the account holds, read defensively: anything malformed reads as empty. */
export function readSizeState(value: unknown): SizeState {
  const empty: SizeState = { schemaVersion: 1, saved: [], pinned: [] };
  if (!value || typeof value !== 'object') return empty;
  const candidate = value as Partial<SizeState>;
  if (candidate.schemaVersion !== 1) return empty;
  return {
    schemaVersion: 1,
    saved: Array.isArray(candidate.saved) ? candidate.saved.filter(isSize).map((s) => ({ ...s, w: Math.round(s.w), h: Math.round(s.h) })) : [],
    pinned: Array.isArray(candidate.pinned)
      ? candidate.pinned.filter(isSize).map((p) => ({ ...p, id: pinId(p.w, p.h), w: Math.round(p.w), h: Math.round(p.h) })).slice(0, MAX_PINS)
      : [],
  };
}

/** The device's current sizes as one state. */
export function localSizeState(): SizeState {
  return { schemaVersion: 1, saved: loadSaved(), pinned: loadPinned() };
}

/**
 * Union of two states by pixels. A size is its pixels, so the same rectangle
 * on both sides is one size; the local name wins because it is the one this
 * person typed most recently on the keyboard in front of them. Remote order
 * first, local extras after, pins capped as the top bar caps them.
 */
export function mergeSizeStates(local: SizeState, remote: SizeState): SizeState {
  const saved = new Map<string, SavedSize>();
  for (const size of remote.saved) saved.set(sizeKey(size), size);
  for (const size of local.saved) {
    const key = sizeKey(size);
    const existing = saved.get(key);
    saved.set(key, existing ? { ...existing, name: size.name } : size);
  }
  const pinned = new Map<string, PinnedSize>();
  for (const pin of remote.pinned) pinned.set(sizeKey(pin), pin);
  for (const pin of local.pinned) {
    const key = sizeKey(pin);
    const existing = pinned.get(key);
    pinned.set(key, existing ? { ...existing, name: pin.name } : pin);
  }
  return {
    schemaVersion: 1,
    saved: [...saved.values()],
    pinned: [...pinned.values()].slice(0, MAX_PINS),
  };
}

export function sameSizeState(a: SizeState, b: SizeState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const errorCode = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';

/** The table or function is not there: the migration has not been applied. */
const notInstalled = (error: unknown): boolean => {
  const code = errorCode(error);
  // 42P01 undefined_table, 42883 undefined_function, PGRST202 function not in schema cache, PGRST205 table not in schema cache
  return code === '42P01' || code === '42883' || code === 'PGRST202' || code === 'PGRST205';
};

export interface SizeSync {
  /** Tell sync who is signed in; null on sign-out. */
  session(session: Session | null, client: Client): void;
  onStatus(listener: (status: SyncStatus) => void): void;
  status(): SyncStatus;
}

export function createSizeSync(): SizeSync {
  let client: Client | null = null;
  let userId: string | null = null;
  let revision = 0;
  let status: SyncStatus = { kind: 'off' };
  let pushTimer = 0;
  let pushing: Promise<void> | null = null;
  let dirty = false;
  const listeners = new Set<(status: SyncStatus) => void>();

  const setStatus = (next: SyncStatus): void => {
    status = next;
    for (const listener of listeners) listener(next);
  };

  const applyRemote = (state: SizeState): void => {
    const local = localSizeState();
    if (sameSizeState(local, state)) return;
    replaceSaved(state.saved);
    replacePinned(state.pinned);
  };

  const read = (name: string): string | null => {
    try { return localStorage.getItem(name); } catch { return null; }
  };
  const store = (name: string, value: string | null): void => {
    try {
      if (value === null) localStorage.removeItem(name);
      else localStorage.setItem(name, value);
    } catch { /* private mode: sync still works for this session */ }
  };

  /** The account's row, or null when the account has none yet. */
  const pull = async (): Promise<{ state: SizeState; revision: number } | null> => {
    if (!client || !userId) return null;
    const { data, error } = await client.from(TABLE).select('state, revision').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { state: readSizeState(data.state), revision: Number(data.revision) || 0 };
  };

  const push = async (state: SizeState): Promise<void> => {
    if (!client) return;
    const { data, error } = await client.rpc(SAVE_RPC, { expected_revision: revision, next_state: state });
    if (error) throw error;
    revision = Number((data as { revision?: unknown } | null)?.revision) || revision + 1;
  };

  /** Push what is local; on a lost race, take the account's copy in, merge, and push that. */
  const flush = async (): Promise<void> => {
    if (!client || !userId) return;
    if (pushing) { dirty = true; return; }
    dirty = false;
    setStatus({ kind: 'syncing' });
    pushing = (async () => {
      try {
        let state = localSizeState();
        try {
          await push(state);
        } catch (error) {
          if (errorCode(error) !== 'PT409') throw error;
          const remote = await pull();
          if (remote) {
            revision = remote.revision;
            state = mergeSizeStates(state, remote.state);
            applyRemote(state);
          }
          await push(state);
        }
        setStatus({ kind: 'synced', count: state.saved.length + state.pinned.length });
      } catch (error) {
        dirty = true;
        setStatus({ kind: 'unavailable', reason: notInstalled(error) ? 'not-installed' : navigator.onLine ? 'error' : 'offline' });
      } finally {
        pushing = null;
        if (dirty && status.kind !== 'unavailable') void flush();
      }
    })();
    await pushing;
  };

  const schedulePush = (): void => {
    if (!userId) return;
    clearTimeout(pushTimer);
    pushTimer = window.setTimeout(() => void flush(), 400);
  };

  /** Sign-in: bring the account's sizes here, merging on first use of this device. */
  const activate = async (id: string): Promise<void> => {
    userId = id;
    revision = 0;
    setStatus({ kind: 'syncing' });
    const firstTimeHere = read(SEEN_KEY(id)) === null;
    // What the guest had, kept aside for sign-out. Once per sign-in.
    if (read(GUEST_KEY) === null) store(GUEST_KEY, JSON.stringify(localSizeState()));
    try {
      const remote = await pull();
      if (remote) revision = remote.revision;
      const local = localSizeState();
      const merged = firstTimeHere || !remote ? mergeSizeStates(local, remote?.state ?? readSizeState(null)) : remote.state;
      applyRemote(merged);
      store(SEEN_KEY(id), '1');
      if (!remote || !sameSizeState(merged, remote.state)) await push(merged);
      setStatus({ kind: 'synced', count: merged.saved.length + merged.pinned.length });
    } catch (error) {
      setStatus({ kind: 'unavailable', reason: notInstalled(error) ? 'not-installed' : navigator.onLine ? 'error' : 'offline' });
    }
  };

  /** Sign-out: the guest's own sizes come back. */
  const deactivate = (): void => {
    userId = null;
    revision = 0;
    clearTimeout(pushTimer);
    const guest = read(GUEST_KEY);
    if (guest !== null) {
      try { applyRemote(readSizeState(JSON.parse(guest))); } catch { /* keep what is here */ }
      store(GUEST_KEY, null);
    }
    setStatus({ kind: 'off' });
  };

  onSizesWritten((origin) => { if (origin === 'local') schedulePush(); });
  window.addEventListener('online', () => { if (userId && status.kind === 'unavailable' && status.reason === 'offline') void flush(); });

  return {
    session(session, loaded) {
      client = loaded;
      const next = session?.user.id ?? null;
      if (next === userId) return;
      if (next) void activate(next);
      else deactivate();
    },
    onStatus(listener) { listeners.add(listener); listener(status); },
    status: () => status,
  };
}
