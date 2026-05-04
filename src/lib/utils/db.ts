/**
 * Lightweight IndexedDB wrapper for BMI Calculator.
 *
 * Provides a simple key-value store backed by IndexedDB,
 * with no external dependencies. Used as the durable store
 * behind the synchronous storage.ts cache layer.
 *
 * Schema versioning enables safe future migrations.
 */

// ── Constants ──
const DB_NAME = 'bmi-calculator';
const DB_VERSION = 1;
const STORE_KV = 'keyvalue';
const STORE_BACKUPS = 'backups';
const STORE_META = 'meta';

// ── Types ──
export interface BackupRecord {
  id?: number; // auto-increment
  timestamp: number;
  appVersion: string;
  recordCount: number;
  data: string; // JSON string of all stored key-value pairs
}

export interface DbMeta {
  key: string;
  value: string;
}

// ── Database opening ──

let _db: IDBDatabase | null = null;
let _dbReady: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  if (_dbReady) return _dbReady;

  _dbReady = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (_event) => {
      const db = request.result;

      // Key-value store (primary data)
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV, { keyPath: 'key' });
      }

      // Backups store (auto-increment id)
      if (!db.objectStoreNames.contains(STORE_BACKUPS)) {
        const bs = db.createObjectStore(STORE_BACKUPS, { keyPath: 'id', autoIncrement: true });
        bs.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Meta store (schema version, migration flags, encryption settings)
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      _db = request.result;
      resolve(_db);
    };

    request.onerror = () => {
      reject(new Error(`IndexedDB open failed: ${request.error?.message}`));
    };
  });

  return _dbReady;
}

// ── Key-Value operations ──

/** Read a value from IndexedDB. Returns null if not found. */
export async function dbGet(key: string): Promise<string | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_KV, 'readonly');
    const store = tx.objectStore(STORE_KV);
    const req = store.get(key);
    req.onsuccess = () => {
      const result = req.result as { key: string; value: string } | undefined;
      resolve(result?.value ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Write a key-value pair to IndexedDB. */
export async function dbSet(key: string, value: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_KV, 'readwrite');
    const store = tx.objectStore(STORE_KV);
    const req = store.put({ key, value });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Delete a key from IndexedDB. */
export async function dbRemove(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_KV, 'readwrite');
    const store = tx.objectStore(STORE_KV);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Get all key-value entries from IndexedDB. */
export async function dbGetAll(): Promise<Array<{ key: string; value: string }>> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_KV, 'readonly');
    const store = tx.objectStore(STORE_KV);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

/** Get all keys matching a prefix (e.g., 'bmi.'). */
export async function dbGetKeysByPrefix(prefix: string): Promise<string[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_KV, 'readonly');
    const store = tx.objectStore(STORE_KV);
    const req = store.getAllKeys();
    req.onsuccess = () => {
      const keys = (req.result as IDBValidKey[]).filter(
        (k) => typeof k === 'string' && k.startsWith(prefix)
      ) as string[];
      resolve(keys);
    };
    req.onerror = () => reject(req.error);
  });
}

// ── Meta operations ──

/** Read a meta value. */
export async function dbMetaGet(key: string): Promise<string | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const store = tx.objectStore(STORE_META);
    const req = store.get(key);
    req.onsuccess = () => {
      const result = req.result as { key: string; value: string } | undefined;
      resolve(result?.value ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Write a meta value. */
export async function dbMetaSet(key: string, value: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    const store = tx.objectStore(STORE_META);
    const req = store.put({ key, value });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Backup operations ──

/** Save a backup record. Returns the auto-generated id. */
export async function dbBackupSave(record: Omit<BackupRecord, 'id'>): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BACKUPS, 'readwrite');
    const store = tx.objectStore(STORE_BACKUPS);
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

/** Get all backups sorted by timestamp descending (newest first). */
export async function dbBackupGetAll(): Promise<BackupRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BACKUPS, 'readonly');
    const store = tx.objectStore(STORE_BACKUPS);
    const index = store.index('timestamp');
    const req = index.getAll();
    req.onsuccess = () => {
      const records = (req.result as BackupRecord[]).sort(
        (a, b) => b.timestamp - a.timestamp
      );
      resolve(records);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Delete a backup by id. */
export async function dbBackupDelete(id: number): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BACKUPS, 'readwrite');
    const store = tx.objectStore(STORE_BACKUPS);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Get the most recent backup. */
export async function dbBackupLatest(): Promise<BackupRecord | null> {
  const all = await dbBackupGetAll();
  return all[0] ?? null;
}

// ── Utility ──

/** Check if IndexedDB is available in this context. */
export function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

/** Close the database connection (for cleanup / testing). */
export function dbClose(): void {
  if (_db) {
    _db.close();
    _db = null;
    _dbReady = null;
  }
}
