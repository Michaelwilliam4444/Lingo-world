/**
 * Public business details for the website. Payment providers (Paymob, card schemes) require these to be
 * visible on the site before they approve a live account. Set them in your environment (see .env.example).
 */
const v = (value: string | undefined, placeholder: string) => ({ value: value?.trim() || placeholder, missing: !value?.trim() });

export const SITE = {
  brand: 'LingoWorld',
  tagline: 'Every Day, a New Adventure',
  company: v(process.env.NEXT_PUBLIC_COMPANY_NAME, '[Your company legal name]'),
  address: v(process.env.NEXT_PUBLIC_COMPANY_ADDRESS, '[Registered address, Cairo, Egypt]'),
  email: v(process.env.NEXT_PUBLIC_SUPPORT_EMAIL, 'support@your-domain.com'),
  phone: v(process.env.NEXT_PUBLIC_SUPPORT_PHONE, '[+20 support phone]'),
  commercialRegister: v(process.env.NEXT_PUBLIC_COMMERCIAL_REGISTER, '[Commercial register no.]'),
  taxId: v(process.env.NEXT_PUBLIC_TAX_ID, '[Tax registration no.]'),
  governingLaw: 'the Arab Republic of Egypt',
  legalUpdated: '10 October 2026',
} as const;

export const SITE_LINKS = [
  { href: '/tracks', label: 'Age tracks' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/welcome#parents', label: 'For parents' },
  { href: '/contact', label: 'Contact' },
] as const;

export const LEGAL_LINKS = [
  { href: '/legal/terms', label: 'Terms of Service' },
  { href: '/legal/privacy', label: 'Privacy Policy' },
  { href: '/legal/refunds', label: 'Refund & Cancellation Policy' },
] as const;
