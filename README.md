# BudgetApp

A personal budgeting web app for Panama, built with Next.js, TypeScript, and Postgres (via Prisma). It models Panama-specific payroll rules — CSS, Seguro Educativo, ISR, and Décimo Tercer Mes — and retains full history for past budget cycles.

## Getting Started

1. Make sure Postgres is running locally and a `budgetapp_dev` database exists:
   ```bash
   brew install postgresql@16   # if not already installed
   brew services start postgresql@16
   createdb budgetapp_dev
   ```
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and `AUTH_SECRET` (`openssl rand -base64 32`).
3. Install dependencies and apply the database schema:
   ```bash
   npm install
   npx prisma migrate dev
   ```
4. Run the dev server:
   ```bash
   npm run dev
   ```
5. Visit `http://localhost:3000` — you'll be redirected to sign up, then through onboarding (income → expenses → accounts).

Optional: `npm run db:seed` creates a demo user (`demo@example.com` / `password123`).

## Gmail import setup (optional)

Profile has a "Connect Gmail" feature that auto-imports purchase notification
emails from Banco General as transactions. It's entirely optional — the rest
of the app works fully without it. To enable it locally:

1. Go to [Google Cloud Console](https://console.cloud.google.com), create a
   new project, and enable the **Gmail API** (APIs & Services → Library).
2. APIs & Services → OAuth consent screen: user type **External**, publishing
   status **Testing** (this avoids Google's app-verification review entirely
   — only required for published apps). Add your own Gmail address as a test
   user. Add the `.../auth/gmail.readonly` scope.
3. APIs & Services → Credentials → Create Credentials → **OAuth client ID**,
   application type **Web application**. Add these as Authorized redirect URIs:
   - `http://localhost:3000/api/gmail/callback` (local dev)
   - `https://<your-deployed-domain>/api/gmail/callback` (once deployed — see below)
4. Copy the generated Client ID and Secret into `.env` as `GOOGLE_CLIENT_ID`
   / `GOOGLE_CLIENT_SECRET`, and generate a `GMAIL_TOKEN_ENCRYPTION_KEY`
   (`openssl rand -base64 32`) — this encrypts the stored refresh token.
5. Restart the dev server, go to Profile, click "Connect Gmail."

Only emails from `transaccionesbg@bgeneral.com` are ever queried — see
`lib/gmail-parsers.ts` to add support for other senders/email formats.

## Deployment

The app deploys to [Vercel](https://vercel.com) with a hosted Postgres (e.g.
[Neon](https://neon.tech)'s free tier) — both free for personal use.

1. Create a free Neon Postgres project and copy its pooled connection string.
2. Connect this GitHub repo to a new Vercel project (no `vercel.json` needed
   — Next.js deploys with zero config).
3. Set these environment variables in the Vercel project settings:
   - `DATABASE_URL` — the Neon connection string
   - `AUTH_SECRET` — generate a **new** one for production, don't reuse the
     local dev value (`openssl rand -base64 32`)
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GMAIL_TOKEN_ENCRYPTION_KEY`
     — only needed if using Gmail import, same values as above
4. Apply migrations to the fresh hosted database once, from your machine:
   ```bash
   DATABASE_URL="<neon-connection-string>" npx prisma migrate deploy
   ```
5. Once deployed, add the production redirect URI
   (`https://<your-vercel-domain>/api/gmail/callback`) to the Google OAuth
   client from step 3 of the Gmail setup above.

Local dev is unaffected by any of this — `lib/prisma.ts` always reads
`DATABASE_URL` from your local, gitignored `.env`.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` / `npm run start` — production build/run
- `npm test` — run unit tests (Panama tax/payroll calculations)
- `npx prisma studio` — inspect the database
- `npx prisma migrate dev` — apply schema changes
