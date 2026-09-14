// A whisper between the two size stores and whoever keeps them elsewhere.
//
// saved.ts and pinned.ts write localStorage and know nothing about accounts.
// The sync client wants to hear about every write without either store
// importing it, and it needs to write both stores back without hearing
// itself. So: a listener list, and a flag for "this write came from sync".

type Listener = (origin: 'local' | 'remote') => void;

const listeners = new Set<Listener>();

/** Hear about every change to saved or pinned sizes. Returns the unsubscribe. */
export function onSizesWritten(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Called by the stores after a write lands. */
export function notifySizesWritten(origin: 'local' | 'remote' = 'local'): void {
  for (const listener of listeners) listener(origin);
}
