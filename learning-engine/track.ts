import type { AgeBand } from '@/types/core';
import type { ChildProfile } from '@/types/learner';

/** The track a child follows: the parent's choice, otherwise the child's age band. */
export function trackIdOf(child: Pick<ChildProfile, 'ageBand' | 'trackId'>): AgeBand {
  return child.trackId ?? child.ageBand;
}
