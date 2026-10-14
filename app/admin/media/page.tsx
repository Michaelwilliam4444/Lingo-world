'use client';
import { useEffect, useState } from 'react';
import { ParentCard } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/Button';
import { getKV } from '@/lib/kv';
import { isSupabaseConfigured, publicConfig } from '@/lib/config';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { newId } from '@/lib/id';

interface Asset { id: string; kind: 'image' | 'audio' | 'video' | 'animation'; url: string; name: string; mime: string; bytes: number; language?: string; license: string; tags: string[]; createdAt: string }

/**
 * Media library. Assets are never bundled in code: they live in storage (Supabase Storage bucket
 * `content-media` or any CDN via NEXT_PUBLIC_MEDIA_BASE_URL) and are referenced from content as "asset:<path>".
 */
export default function Media() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [license, setLicense] = useState('original');
  const [language, setLanguage] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const kv = getKV('lingoworld-admin');
  useEffect(() => { void kv.get<Asset[]>('media').then((a) => setAssets(a ?? [])); }, [kv]);

  const upload = async (files: FileList) => {
    const added: Asset[] = [];
    for (const f of Array.from(files)) {
      const kind = f.type.startsWith('audio') ? 'audio' : f.type.startsWith('video') ? 'video' : f.type.includes('json') ? 'animation' : 'image';
      const path = `${kind}/${newId()}-${f.name.replace(/[^\w.-]/g, '_')}`;
      let url: string;
      if (isSupabaseConfigured()) {
        const sb = getSupabaseBrowserClient();
        const { error } = await sb.storage.from('content-media').upload(path, f, { contentType: f.type, upsert: false });
        if (error) { setMsg(`Upload failed: ${error.message}`); continue; }
        url = sb.storage.from('content-media').getPublicUrl(path).data.publicUrl;
        await sb.from('media_assets').insert({ kind, url, storage_path: path, mime_type: f.type, bytes: f.size, language: language || null, license, tags: [] });
      } else {
        url = URL.createObjectURL(f); // device mode: preview only for this session
      }
      added.push({ id: path, kind, url, name: f.name, mime: f.type, bytes: f.size, language: language || undefined, license, tags: [], createdAt: new Date().toISOString() });
    }
    const next = [...added, ...assets];
    setAssets(next); await kv.set('media', next);
    if (added.length) setMsg(`Uploaded ${added.length} file(s). Reference them in content as asset:${added[0]!.id}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Media library</h1>
      <ParentCard>
        <div className="flex flex-wrap items-end gap-3">
          <label className="font-bold">License<select value={license} onChange={(e) => setLicense(e.target.value)} className="mt-1 block rounded-tab border-2 border-ink/15 px-2 py-1.5">
            <option value="original">Original</option><option value="licensed">Licensed</option><option value="royalty-free">Royalty-free</option><option value="generated">Generated</option></select></label>
          <label className="font-bold">Language (audio)<select value={language} onChange={(e) => setLanguage(e.target.value)} className="mt-1 block rounded-tab border-2 border-ink/15 px-2 py-1.5">
            <option value="">—</option>{['en', 'fr', 'de', 'it', 'es'].map((l) => <option key={l}>{l}</option>)}</select></label>
          <label className="cursor-pointer rounded-tab bg-night px-4 py-2 font-bold text-paper">Upload files<input type="file" multiple accept="image/*,audio/*,video/*,application/json" className="sr-only" onChange={(e) => e.target.files && void upload(e.target.files)} /></label>
        </div>
        <p className="mt-2 text-sm text-ink-soft">Storage: {isSupabaseConfigured() ? 'Supabase Storage (content-media bucket)' : 'device preview only — configure Supabase to store media'} · CDN base: {publicConfig.mediaBaseUrl || 'not set'}</p>
        {msg && <p role="status" className="mt-2">{msg}</p>}
      </ParentCard>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        {assets.map((a) => (
          <figure key={a.id} className="rounded-tab border border-ink/10 bg-white p-2 text-sm">
            {a.kind === 'image' ? <img src={a.url} alt={a.name} className="aspect-square w-full rounded object-cover" /> : a.kind === 'audio' ? <audio controls src={a.url} className="w-full" /> : <div className="flex aspect-square items-center justify-center text-4xl">🎞️</div>}
            <figcaption className="mt-1 truncate" title={a.id}>{a.name}</figcaption>
            <p className="text-xs text-ink-soft">{a.kind} · {(a.bytes / 1024).toFixed(0)} KB · {a.license}{a.language ? ` · ${a.language}` : ''}</p>
            <Button variant="parent-quiet" className="mt-1 h-8 w-full px-2 text-xs" onClick={() => void navigator.clipboard?.writeText(`asset:${a.id}`)}>Copy reference</Button>
          </figure>
        ))}
      </div>
    </div>
  );
}
