/** Deterministic, seedable randomness so journeys are reproducible for a given child + day (and testable). */
export function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface Rng {
  next(): number;                      // [0, 1)
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
  weighted<T>(items: readonly T[], weight: (item: T) => number): T;
}

export function createRng(seed: number | string): Rng {
  let a = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int: (max) => Math.floor(next() * max),
    pick: (items) => {
      if (!items.length) throw new Error('pick from empty list');
      return items[Math.floor(next() * items.length)]!;
    },
    shuffle: (items) => {
      const arr = [...items];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j]!, arr[i]!];
      }
      return arr;
    },
    weighted: (items, weight) => {
      const weights = items.map((i) => Math.max(0, weight(i)));
      const total = weights.reduce((s, w) => s + w, 0);
      if (total <= 0) return rng.pick(items);
      let r = next() * total;
      for (let i = 0; i < items.length; i++) {
        r -= weights[i]!;
        if (r <= 0) return items[i]!;
      }
      return items.at(-1)!;
    },
  };
  return rng;
}

/** Deterministic UUID-shaped id from a string (stable row ids for idempotent upserts). */
export function uuidFromString(input: string): string {
  const parts = [hashString(input), hashString(`a${input}`), hashString(`b${input}`), hashString(`c${input}`)].map((n) => n.toString(16).padStart(8, '0'));
  const hex = parts.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
