/**
 * Notifies that the browser copy of commercial data changed (SCRUM-114). Storage modules call
 * `emitLocalWrite`; the Supabase sync subscribes with `onLocalWrite`. Kept separate so storage
 * modules do not import the sync module.
 */
type Listener = () => void;
const listeners = new Set<Listener>();

export function onLocalWrite(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitLocalWrite(): void {
  for (const listener of listeners) listener();
}
