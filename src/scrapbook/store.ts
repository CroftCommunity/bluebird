import type { Clip } from './clip.js';

/**
 * IndexedDB-backed Scrapbook store (D4). Local only — survives offline, lost if
 * the PWA is deleted (the UI says so; anti-decoy stance). All methods degrade
 * gracefully to empty/no-op if IndexedDB is unavailable, so nothing here can
 * throw into the child's UI.
 */

const DB_NAME = 'skylite-scrapbook';
const STORE = 'clips';
const VERSION = 1;

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let idb: IDBFactory | undefined;
    try {
      idb = globalThis.indexedDB;
    } catch {
      idb = undefined;
    }
    if (!idb) {
      resolve(null);
      return;
    }
    const req = idb.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'uri' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        const store = db.transaction(STORE, mode).objectStore(STORE);
        const req = run(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      }),
  );
}

export async function saveClip(clip: Clip): Promise<void> {
  await tx('readwrite', (s) => s.put(clip));
}

export async function removeClip(uri: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(uri));
}

export async function getClip(uri: string): Promise<Clip | null> {
  return (await tx<Clip>('readonly', (s) => s.get(uri) as IDBRequest<Clip>)) ?? null;
}

export async function listClips(): Promise<Clip[]> {
  const all = await tx<Clip[]>('readonly', (s) => s.getAll() as IDBRequest<Clip[]>);
  return (all ?? []).sort((a, b) => b.savedAt - a.savedAt);
}

export async function savedUris(): Promise<Set<string>> {
  const clips = await listClips();
  return new Set(clips.map((c) => c.uri));
}
