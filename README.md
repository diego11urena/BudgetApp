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

## Scripts

- `npm run dev` — start the dev server
- `npm run build` / `npm run start` — production build/run
- `npm test` — run unit tests (Panama tax/payroll calculations)
- `npx prisma studio` — inspect the database
- `npx prisma migrate dev` — apply schema changes
