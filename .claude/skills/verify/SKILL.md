---
name: verify
description: Build/launch/drive recipe for BudgetApp (Next.js + Prisma + Postgres onboarding flow)
---

# BudgetApp verify recipe

## Prereqs
- Local Postgres via Homebrew: `brew services start postgresql@16`, db `budgetapp_dev` already created.
- `.env` has `DATABASE_URL` + `AUTH_SECRET` (gitignored, not in repo).

## Launch
```bash
npm run dev   # http://localhost:3000
```
Root `/` redirects based on session + `User.onboardingCompletedAt`:
unauth -> `/login`, incomplete -> `/onboarding` (resumes at first incomplete step), done -> `/dashboard`.

## Drive it (real browser — forms use client hooks like useActionState)
Playwright is a devDependency. System Chrome works without downloading Chromium:
```js
const browser = await chromium.launch({ channel: "chrome" });
```
Flow to drive: `/signup` -> `/onboarding/income` (fill name + grossMonthlyAmount, check
live preview math in `.preview-box`) -> `/onboarding/expenses` (fill all
`input[placeholder="0.00"]`) -> `/onboarding/accounts` (fill checking + optionally
"+ Add account" for a CREDIT_CARD/LOAN debt row) -> `/dashboard`.

Worth probing: duplicate signup email (clean `.error-text`), logged-out access to
`/onboarding` or `/dashboard` (bounces to `/login`), jumping ahead to a later onboarding
step before finishing an earlier one (bounces back to the earliest incomplete step),
revisiting `/onboarding` after completion (bounces to `/dashboard`).

## Verify DB state
```bash
psql -U "$USER" -d budgetapp_dev -c 'SELECT ... FROM "CycleIncomeEntry" ...'
```
Debt account types (CREDIT_CARD/LOAN/OTHER_DEBT) are stored as a **negative**
`CycleAccountBalance.amount` — the form takes a positive "amount owed" from the user.

## Gotchas
- Prisma 7's `prisma-client` generator requires an explicit driver adapter at
  runtime — `lib/prisma.ts` uses `@prisma/adapter-pg`'s `PrismaPg`. A bare
  `new PrismaClient()` throws "Expected 1 arguments, but got 0".
- `lib/panama-tax.ts` imports `Decimal` from the standalone `decimal.js` package,
  NOT from `@/app/generated/prisma/client` — the generated client bundles
  Node-only engine code that breaks if pulled into a `'use client'` component
  (it's imported by `IncomePreview.tsx` for the live preview).
- Next.js 16 renamed `middleware.ts` to `proxy.ts` (old name still works but
  warns "deprecated, use proxy instead").
