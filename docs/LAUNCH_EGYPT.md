# Launching the LingoWorld website in Egypt (with payments)

This guide takes the repository to a public website at your own domain where parents sign up, choose a track for each child and pay in EGP by card, mobile wallet or Fawry/Aman.

> Why Paymob, not Stripe? Stripe does not onboard businesses registered in Egypt. Paymob is licensed by the Central Bank of Egypt and supports cards (Visa, Mastercard, Meeza), mobile wallets, Fawry/Aman kiosks and card subscriptions. If you later sell through a company registered in a Stripe country, set `BILLING_PROVIDER=stripe`. Nothing else changes.

## 1. What the website includes

| Page | Path | Purpose |
|---|---|---|
| Landing | `/welcome` | Story, the three age tracks, parent information, plans |
| Age tracks | `/tracks` | Details for each track: seasons, games, pace, skills, graduation |
| Pricing | `/pricing` | EGP/USD prices, payment methods, FAQ |
| Contact | `/contact` | Company details, email, phone/WhatsApp |
| Terms, Privacy, Refunds | `/legal/terms`, `/legal/privacy`, `/legal/refunds` | Required by Paymob and the card schemes |
| `sitemap.xml`, `robots.txt` | — | Search engines index only the public pages |

The legal pages are **templates**. Ask a lawyer licensed in Egypt to review them, covering Consumer Protection Law 181/2018 and Personal Data Protection Law 151/2020. Set the refund windows you actually want to offer.

## 2. Before you apply to Paymob

Paymob reviews your live website. Have these ready:

1. A registered business: commercial register, tax card, and a bank account in the company's name. Sole-proprietor options exist; ask Paymob.
2. The domain, with the site deployed (step 3), showing:
   - prices in EGP
   - a contact page with address, phone and email
   - Terms, Privacy and Refund pages
3. Your business details in these environment variables. They appear in the footer and on the legal pages:
   `NEXT_PUBLIC_COMPANY_NAME`, `NEXT_PUBLIC_COMPANY_ADDRESS`, `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_SUPPORT_PHONE`, `NEXT_PUBLIC_COMMERCIAL_REGISTER`, `NEXT_PUBLIC_TAX_ID`.
4. Final prices in `src/billing/pricing.ts`. The defaults are placeholders: 249 EGP a month, 1,799 a year, 2,499 for Family.

## 3. Deploy the website (Supabase + Vercel)

1. **Supabase.**
   - Create a project.
   - Run `supabase link --project-ref <ref>`, then `supabase db push`. This applies all three migrations, including `0003_tracks_and_payments`.
   - Load the content: run `psql "$DATABASE_URL" -f supabase/seed.sql`.
   - Turn on email auth and set the Site URL to your domain.
2. **Vercel.** Import the GitHub repository and set the environment variables (section 6). Deploy.
3. **Domain.** Open Vercel → Domains and add `yourdomain.com`. At your registrar, create the DNS records Vercel shows you. HTTPS is automatic.
4. Set `NEXT_PUBLIC_APP_URL=https://yourdomain.com` and redeploy. Payment callback URLs are built from this value.
5. Open `https://yourdomain.com/api/health`. It should report `dataMode: supabase` and the billing provider you set.
6. Admin: sign up on your site with your own email, then make yourself the owner:
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=… NEXT_PUBLIC_SUPABASE_URL=… npm run admin:grant -- you@yourdomain.com owner
   ```
   Set `OWNER_EMAILS=you@yourdomain.com` in Vercel. The **Payments** page (`/admin/payments`) opens only for an account that has the owner role **and** is listed in `OWNER_EMAILS`.

### Who can see what

| Person | How they get access | What they can open |
|---|---|---|
| Parents | Sign up on the website | Their own family, children and plan. They can never become admins by signing up. |
| Team members (editor, translator, support, analyst) | You add them from the command line with the service-role key, or as owner | The content studio for their role. They cannot see payments or revenue, and the database blocks them too (RLS-tested). |
| You (owner) | Owner role plus your email in `OWNER_EMAILS` | Everything, including **Payments**: money collected, subscribers, failed renewals, every payment, and Excel export. |

Admin roles live in the `admin_users` table. Only the owner, or someone holding `SUPABASE_SERVICE_ROLE_KEY`, can change that table, so keep that key private: store it only in Vercel and never share it.

## 4. Set up Paymob

1. Sign up at paymob.com and complete KYC. Until you are approved you work in **test mode**.
2. Go to Dashboard → Settings / Developers and copy:
   - Secret key → `PAYMOB_SECRET_KEY`
   - Public key → `PAYMOB_PUBLIC_KEY`
   - API key → `PAYMOB_API_KEY`
   - HMAC secret → `PAYMOB_HMAC_SECRET`
3. Under Payment integrations, note each integration id:
   - Online card → `PAYMOB_INTEGRATION_CARD`
   - Mobile wallet → `PAYMOB_INTEGRATION_WALLET`
   - Kiosk (Fawry/Aman) → `PAYMOB_INTEGRATION_KIOSK`
   - Card MOTO, for automatic renewals → `PAYMOB_INTEGRATION_MOTO`. Ask Paymob to enable **subscriptions/MOTO** on your account.
4. Set the transaction callback. For each integration, set the **Transaction processed callback** to `https://yourdomain.com/api/billing/paymob/webhook`. Each payment also sends this URL as `notification_url`.
5. Create the subscription plans for card auto-renewal:
   ```bash
   PAYMOB_API_KEY=… PAYMOB_INTEGRATION_MOTO=… NEXT_PUBLIC_APP_URL=https://yourdomain.com npm run paymob:plans            # preview
   PAYMOB_API_KEY=… PAYMOB_INTEGRATION_MOTO=… NEXT_PUBLIC_APP_URL=https://yourdomain.com npm run paymob:plans -- --create
   ```
   Put the printed ids in `PAYMOB_PLAN_PREMIUM_MONTHLY`, `PAYMOB_PLAN_PREMIUM_ANNUAL` and `PAYMOB_PLAN_FAMILY`.
   - Each plan's webhook is `https://yourdomain.com/api/billing/paymob/subscription`.
   - Your Paymob account manager can create the plans for you instead.
   - Until these ids are set, card payments work as prepaid periods.
6. Set `BILLING_PROVIDER=paymob` and `NEXT_PUBLIC_BILLING_PROVIDER=paymob`, then redeploy.

### How a payment flows

```
Parent Zone → Plan → choose plan → choose method (card / wallet / Fawry) → name + mobile
   → POST /api/billing/paymob/checkout   (server prices the order; creates a pending `payments` row + Paymob intention)
   → Paymob hosted checkout (eg.checkout.paymob.com)
   → Paymob → POST /api/billing/paymob/webhook  (HMAC-SHA512 verified; idempotent; grants/extends Premium)
   → parent returns to /parent/plan?checkout=paymob (page polls until Premium is active)
Card renewals → Paymob → POST /api/billing/paymob/subscription  (HMAC verified; renew / past_due / cancelled)
Cancel → Parent Zone → Plan → "Turn off auto-renewal" → POST /api/billing/paymob/cancel
```

Each method works differently:

| Method | Renewal | What happens |
|---|---|---|
| Card + subscription plan | Automatic | Premium runs until the next billing date. Failed renewals keep access during Paymob's retry days (`past_due`). Cancelling keeps the time already paid for. |
| Mobile wallet | Prepaid | Adds 1 or 12 months, counted from the later of today or the current end date. Buying early never loses days. |
| Fawry / Aman | Prepaid | The parent gets a reference number and the transaction stays `pending`. Premium starts when the cash is paid and Paymob calls the webhook. |
| Refund / void (any method) | — | Premium ends immediately. |

These security rules apply to every payment:
- The browser never sends an amount.
- Access is granted only by HMAC-verified callbacks, never by the redirect.
- A callback is rejected if its amount or currency differs from the order.
- `payments` and `subscriptions` can be written only by the service role (RLS-tested).

## 5. Test before going live

Use Paymob's test keys and test integrations. Paymob's docs list the test cards and wallet numbers.

- [ ] Monthly by card: Premium activates within seconds and `/parent/plan` shows "renews <date>".
- [ ] Turn off auto-renewal. The page shows "active until <date> (won't renew)" and Paymob shows the subscription as cancelled.
- [ ] Annual by wallet: Premium shows "prepaid until <date>". Buy again and the end date moves out by another year.
- [ ] Fawry: you get a reference number. Before paying, Premium is not active. After you mark it paid in the test environment, Premium activates.
- [ ] A declined card: an error is shown and no Premium is granted.
- [ ] A refund from the Paymob dashboard: Premium ends.
- [ ] Check the data in Supabase. `select * from payments order by created_at desc;` should show one row per attempt, with the right statuses.
- [ ] Verify the subscription **cancel endpoint path** in your sandbox (`PAYMOB_SUBSCRIPTION_CANCEL_PATH`). If cancellation fails, the app records the request and asks the parent to wait for support. Make sure your support inbox is monitored.

Then switch to live keys and live integration ids, redeploy, and make one real small purchase.

## 6. Environment variables (production)

```
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_DATA_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=…            NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…           # server only
BILLING_PROVIDER=paymob               NEXT_PUBLIC_BILLING_PROVIDER=paymob
PAYMOB_SECRET_KEY=…  PAYMOB_PUBLIC_KEY=…  PAYMOB_API_KEY=…  PAYMOB_HMAC_SECRET=…
PAYMOB_INTEGRATION_CARD=…  PAYMOB_INTEGRATION_WALLET=…  PAYMOB_INTEGRATION_KIOSK=…  PAYMOB_INTEGRATION_MOTO=…
PAYMOB_PLAN_PREMIUM_MONTHLY=…  PAYMOB_PLAN_PREMIUM_ANNUAL=…  PAYMOB_PLAN_FAMILY=…
NEXT_PUBLIC_COMPANY_NAME=…  NEXT_PUBLIC_COMPANY_ADDRESS=…  NEXT_PUBLIC_SUPPORT_EMAIL=…  NEXT_PUBLIC_SUPPORT_PHONE=…
NEXT_PUBLIC_COMMERCIAL_REGISTER=…  NEXT_PUBLIC_TAX_ID=…
```

## 7. Mobile apps

Apple and Google require digital subscriptions sold inside an app to use their in-app billing. The iOS and Android builds therefore use RevenueCat (see DEPLOYMENT.md §6). Paymob is for the website. A family that pays on the website is Premium in the apps too, because entitlements live on the account.
