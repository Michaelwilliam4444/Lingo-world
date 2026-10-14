import type { AvatarConfig } from '@/types/learner';
import { AVATAR_OPTIONS, optionColor } from '@/features/avatar/catalog';

/** Paper-doll avatar drawn in SVG from the config (no photos, no real likeness). */
export function AvatarFigure({ config, size = 160, withBackground = true }: { config: AvatarConfig; size?: number; withBackground?: boolean }) {
  const skin = optionColor('skin', config.skin);
  const hair = optionColor('hairColor', config.hairColor);
  const outfit = optionColor('outfit', config.outfit);
  const shoes = optionColor('shoes', config.shoes);
  const bg = optionColor('background', config.background);
  const accessory = AVATAR_OPTIONS.accessory.find((a) => a.id === config.accessory)?.emoji;
  const mouth = { smile: 'M44 66 Q50 72 56 66', grin: 'M42 64 Q50 76 58 64 Z', wink: 'M44 66 Q50 71 56 66', wow: '' }[config.face as 'smile'] ?? 'M44 66 Q50 72 56 66';
  return (
    <svg viewBox="0 0 100 130" width={size} height={size * 1.3} role="img" aria-label="Your explorer">
      {withBackground && <rect x="0" y="0" width="100" height="130" rx="22" fill={bg} />}
      {withBackground && <path d="M-5 110 Q25 95 50 108 T105 104 V135 H-5Z" fill="rgba(0,0,0,0.15)" />}
      {/* back hair */}
      {config.hair === 'long' && <path d="M26 46 Q24 90 34 96 L66 96 Q76 90 74 46 Z" fill={hair} />}
      {config.hair === 'braids' && <><rect x="22" y="50" width="9" height="40" rx="4.5" fill={hair} /><rect x="69" y="50" width="9" height="40" rx="4.5" fill={hair} /></>}
      {config.hair === 'covered' && <path d="M22 50 Q22 18 50 18 Q78 18 78 50 L80 92 Q50 100 20 92 Z" fill={outfit} opacity="0.9" />}
      {/* body */}
      <path d="M28 120 Q28 86 50 84 Q72 86 72 120 Z" fill={outfit} />
      {config.outfit === 'stripes' && <path d="M30 100 H70 M29 110 H71" stroke="#fff" strokeWidth="4" />}
      {config.outfit === 'cape' && <path d="M30 88 L20 124 H80 L70 88 Z" fill="#c43c3c" opacity="0.85" />}
      <rect x="35" y="118" width="12" height="7" rx="3" fill={shoes} stroke="#00000033" />
      <rect x="53" y="118" width="12" height="7" rx="3" fill={shoes} stroke="#00000033" />
      {/* head */}
      <rect x="45" y="72" width="10" height="14" fill={skin} />
      <circle cx="50" cy="52" r="24" fill={skin} />
      {/* front hair */}
      {config.hair === 'short' && <path d="M26 50 Q26 26 50 26 Q74 26 74 50 Q64 36 50 38 Q36 36 26 50Z" fill={hair} />}
      {config.hair === 'long' && <path d="M26 52 Q26 26 50 26 Q74 26 74 52 Q62 34 50 36 Q38 34 26 52Z" fill={hair} />}
      {config.hair === 'curly' && [30, 38, 46, 54, 62, 70, 34, 66].map((x, i) => <circle key={i} cx={x} cy={i > 5 ? 40 : 31} r="8" fill={hair} />)}
      {config.hair === 'buns' && <><circle cx="30" cy="28" r="9" fill={hair} /><circle cx="70" cy="28" r="9" fill={hair} /><path d="M26 48 Q28 28 50 28 Q72 28 74 48 Q60 38 50 39 Q40 38 26 48Z" fill={hair} /></>}
      {config.hair === 'spiky' && <path d="M26 48 L30 26 L38 36 L44 22 L50 34 L56 22 L62 36 L70 26 L74 48 Q50 38 26 48Z" fill={hair} />}
      {config.hair === 'braids' && <path d="M26 50 Q26 26 50 26 Q74 26 74 50 Q62 36 50 38 Q38 36 26 50Z" fill={hair} />}
      {config.hair === 'covered' && <path d="M24 52 Q24 24 50 24 Q76 24 76 52 Q70 34 50 34 Q30 34 24 52Z" fill={outfit} />}
      {/* face */}
      <circle cx="41" cy="54" r="3" fill="#241c4f" />
      {config.face === 'wink' ? <path d="M56 54 h6" stroke="#241c4f" strokeWidth="2.5" strokeLinecap="round" /> : <circle cx="59" cy="54" r="3" fill="#241c4f" />}
      <circle cx="36" cy="62" r="3.5" fill="#ff7e9e" opacity="0.5" /><circle cx="64" cy="62" r="3.5" fill="#ff7e9e" opacity="0.5" />
      {config.face === 'wow' ? <circle cx="50" cy="67" r="3.5" fill="#241c4f" /> : <path d={mouth} stroke="#241c4f" strokeWidth="2.5" fill={config.face === 'grin' ? '#fff' : 'none'} strokeLinecap="round" />}
      {accessory && <text x="50" y={config.accessory === 'glasses' || config.accessory === 'cool' ? 60 : 28} fontSize="20" textAnchor="middle">{accessory}</text>}
    </svg>
  );
}
