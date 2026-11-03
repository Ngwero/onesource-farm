/** IndexedDB outbox for field records captured offline. */

const DB_NAME = 'onesource-offline';
const STORE = 'outbox';
const DB_VERSION = 1;

export type OutboxKind = 'activity' | 'incident' | 'attendance' | 'harvest' | 'attachment';

export type OutboxItem = {
  id: string;
  kind: OutboxKind;
  path: string;
  method: 'POST' | 'PATCH';
  body: unknown;
  createdAt: string;
  attempts: number;
  lastError?: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function enqueueOutbox(
  item: Omit<OutboxItem, 'id' | 'createdAt' | 'attempts'>
): Promise<OutboxItem> {
  const row: OutboxItem = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(row);
  await txDone(tx);
  db.close();
  try {
    const reg = await navigator.serviceWorker?.ready;
    // Background Sync is optional; browsers without it rely on online event.
    // @ts-expect-error SyncManager may be missing in TS lib
    await reg?.sync?.register?.('onesource-outbox');
  } catch {
    /* ignore */
  }
  return row;
}

export async function listOutbox(): Promise<OutboxItem[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const req = tx.objectStore(STORE).getAll();
  const rows = await new Promise<OutboxItem[]>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as OutboxItem[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeOutbox(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(id);
  await txDone(tx);
  db.close();
}

export async function updateOutboxError(id: string, lastError: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const getReq = store.get(id);
  const row = await new Promise<OutboxItem | undefined>((resolve, reject) => {
    getReq.onsuccess = () => resolve(getReq.result as OutboxItem | undefined);
    getReq.onerror = () => reject(getReq.error);
  });
  if (row) {
    row.attempts += 1;
    row.lastError = lastError;
    store.put(row);
  }
  await txDone(tx);
  db.close();
}

/** Replay queued JSON API writes when connectivity returns. */
export async function flushOutbox(): Promise<{ sent: number; failed: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { sent: 0, failed: 0 };
  const items = await listOutbox();
  let sent = 0;
  let failed = 0;
  for (const item of items) {
    try {
      const res = await fetch(item.path, {
        method: item.method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
      }
      await removeOutbox(item.id);
      sent += 1;
    } catch (err) {
      await updateOutboxError(item.id, err instanceof Error ? err.message : 'Sync failed');
      failed += 1;
    }
  }
  return { sent, failed };
}
