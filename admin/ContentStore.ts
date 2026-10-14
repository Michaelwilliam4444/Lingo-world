'use client';
import type { ContentBundle } from '@/types/content';
import { getSeedContent, setActiveContent } from '@/content';
import { validateBundle, type ValidationIssue } from '@/content/schema';
import { getKV } from '@/lib/kv';
import { isSupabaseConfigured } from '@/lib/config';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Admin content workspace: a working draft of the whole content bundle, versioned releases,
 * an audit trail, and publishing.
 *   Local mode    → draft + releases in this browser's IndexedDB; publishing makes it the device's active content.
 *   Supabase mode → draft kept locally while editing; publish POSTs to /api/admin/publish, which re-validates,
 *                   upserts the normalised tables and writes an immutable content_bundles release (service role).
 */
export interface Release { version: string; publishedAt: string; notes: string; counts: Record<string, number> }
export interface AuditEntry { at: string; action: string; entity: string; actor: string }

const kv = () => getKV('lingoworld-admin');

export class ContentStore {
  async loadDraft(): Promise<ContentBundle> {
    const draft = await kv().get<ContentBundle>('draft');
    if (draft) return draft;
    if (isSupabaseConfigured()) {
      const { data } = await getSupabaseBrowserClient().from('content_bundles').select('bundle').eq('published', true).order('published_at', { ascending: false }).limit(1).maybeSingle();
      if (data?.bundle) return data.bundle as ContentBundle;
    }
    const published = await getKV().get<ContentBundle>('content:published');
    return published ?? structuredClone(getSeedContent());
  }

  async saveDraft(bundle: ContentBundle, audit?: Omit<AuditEntry, 'at'>): Promise<void> {
    await kv().set('draft', bundle);
    if (audit) await this.audit(audit);
  }

  async discardDraft(): Promise<void> {
    await kv().del('draft');
  }

  validate(bundle: ContentBundle): ValidationIssue[] {
    return validateBundle(bundle);
  }

  async audit(e: Omit<AuditEntry, 'at'>): Promise<void> {
    const list = (await kv().get<AuditEntry[]>('audit')) ?? [];
    await kv().set('audit', [{ ...e, at: new Date().toISOString() }, ...list].slice(0, 500));
  }

  async auditLog(): Promise<AuditEntry[]> {
    return (await kv().get<AuditEntry[]>('audit')) ?? [];
  }

  async releases(): Promise<Release[]> {
    if (isSupabaseConfigured()) {
      const { data } = await getSupabaseBrowserClient().from('content_bundles').select('version, published_at, notes').order('created_at', { ascending: false }).limit(30);
      return (data ?? []).map((r) => ({ version: r.version, publishedAt: r.published_at ?? '', notes: r.notes ?? '', counts: {} }));
    }
    return (await kv().get<Release[]>('releases')) ?? [];
  }

  async publish(bundle: ContentBundle, notes: string, actor: string): Promise<{ version: string; issues: ValidationIssue[] }> {
    const issues = validateBundle(bundle);
    if (issues.some((i) => i.severity === 'error')) return { version: '', issues };
    const version = `cms-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)}`;
    const release: ContentBundle = { ...bundle, version };
    if (isSupabaseConfigured()) {
      const token = (await getSupabaseBrowserClient().auth.getSession()).data.session?.access_token;
      const res = await fetch('/api/admin/publish', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${token ?? ''}` }, body: JSON.stringify({ bundle: release, notes }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Publish failed');
    } else {
      await getKV().set('content:published', release);
      const counts = { concepts: release.concepts.length, phrases: new Set(release.phrases.map((p) => p.id)).size, episodes: release.episodes.length, books: release.books.length };
      const list = await this.releases();
      await kv().set('releases', [{ version, publishedAt: new Date().toISOString(), notes, counts }, ...list].slice(0, 30));
      await kv().set(`release:${version}`, release);
    }
    setActiveContent(release);
    await this.saveDraft(release, { action: 'publish', entity: version, actor });
    return { version, issues };
  }

  async rollback(version: string, actor: string): Promise<boolean> {
    const release = await kv().get<ContentBundle>(`release:${version}`);
    if (!release) return false;
    await getKV().set('content:published', release);
    setActiveContent(release);
    await this.audit({ action: 'rollback', entity: version, actor });
    return true;
  }
}

export const contentStore = new ContentStore();
