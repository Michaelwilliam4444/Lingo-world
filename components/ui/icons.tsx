import type { SVGProps } from 'react';

const base = (p: SVGProps<SVGSVGElement>) => ({ width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p });

export const SpeakerIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></svg>);
export const MicIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>);
export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const BackIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)} className={`flip-rtl ${p.className ?? ''}`}><path d="M15 5l-7 7 7 7" /></svg>);
export const NextIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)} className={`flip-rtl ${p.className ?? ''}`}><path d="M9 5l7 7-7 7" /></svg>);
export const SnailIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="14" cy="11" r="5" /><path d="M14 11a2 2 0 1 0 2-2M3 18h15a3 3 0 0 0 3-3M5 18c0-3 1-5 4-6M4 9l1 3M7 8l-1 3" /></svg>);
export const StarIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" fill="currentColor" /></svg>);
export const LockIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>);
export const KeyIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="8" cy="8" r="5" /><path d="M11.5 11.5L21 21M17 17l2-2M15 19l2-2" /></svg>);
export const CheckIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M5 12l5 5 9-10" /></svg>);
