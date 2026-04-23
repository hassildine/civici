## Open House Sign-In MVP

Offline-first sign-in sheet software for real estate agents.

Agents can:
- Customize logo, fonts, event title, accent color, and field order
- Capture leads while offline (Dexie / IndexedDB)
- Auto-sync once online and trigger a thank-you SMS
- Edit the SMS template with variables (`{firstName}`, `{fullName}`, `{eventName}`)

Built with:
- Next.js (Vercel-ready)
- Dexie
- Supabase
- Clerk
- Twilio (for SMS)

## Setup

1. Copy env file:

```bash
cp .env.example .env.local
```

2. Fill values in `.env.local`:
- Clerk keys
- Supabase URL + service role key
- Twilio credentials (optional for real SMS)

3. Create Supabase table:
- Run SQL from `supabase.sql` in your Supabase SQL editor

4. Install and run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Offline + Sync Flow

- Lead submissions are stored locally in Dexie immediately.
- A queue item is created per lead.
- When internet is available, the app calls `POST /api/sync`.
- API route stores the lead in Supabase and sends SMS via Twilio.
- If Twilio credentials are missing, SMS send is simulated (for testing UI/flow).

## Deployment (Vercel)

Deploy this repository to Vercel and set the same environment variables there.

## Next Improvements

- Per-agent data model tied to Clerk user IDs
- Better phone normalization/validation
- Background sync using a service worker
- Message delivery tracking dashboard
