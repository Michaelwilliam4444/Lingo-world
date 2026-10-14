/**
 * Minimal async key-value store on IndexedDB with an in-memory fallback (private mode, tests, SSR).
 * Used for local mode persistence, the offline outbox and cached content bundles.
 */
export interface KV {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
}

class MemoryKV implements KV {
  private map = new Map<string, unknown>();
  async get<T>(key: string) { return structuredClone(this.map.get(key)) as T | undefined; }
  async set<T>(key: string, value: T) { this.map.set(key, structuredClone(value)); }
  async del(key: string) { this.map.delete(key); }
  async keys(prefix = '') { return [...this.map.keys()].filter((k) => k.startsWith(prefix)); }
}

class IndexedDbKV implements KV {
  private dbPromise: Promise<IDBDatabase>;
  constructor(name: string) {
    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  private async tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.dbPromise;
    return new Promise<T>((resolve, reject) => {
      const t = db.transaction('kv', mode);
      const req = fn(t.objectStore('kv'));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  get<T>(key: string) { return this.tx<T | undefined>('readonly', (s) => s.get(key) as IDBRequest<T | undefined>); }
  async set<T>(key: string, value: T) { await this.tx('readwrite', (s) => s.put(value, key)); }
  async del(key: string) { await this.tx('readwrite', (s) => s.delete(key)); }
  async keys(prefix = '') {
    const all = (await this.tx('readonly', (s) => s.getAllKeys())) as IDBValidKey[];
    return all.map(String).filter((k) => k.startsWith(prefix));
  }
}

const stores = new Map<string, KV>();

export function getKV(name = 'lingoworld'): KV {
  let kv = stores.get(name);
  if (!kv) {
    kv = typeof indexedDB !== 'undefined' && typeof window !== 'undefined' ? safeIdb(name) : new MemoryKV();
    stores.set(name, kv);
  }
  return kv;
}

function safeIdb(name: string): KV {
  try {
    return new IndexedDbKV(name);
  } catch {
    return new MemoryKV();
  }
}

/** For tests. */
export function createMemoryKV(): KV {
  return new MemoryKV();
}
