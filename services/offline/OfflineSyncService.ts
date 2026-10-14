import type { LearningLanguage } from '@/types/core';
import type { ChildProfile, ChildState } from '@/types/learner';
import type { DailyJourney } from '@/types/engine';
import { getKV, type KV } from '@/lib/kv';
import { RepositoryError, type DataRepository } from '../data/DataRepository';
import { mergeChildState } from './merge';

/**
 * OfflineSyncService — "cloud-first, local-always".
 *
 * Every save is written to the local cache first (so the app keeps working offline and starts
 * instantly), then pushed to the cloud. If the push fails for network reasons the state is marked
 * dirty in an outbox; `flush()` (on reconnect/app focus) merges with the server copy and pushes again.
 */
export class OfflineSyncService {
  private flushing = false;
  private listeners = new Set<(pending: number) => void>();

  constructor(private readonly remote: DataRepository, private readonly kv: KV = getKV('lingoworld-cache')) {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => void this.flush());
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void this.flush(); });
    }
  }

  onPendingChange(cb: (pending: number) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private key(childId: string, lang: LearningLanguage) { return `state:${childId}:${lang}`; }

  async pendingCount(): Promise<number> {
    return (await this.kv.keys('outbox:')).length;
  }

  private async notify() {
    const n = await this.pendingCount();
    this.listeners.forEach((l) => l(n));
  }

  async load(child: ChildProfile): Promise<ChildState | null> {
    const cached = await this.kv.get<ChildState>(this.key(child.id, child.targetLanguage));
    const dirty = await this.kv.get<boolean>(`outbox:${this.key(child.id, child.targetLanguage)}`);
    try {
      const remote = await this.remote.loadChildState(child);
      if (remote && cached && dirty) {
        const merged = mergeChildState({ ...cached, child }, remote);
        await this.save(merged);
        return merged;
      }
      const result = remote ?? (cached ? { ...cached, child } : null);
      if (result) await this.kv.set(this.key(child.id, child.targetLanguage), result);
      return result;
    } catch (e) {
      if (e instanceof RepositoryError && e.code === 'network') return cached ? { ...cached, child } : null;
      if (cached && !navigatorOnline()) return { ...cached, child };
      throw e;
    }
  }

  async save(state: ChildState): Promise<'synced' | 'queued'> {
    const k = this.key(state.child.id, state.child.targetLanguage);
    await this.kv.set(k, state);
    try {
      if (!navigatorOnline()) throw new RepositoryError('offline', 'network');
      await this.remote.saveChildState(state);
      await this.kv.del(`outbox:${k}`);
      await this.notify();
      return 'synced';
    } catch (e) {
      if (e instanceof RepositoryError && e.code !== 'network') throw e;
      await this.kv.set(`outbox:${k}`, true);
      await this.notify();
      return 'queued';
    }
  }

  async saveJourney(childId: string, journey: DailyJourney): Promise<void> {
    await this.kv.set(`journey:${childId}:${journey.language}:${journey.date}`, journey);
    try { if (navigatorOnline()) await this.remote.saveJourney(childId, journey); } catch { /* cached locally; journey regenerates deterministically anyway */ }
  }

  async loadJourney(childId: string, language: LearningLanguage, date: string): Promise<DailyJourney | null> {
    const local = await this.kv.get<DailyJourney>(`journey:${childId}:${language}:${date}`);
    if (local) return local;
    try { return await this.remote.loadJourney(childId, language, date); } catch { return null; }
  }

  /** Push every dirty state, merging with the server copy first. */
  async flush(): Promise<number> {
    if (this.flushing || !navigatorOnline()) return 0;
    this.flushing = true;
    let pushed = 0;
    try {
      for (const ob of await this.kv.keys('outbox:')) {
        const k = ob.slice('outbox:'.length);
        const local = await this.kv.get<ChildState>(k);
        if (!local) { await this.kv.del(ob); continue; }
        try {
          const remote = await this.remote.loadChildState(local.child);
          const merged = remote ? mergeChildState(local, remote) : local;
          await this.remote.saveChildState(merged);
          await this.kv.set(k, merged);
          await this.kv.del(ob);
          pushed++;
        } catch {
          break; // still offline — try again later
        }
      }
    } finally {
      this.flushing = false;
      await this.notify();
    }
    return pushed;
  }

  /** Cache a downloaded content bundle for offline use (parent "download for offline"). */
  async cacheContent(version: string, bundle: unknown) {
    await this.kv.set('content:offline', { version, bundle, at: new Date().toISOString() });
  }
}

function navigatorOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}
