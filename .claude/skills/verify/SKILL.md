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
Flow to drive (4 steps): `/signup` -> `/onboarding/income` (fill name + grossMonthlyAmount,
check live preview math in `.preview-box`) -> `/onboarding/expenses` (fixed expenses —
starts with **zero rows**, click "+ Add a fixed expense" to add each one, no pre-added
categories) -> `/onboarding/accounts` (fill checking + optionally "+ Add account" for a
CREDIT_CARD/LOAN debt row) -> `/onboarding/savings` (savings goals — same zero-rows-allowed
pattern as expenses, "+ Add a savings goal") -> `/dashboard`. Both expenses and savings can
be submitted with zero rows and still advance.

`expenses` and `savings` share one client component, `_components/LineItemsForm.tsx` — each
row is a `.field` div containing a name input and an amount input, **both `type="text"`**
(the amount input just adds `inputMode="decimal"`). Don't select rows with a bare
`input[type="text"]` locator, it matches both fields in every row — scope by row first:
`page.locator(".field").filter({ has: page.locator('input[inputMode="decimal"]') }).nth(i)`,
then index into that row's own inputs.

Worth probing: duplicate signup email (clean `.error-text`), logged-out access to
`/onboarding` or `/dashboard` (bounces to `/login`), jumping ahead to a later onboarding
step before finishing an earlier one (bounces back to the earliest incomplete step),
revisiting `/onboarding` after completion (bounces to `/dashboard`), **submitting
expenses/savings with zero rows and then revisiting `/onboarding`** (must land on the
next step, not bounce back — this is the resumability edge case the timestamp fields
below exist to handle).

## Verify DB state
```bash
psql -U "$USER" -d budgetapp_dev -c 'SELECT ... FROM "CycleIncomeEntry" ...'
```
Debt account types (CREDIT_CARD/LOAN/OTHER_DEBT) are stored as a **negative**
`CycleAccountBalance.amount` — the form takes a positive "amount owed" from the user.

## Gotchas
- `expenses` and `savings` allow **zero rows** (fixed expenses / savings goals are both
  optional), so row-count presence can't signal "step completed" — a fresh cycle and a
  cycle where the user submitted zero rows look identical by row count. Completion is
  tracked instead via `BudgetCycle.expensesConfirmedAt` / `savingsConfirmedAt`
  (nullable timestamps, set by each step's server action regardless of row count).
  `income` and `accounts` still require ≥1 row, so they still use row-count presence.
  See `app/(onboarding)/onboarding/_lib/getOnboardingState.ts`.
- Prisma 7's `prisma-client` generator requires an explicit driver adapter at
  runtime — `lib/prisma.ts` uses `@prisma/adapter-pg`'s `PrismaPg`. A bare
  `new PrismaClient()` throws "Expected 1 arguments, but got 0".
- `lib/panama-tax.ts` imports `Decimal` from the standalone `decimal.js` package,
  NOT from `@/app/generated/prisma/client` — the generated client bundles
  Node-only engine code that breaks if pulled into a `'use client'` component
  (it's imported by `IncomePreview.tsx` for the live preview).
- Next.js 16 renamed `middleware.ts` to `proxy.ts` (old name still works but
  warns "deprecated, use proxy instead").
