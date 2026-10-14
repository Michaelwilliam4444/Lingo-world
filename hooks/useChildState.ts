'use client';
import { useEffect, useState } from 'react';
import type { ChildState } from '@/types/learner';
import { useApp } from '@/store/app';
import { getServices } from '@/services';
import { initialChildState } from '@/learning-engine/LearningOrchestrator';

/** Read a child's learning state for the Parent Zone without switching the active (playing) child. */
export function useChildState(childId: string | null): { state: ChildState | null; loading: boolean } {
  const children = useApp((s) => s.children);
  const active = useApp((s) => s.childState);
  const [state, setState] = useState<ChildState | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const child = children.find((c) => c.id === childId);
    if (!child) { setState(null); setLoading(false); return; }
    if (active?.child.id === child.id && active.child.targetLanguage === child.targetLanguage) { setState(active); setLoading(false); return; }
    setLoading(true);
    const s = getServices();
    (s.sync ? s.sync.load(child) : s.repo.loadChildState(child))
      .then((st) => { if (alive) setState(st ?? initialChildState(child, s.content, new Date())); })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [childId, children, active]);
  return { state, loading };
}
