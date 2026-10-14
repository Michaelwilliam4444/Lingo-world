import type { AvatarConfig } from '@/types/learner';

/** Avatar options. Every option is child-appropriate; some unlock through earned rewards (never random). */
export interface AvatarOption { id: string; label: string; color?: string; emoji?: string; unlock?: string; premium?: boolean }

export const AVATAR_OPTIONS: Record<keyof AvatarConfig, AvatarOption[]> = {
  skin: [
    { id: 'tone1', label: '1', color: '#fde0c5' }, { id: 'tone2', label: '2', color: '#f4c79f' }, { id: 'tone3', label: '3', color: '#e0a878' },
    { id: 'tone4', label: '4', color: '#c68955' }, { id: 'tone5', label: '5', color: '#9a6239' }, { id: 'tone6', label: '6', color: '#6b4226' },
  ],
  hair: [
    { id: 'short', label: 'Short' }, { id: 'long', label: 'Long' }, { id: 'curly', label: 'Curly' }, { id: 'buns', label: 'Buns' },
    { id: 'spiky', label: 'Spiky' }, { id: 'braids', label: 'Braids' }, { id: 'covered', label: 'Head scarf' }, { id: 'none', label: 'None' },
  ],
  hairColor: [
    { id: 'black', label: 'Black', color: '#2b2118' }, { id: 'brown', label: 'Brown', color: '#6b4226' }, { id: 'blond', label: 'Blond', color: '#e8c15b' },
    { id: 'red', label: 'Red', color: '#c4512b' }, { id: 'blue', label: 'Blue', color: '#4f7cff' }, { id: 'pink', label: 'Pink', color: '#ff7eb6' },
  ],
  face: [{ id: 'smile', label: '🙂' }, { id: 'grin', label: '😁' }, { id: 'wink', label: '😉' }, { id: 'wow', label: '😮' }],
  outfit: [
    { id: 'explorer', label: 'Explorer', color: '#2ec4b6' }, { id: 'hoodie', label: 'Hoodie', color: '#e2447a' }, { id: 'stripes', label: 'Stripes', color: '#6ec3ff' },
    { id: 'dress', label: 'Dress', color: '#b388ff' }, { id: 'sporty', label: 'Sporty', color: '#7cc96a' },
    { id: 'cape', label: 'Hero cape', color: '#ff6b6b', unlock: 'clothing.cape' }, { id: 'space', label: 'Space suit', color: '#e8eef7', unlock: 'clothing.space', premium: true },
  ],
  shoes: [{ id: 'sneakers', label: 'Sneakers', color: '#ffffff' }, { id: 'boots', label: 'Boots', color: '#6b4226' }, { id: 'rainbow', label: 'Rainbow', color: '#ffc94a' }],
  accessory: [
    { id: 'none', label: 'None' }, { id: 'glasses', label: 'Glasses', emoji: '👓' }, { id: 'bow', label: 'Bow', emoji: '🎀' },
    { id: 'headphones', label: 'Headphones', emoji: '🎧' }, { id: 'cap', label: 'Explorer cap', emoji: '🧢', unlock: 'clothing.cap' },
    { id: 'crown', label: 'Crown', emoji: '👑', unlock: 'clothing.crown' }, { id: 'cool', label: 'Cool glasses', emoji: '🕶️', unlock: 'clothing.glasses' },
  ],
  background: [
    { id: 'meadow', label: 'Meadow', color: '#7cc96a' }, { id: 'sky', label: 'Sky', color: '#6ec3ff' }, { id: 'sea', label: 'Sea', color: '#2ec4b6' },
    { id: 'sunset', label: 'Sunset', color: '#ff9f6b' }, { id: 'space', label: 'Space', color: '#2d2470' },
  ],
  color: [{ id: 'sunrise', label: 'Sunrise', color: '#ffc94a' }, { id: 'berry', label: 'Berry', color: '#e2447a' }, { id: 'lagoon', label: 'Lagoon', color: '#2ec4b6' }],
};

export function optionColor(slot: keyof AvatarConfig, id: string): string {
  return AVATAR_OPTIONS[slot].find((o) => o.id === id)?.color ?? '#cccccc';
}

export function isUnlocked(opt: AvatarOption, ownedRewards: string[], premium: boolean): boolean {
  if (opt.premium && !premium) return false;
  return !opt.unlock || ownedRewards.includes(opt.unlock);
}
