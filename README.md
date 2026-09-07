# Private Line

Multi-tenant 1:1 encrypted video calling for professionals (realtors, coaches, etc).
Each professional signs into their own account. Your Daily.co API key lives on the
server only — no professional ever sees it, and none of them can create rooms outside
your platform.

## What's different from the single-file HTML version

- Real accounts: each professional (Jane, John, anyone else) signs up/signs in with their own email
- Your Daily API key is stored server-side (`.env`), never sent to any browser
- Call history is saved per professional in Supabase, with row-level security — Jane can never see John's clients and vice versa
- One shared codebase, one deploy — adding a new professional is just "they sign up," no code changes

## Setup (one time)

### 1. Supabase
1. Create a project at supabase.com (free tier is fine to start)
2. In the SQL editor, run everything in `supabase-schema.sql`
3. In Project Settings → API, copy your **Project URL** and **anon public key**

### 2. Daily.co
1. Get your API key from dashboard.daily.co → Developers
2. Make sure a payment method is on file (Daily requires this even on the free tier)
3. Run the included setup script once, to hide Daily's own branding domain-wide:
   ```
   chmod +x setup-branding.sh
   ./setup-branding.sh YOUR_DAILY_API_KEY
   ```
   This is a one-time domain-level setting — you never need to repeat it.

### 3. Environment variables
Copy `.env.example` to `.env.local` and fill in:
```
DAILY_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### 4. Install and run locally
```
npm install
npm run dev
```
Visit `http://localhost:3000` — you'll land on the sign-up page.

### 5. Deploy
Push this folder to a GitHub repo, then import it into Vercel (vercel.com).
Add the same three environment variables in Vercel's project settings.
Vercel gives you a live HTTPS URL — that's what you send Jane, John, and every
professional you onboard from now on. They each create their own account there.

## Branding

Two spots to edit, both marked in the code:
- `app/dashboard/page.tsx` — logo URL and business name near the top
- Same file — `--brand-color` in the `<style>` block, and the matching `accent`
  color inside `app/api/create-room/route.ts` so the call screen matches too

## What's intentionally not built yet

- Client-initiated calls (a client requesting a call instead of the professional
  generating a link) — needs a "ring and approve" flow, a later addition
- Stripe payment/checkout — the Basic (10 calls/mo) vs Unlimited tier check is
  already built and enforced (see `profiles` table + the limit check in
  `app/api/create-room/route.ts`), but nothing charges a card yet. The dashboard's
  upgrade button currently links to a placeholder `/upgrade` page — replace that
  with a real Stripe Checkout link once billing is wired up.
- Password reset flow — Supabase Auth supports this out of the box, just needs
  a reset-password page added
