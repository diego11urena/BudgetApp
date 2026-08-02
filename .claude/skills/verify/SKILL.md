---
name: verify
description: Build/launch/drive recipe for BudgetApp (Next.js + Prisma + Postgres onboarding flow + 5-tab app)
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

**Before launching, check nothing stale already owns port 3000**: `lsof -i :3000`. If a
`next dev` you started earlier is killed with `pkill -f "next dev"` but a `next start`
(production) server was also started at some point, `pkill -f "next start"` will **not**
catch it — the actual process name is `next-server`, not "next start". A leftover prod
server on port 3000 makes `npm run dev` silently fall back to :3001, and the user's
browser keeps hitting the stale prod server on :3000 instead — which then breaks login
entirely (see the secure-cookies-over-HTTP gotcha below), looking exactly like "login
does nothing." If dev unexpectedly starts on a port other than 3000, this is why —
`lsof -i :3000` / `pkill -f "next-server"` to clear it, then restart dev.

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

## App shell: 5-tab nav (`app/(app)/`)

All authenticated pages live under the `app/(app)/` route group (route groups don't affect
URLs — `/dashboard` is still `/dashboard`), sharing `app/(app)/layout.tsx` which centralizes
**both** the auth check (redirect `/login`) **and** the onboarding-completion check (redirect
`/onboarding`) — the latter didn't used to exist per-page, and matters now that 4 more
always-reachable routes exist (`/transactions`, `/budget`, `/goals`, `/profile`) that a
mid-onboarding user could otherwise hit directly. `proxy.ts`'s matcher covers all 5 routes.
`_components/BottomNav.tsx` is fixed-position, 5 tabs, active state via
`pathname.startsWith(href)`.

**Dev-mode gotcha**: on a narrow/mobile Playwright viewport, Next.js's floating dev-tools
indicator (`<nextjs-portal>`, bottom-left) can visually overlap the bottom nav's leftmost
(Home) tab and intercept clicks, timing out `page.click('.bottom-nav-item:has-text("Home")')`
with "subtree intercepts pointer events" — even though the exact same click works fine on a
wider viewport (already confirmed in the nav-shell-only test). This is a dev-tool artifact,
not a real bug (it doesn't exist in production, and manual clicking rarely lands exactly on
the overlap pixel). Prefer `page.goto(url)` directly over clicking nav tabs in narrow-viewport
Playwright scripts to sidestep it, rather than chasing it as a regression.

Shared pieces reused across pages: `_components/ProgressBar.tsx` (color-state: good <70%,
warning <100%, critical ≥100%), `_components/CategoryNameInput.tsx` (datalist-backed name
input — nudges reusing an exact existing category name instead of silently forking a
near-duplicate via free text), `_components/TransactionForm.tsx` /
`TransactionList.tsx` (add/list transactions, used by both Home and `/transactions`),
`_actions/transactions.ts` (`addTransactionAction`/`deleteTransactionAction` — revalidate
all 4 data pages, not just one, since any of them could be showing the affected data).

## Home (`/dashboard`)

The KPI stat tile ("Amount left this cycle" — the hero card), a top-categories
bar chart (now with per-category icons from `lib/category-icons.ts`, a keyword-based
guess, not user-configurable), an add-transaction form (`#tx-type`/`#tx-name`/`#tx-amount`,
button "Log it"), and a list of this cycle's transactions with per-row "Delete" buttons.
Quick action links (`?type=EXPENSE|INCOME|SAVINGS#log-transaction`) pre-select the form's
type — the form remounts via `key={initialType}` in `page.tsx` so the URL-driven default
actually takes effect (a plain prop update wouldn't re-sync `useState`'s initial value).
The rule-based insights card (`lib/insights.ts`, unit-tested in `lib/insights.test.ts`) shows
up to 3 of: a top-category delta vs the last closed cycle, an on-track/over-budget
restatement, an under-budget streak (≥2 cycles) — or a fallback if there's no closed-cycle
history yet.

**"Amount left" math**: `baseIncome` (sum of `CycleIncomeEntry.netAmount` for the cycle) `+`
sum of `CycleTransaction` type=INCOME `-` sum of type=EXPENSE `-` sum of type=SAVINGS. This
is driven by **actually logged transactions**, not the planned `CycleBudgetGoal` targets
from onboarding — a fixed expense set during onboarding does nothing to this number until
you separately log it happening via the transaction form. Read the value from `.kpi-value`
(strip currency formatting with something like `Number(text.replace(/[^0-9.-]/g, ""))`).

**Category linkage**: logging an EXPENSE or SAVINGS transaction upserts an `ExpenseCategory`
by `(userId, name)` — same pattern as onboarding's expenses/savings steps — so naming a
transaction the same as an existing fixed-expense category (e.g. "Rent") reuses that
category rather than creating a duplicate. INCOME transactions never get a category. Worth
checking in the DB after logging a same-named transaction: exactly one `ExpenseCategory` row
for that name, and the new `CycleTransaction.expenseCategoryId` points at it.

**Top categories chart**: only EXPENSE-type transactions feed it (grouped by category,
summed, top 5) — a SAVINGS-type transaction with the same name must NOT appear in it.
Bars are a single hue (sequential encoding, not per-category identity — see the dataviz
skill notes below), so don't expect distinct colors per bar; distinguish by the direct
label instead. Long category names truncate with ellipsis in the fixed-width label column
— that's intentional (measured, not accidentally clipped).

Worth probing on the dashboard specifically: delete a transaction and confirm both the KPI
and the chart update; log an expense large enough to make "amount left" negative and confirm
it switches to the critical/red state with explicit "you're over" text (never color alone);
try to delete another user's transaction id directly (should no-op, not error/leak).

## Transactions (`/transactions`)

All-time list across every cycle (not just current — `prisma.cycleTransaction.findMany({
where: { cycle: { userId } }, take: 100 })`), each row showing its cycle's label. Reuses the
same add/delete actions and components as Home — logging or deleting here updates Home too
(and vice versa), since both revalidate the full set of app pages.

## Budget (`/budget`)

**EXPENSE-type categories only** — SAVINGS categories are Goals' territory (explicit split,
see Goals below). Shows this cycle's `CycleBudgetGoal` rows cross-referenced against actual
spend (`getCycleFinancials(cycle.id).categoryTotals`, the *full* unsliced list, not the
top-5 `topCategories` Home uses — a goal with $0 actual spend so far still needs to show up).
Editing a target only affects *this* cycle — `closeCycleAndStartNext` copies whatever the
value is at the moment of closing, so the UI says so explicitly near the edit control. Adding
a goal upserts the category by name (same pattern as onboarding's expenses step) + upserts
`CycleBudgetGoal` for the current cycle. Removing a goal deletes only that `CycleBudgetGoal`
row (ownership-scoped `deleteMany`), not the category.

## Goals (`/goals`)

A "goal" is a **SAVINGS-type `ExpenseCategory` with `lifetimeTargetAmount` set** — not a
separate model (a `SavingsGoal` model was considered and rejected: it would've meant two
different fields both claiming to be "the target" for the same category). Progress sums
`CycleTransaction` type=SAVINGS **across every cycle** for that category (`lib/goals.ts`
`getGoalsWithProgress`), not just the current one. Also shows the current cycle's recurring
`CycleBudgetGoal` amount if one exists (e.g. carried forward from onboarding's savings step),
so that per-cycle contribution target isn't stranded now that Budget excludes SAVINGS.
"Remove goal" clears `lifetimeTargetAmount` back to `null` — it does **not** delete the
`ExpenseCategory` (that would cascade/orphan real historical rows).

**The whole feature's value depends on exact category-name matches** — logging a SAVINGS
transaction elsewhere (e.g. Home's quick actions) only moves a goal's progress bar if the
transaction's name exactly matches the goal's category name. Worth testing: create a goal
named "Emergency fund", log a SAVINGS transaction with that exact name from Home or
Transactions, confirm the Goals page progress bar updates. The `CategoryNameInput` datalist
mitigates typos/case-mismatches but doesn't prevent them if the user ignores the suggestion
and types a near-miss anyway — that's an accepted, documented limitation, not a bug to chase.

## Profile (`/profile`)

User info (name, email, member-since) and the app's **first-ever working sign-out button** —
there was previously no way to log out of this app through the UI at all. `signOutAction`
(`app/(app)/profile/actions.ts`) calls Auth.js `signOut({ redirectTo: "/login" })`. Test this
specifically: sign out → confirm redirect to `/login` → confirm a protected route (e.g.
`/dashboard`) now bounces to `/login` too (session actually cleared, not just a UI redirect)
→ sign back in. The dev-only "Reset onboarding" button (`resetOnboardingAction`) lives here
now too — moved from Home during the redesign to keep Home decluttered; the underlying
function/behavior is unchanged (`app/(app)/profile/dev-actions.ts`).

## "I just got paid" (`justGotPaidAction`, `lib/cycles.ts` `closeCycleAndStartNext`)

A cycle is now a **paycheck period, not a calendar month** — `getOrCreateDraftCycle` finds
the user's current open (DRAFT/ACTIVE) cycle regardless of date, and `BudgetCycle` no longer
has a `(userId, label)` unique constraint, so clicking the button twice in the same day
(normal in dev testing) is fine and creates two distinct closed cycles, not a constraint
error. `label` is just a display string (the start date, `YYYY-MM-DD`) now, not a dedupe key.

Clicking closes the current cycle (`status: CLOSED`, `periodEnd` set) and opens a new
`ACTIVE` one, **carrying forward** the primary `IncomeSource` (recomputed net for the new
cycle, now using real trailing-salary history for décimo if ≥4 cycles exist) and all of the
just-closed cycle's `CycleBudgetGoal` rows (fixed expenses + savings targets) — but **not**
`CycleTransaction` rows, which stay on their original (now closed) cycle forever. Worth
checking in the DB after a click: exactly the same `IncomeSource`/category ids reused (not
duplicated) across cycles, and the new cycle has zero transactions even though the old one
has some.

The **"Last paycheck" banner** (`_components/LastPaycheckBanner.tsx`) is computed fresh on
every dashboard load from `getMostRecentClosedCycle` + `getCycleFinancials` — it's not a
one-time flash message tied to the click, so it persists across reloads until the next
paycheck closes another cycle. It won't render at all if the user has never clicked the
button yet (no closed cycles exist).

## Verify DB state
```bash
psql -U "$USER" -d budgetapp_dev -c 'SELECT ... FROM "CycleIncomeEntry" ...'
```
There is no accounts/balances step anymore — `FinancialAccount`/`CycleAccountBalance`
models still exist in the schema (kept for a future proper multi-account dashboard
feature) but nothing in onboarding writes to them; expect 0 rows there always.

## Gotchas
- **Dev-only "Reset onboarding" button** on `/profile` (`app/(app)/profile/dev-actions.ts`,
  `resetOnboardingAction` — moved here from Home during the premium redesign): gated by
  `process.env.NODE_ENV !== "production"` both on the button's render and inside the action
  itself (defense in depth). Deletes the current `BudgetCycle` (cascades income/goals) and
  clears `User.onboardingCompletedAt`, then redirects to `/onboarding`. Use this instead of
  manually poking the DB when you need to re-run onboarding during testing.
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
