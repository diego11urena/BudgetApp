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
Flow to drive (3 steps, no accounts step): `/signup` -> `/onboarding/income` (fill name +
grossMonthlyAmount, check live preview math in `.preview-box`) -> `/onboarding/expenses`
(fixed expenses — starts with **zero rows**, click "+ Add a fixed expense" to add each
one, no pre-added categories) -> `/onboarding/savings` (savings goals — same
zero-rows-allowed pattern, "+ Add a savings goal") -> `/dashboard`. Both expenses and
savings can be submitted with zero rows and still advance.

`expenses` and `savings` share one client component, `_components/LineItemsForm.tsx` — each
row is a `.field` div containing a name input and an amount input, **both `type="text"`**
(the amount input just adds `inputMode="decimal"`). Don't select rows with a bare
`input[type="text"]` locator, it matches both fields in every row — scope by row first:
`page.locator(".field").filter({ has: page.locator('input[inputMode="decimal"]') }).nth(i)`,
then index into that row's own inputs.

**Back-navigation**: the step-progress bar (`_components/StepProgress.tsx`) renders the
current step and any earlier completed step as `<a aria-label="Go back to {step}">` — click
those to jump back mid-flow. Steps ahead of the current one stay plain non-interactive
`<span>`s (can't skip ahead). This only works *before* onboarding finishes — once
`onboardingCompletedAt` is set, `onboarding/layout.tsx` redirects any `/onboarding/*` hit
straight to `/dashboard` (by design — editing a finished cycle is future dashboard work,
not onboarding). Revisiting an earlier step **pre-fills** it with what was last saved
(income: name/gross/checkbox from the existing `IncomeSource`; expenses/savings: existing
`CycleBudgetGoal` rows filtered by category type) — unsaved in-progress edits on the step
you're leaving are discarded if you navigate away without submitting, same as any web form.

Worth probing: duplicate signup email (clean `.error-text`), logged-out access to
`/onboarding` or `/dashboard` (bounces to `/login`), jumping ahead to a later onboarding
step before finishing an earlier one (bounces back to the earliest incomplete step),
revisiting `/onboarding` after completion (bounces to `/dashboard`), **submitting
expenses/savings with zero rows and then revisiting `/onboarding`** (must land on the
next step, not bounce back), **editing income twice** (must update the same
`IncomeSource`/`CycleIncomeEntry` in place — check DB for exactly one row, not two),
**removing a row on expenses/savings and resubmitting** (the removed category's
`CycleBudgetGoal` must actually be gone, not orphaned).

## Verify DB state
```bash
psql -U "$USER" -d budgetapp_dev -c 'SELECT ... FROM "CycleIncomeEntry" ...'
```
There is no accounts/balances step anymore — `FinancialAccount`/`CycleAccountBalance`
models still exist in the schema (kept for a future proper multi-account dashboard
feature) but nothing in onboarding writes to them; expect 0 rows there always.

## Gotchas
- **Dev-only "Reset onboarding" button** on `/dashboard` (`app/dashboard/dev-actions.ts`,
  `resetOnboardingAction`): gated by `process.env.NODE_ENV !== "production"` both on the
  button's render and inside the action itself (defense in depth). Deletes the current
  `BudgetCycle` (cascades income/goals) and clears `User.onboardingCompletedAt`, then
  redirects to `/onboarding`. Use this instead of manually poking the DB when you need to
  re-run onboarding during testing.
- Testing a **production build locally** (`npm run build && npm start`) over plain HTTP
  breaks login entirely — Auth.js defaults session cookies to `secure: true` when
  `NODE_ENV=production`, and browsers won't send secure cookies over non-HTTPS `localhost`.
  This is an artifact of local testing, not an app bug; real deployments serve over HTTPS.
  Verifying prod-only behavior (like the reset button being absent) is better done by
  reading the compiled output/trusting the `NODE_ENV` conditional than by driving a full
  signed-in flow against a local prod server.
- `expenses` and `savings` allow **zero rows** (fixed expenses / savings goals are both
  optional), so row-count presence can't signal "step completed" — a fresh cycle and a
  cycle where the user submitted zero rows look identical by row count. Completion is
  tracked instead via `BudgetCycle.expensesConfirmedAt` / `savingsConfirmedAt`
  (nullable timestamps, set by each step's server action regardless of row count).
  `income` still requires ≥1 row, so it still uses row-count presence.
  See `app/(onboarding)/onboarding/_lib/getOnboardingState.ts`.
- Editing a step must **overwrite**, not duplicate: `income/actions.ts` looks up the
  cycle's existing `CycleIncomeEntry` and updates it + its `IncomeSource` in place if
  found (onboarding only ever supports one income source per cycle). `expenses`/
  `savings` actions do `deleteMany` on that cycle's goals (filtered by category type)
  before re-upserting the submitted set, so a removed row actually disappears instead
  of lingering.
- Prisma 7's `prisma-client` generator requires an explicit driver adapter at
  runtime — `lib/prisma.ts` uses `@prisma/adapter-pg`'s `PrismaPg`. A bare
  `new PrismaClient()` throws "Expected 1 arguments, but got 0".
- `lib/panama-tax.ts` imports `Decimal` from the standalone `decimal.js` package,
  NOT from `@/app/generated/prisma/client` — the generated client bundles
  Node-only engine code that breaks if pulled into a `'use client'` component
  (it's imported by `IncomePreview.tsx` for the live preview).
- Next.js 16 renamed `middleware.ts` to `proxy.ts` (old name still works but
  warns "deprecated, use proxy instead").
