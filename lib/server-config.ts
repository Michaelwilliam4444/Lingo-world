import 'server-only';

function ids(v: string | undefined): number[] {
  return (v ?? '').split(',').map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n > 0);
}
function num(v: string | undefined): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Server-only configuration. Importing this from a client component fails the build (server-only). */
export const serverConfig = {
  /** Emails allowed to see the money pages in /admin (comma-separated). Must ALSO have the 'owner' admin role. */
  ownerEmails: (process.env.OWNER_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  /** Web payments: 'paymob' (Egypt — cards, wallets, Fawry/Aman), 'stripe' (non-Egypt entity) or 'mock' (demo). */
  billingProvider: (process.env.BILLING_PROVIDER ?? process.env.NEXT_PUBLIC_BILLING_PROVIDER ?? 'mock') as 'mock' | 'stripe' | 'paymob',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  stripePrices: {
    premium_monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY ?? '',
    premium_annual: process.env.STRIPE_PRICE_PREMIUM_ANNUAL ?? '',
    family: process.env.STRIPE_PRICE_FAMILY ?? '',
  },
  paymob: {
    apiBase: (process.env.PAYMOB_API_BASE ?? 'https://accept.paymob.com').replace(/\/$/, ''),
    checkoutBase: process.env.PAYMOB_CHECKOUT_BASE ?? 'https://eg.checkout.paymob.com/',
    secretKey: process.env.PAYMOB_SECRET_KEY ?? '',
    publicKey: process.env.PAYMOB_PUBLIC_KEY ?? '',
    apiKey: process.env.PAYMOB_API_KEY ?? '',
    hmacSecret: process.env.PAYMOB_HMAC_SECRET ?? '',
    /** Integration ids (comma-separated allowed) per method, from Paymob dashboard → Developers → Payment integrations. */
    integrations: {
      card: ids(process.env.PAYMOB_INTEGRATION_CARD),
      wallet: ids(process.env.PAYMOB_INTEGRATION_WALLET),
      kiosk: ids(process.env.PAYMOB_INTEGRATION_KIOSK),
    },
    /** Subscription plan ids (created once with `npm run paymob:plans` or by your Paymob account manager). */
    subscriptionPlans: {
      premium_monthly: num(process.env.PAYMOB_PLAN_PREMIUM_MONTHLY),
      premium_annual: num(process.env.PAYMOB_PLAN_PREMIUM_ANNUAL),
      family: num(process.env.PAYMOB_PLAN_FAMILY),
    },
    /** Verify in the Paymob sandbox; '{id}' is replaced by the subscription id. */
    cancelPath: process.env.PAYMOB_SUBSCRIPTION_CANCEL_PATH ?? '/api/acceptance/subscriptions/{id}/cancel',
  },
  revenueCatWebhookAuth: process.env.REVENUECAT_WEBHOOK_AUTH ?? '',
  aiProvider: (process.env.AI_PROVIDER ?? 'mock') as 'mock' | 'anthropic' | 'openai',
  aiModel: process.env.AI_MODEL ?? '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  pronunciationProvider: (process.env.PRONUNCIATION_PROVIDER ?? 'none') as 'none' | 'azure',
  azureSpeechKey: process.env.AZURE_SPEECH_KEY ?? '',
  azureSpeechRegion: process.env.AZURE_SPEECH_REGION ?? '',
  emailProvider: (process.env.EMAIL_PROVIDER ?? 'none') as 'none' | 'resend',
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  reportFromEmail: process.env.REPORT_FROM_EMAIL ?? '',
  localAdminPasscode: process.env.LOCAL_ADMIN_PASSCODE ?? 'lingo-admin',
};
