'use client';
import { useCallback, useEffect, useState } from 'react';
import type { ContentBundle } from '@/types/content';
import { contentStore } from './ContentStore';

export function useDraft() {
  const [draft, setDraft] = useState<ContentBundle | null>(null);
  useEffect(() => { void contentStore.loadDraft().then(setDraft); }, []);
  const save = useCallback(async (next: ContentBundle, action: string, entity: string) => {
    setDraft(next);
    await contentStore.saveDraft(next, { action, entity, actor: 'admin' });
  }, []);
  return { draft, save, setDraft };
}
