---
name: verify
description: Build/launch/drive recipe for BudgetApp (Next.js + Prisma + Postgres onboarding flow + 4-tab app)
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
`#netQuincenaAmount` — **net take-home pay for one quincena, entered directly**, no
payroll math involved) -> `/onboarding/expenses` (fixed expenses — starts with **zero
rows**, click "+ Add a fixed expense" to add each one, no pre-added categories) ->
`/onboarding/savings` (savings goals — same zero-rows-allowed pattern, "+ Add a savings
goal") -> `/dashboard`. Both expenses and savings can be submitted with zero rows and
still advance.

**Income model (direct quincena entry, no payroll calculation)**:
`IncomeSource.netQuincenaAmount` is exactly what the user types in — their actual
take-home pay for one quincena. An earlier version of the app instead took a monthly
gross salary and derived net pay via a `lib/panama-tax.ts` module (CSS/Seguro
Educativo/ISR/Décimo Tercer Mes calculations); that module and model were removed, since
deductions are already handled elsewhere by the time the number lands in the user's
account — asking for net pay directly is both simpler and more accurate. One-off income
outside the regular paycheck (e.g. a bonus) is logged manually via "Add Income," which
already supports arbitrary one-off income by name+amount.

**Editing income later**: `/profile` has an "Edit income" row (`EditIncomeSheet.tsx`, opens
`IncomeSettingsForm.tsx` in a bottom sheet — it used to be a permanently-visible form
directly on the Profile page, now behind this row instead) calling `updateIncomeAction`
(`app/(app)/profile/actions.ts`). Updates `IncomeSource` and, if the current open cycle
already has a `CycleIncomeEntry`, updates it in place too — so the dashboard reflects a
change immediately. Past closed cycles are never touched (frozen history).

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
(income: `netQuincenaAmount` from the existing `IncomeSource`; expenses/savings: existing
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

## App shell: 4 tabs + a center "+" FAB (`app/(app)/`)

All authenticated pages live under the `app/(app)/` route group (route groups don't affect
URLs — `/dashboard` is still `/dashboard`), sharing `app/(app)/layout.tsx` which centralizes
**both** the auth check (redirect `/login`) **and** the onboarding-completion check (redirect
`/onboarding`). `proxy.ts`'s matcher covers `/onboarding`, `/dashboard`, `/transactions`,
`/budget`, `/goals`, `/profile` — two newer routes, `/history` (+ `/history/[cycleId]`) and
`/dashboard/breakdown`, sit outside that matcher but still enforce auth/onboarding at the
page level via their own `auth()` + `redirect("/login")` checks, so there's no actual gap.

`_components/BottomNav.tsx` renders **4 link-tabs, not 5**: Home (`/dashboard`), Transactions
(`/transactions`), then a center `+` FAB (opens `AddActionSheet.tsx` to pick Expense/Income/
Savings, not a navigation link), then "Fixed Expenses" (`/budget` — tab label changed from
"Budget") and Goals (`/goals`). **Profile is not a bottom-nav tab** — it's reached via the
avatar icon in `dashboard/_components/Header.tsx` (`<Link href="/profile"
className="home-profile-icon">`), shown only on Home. Active-tab state is still via
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
input — used by `goals/_components/GoalForm.tsx` and `budget/_components/BudgetGoalForm.tsx`
only; the transaction flow below uses its own chip-picker instead, not this), `_components/
TransactionList.tsx` (shared by Home's capped 3-row preview and the full `/transactions`
list — there's no separate `TransactionForm.tsx`, that file doesn't exist anymore, see Home
below), `_actions/transactions.ts` (`addTransactionAction`/`updateTransactionAction`/
`deleteTransactionAction`/`restoreTransactionAction` — `lib/revalidate.ts`'s
`revalidateAppPages()` revalidates **5** pages now: `/dashboard`, `/transactions`, `/budget`,
`/goals`, `/profile` — not 4, since Profile shows income/category state that a transaction
edit can affect too).

## Home (`/dashboard`)

**No inline add-transaction form anymore** — `TransactionForm.tsx` doesn't exist. Home is a
read-only summary: `Header.tsx` (greeting + Profile avatar link), `UncategorizedImportsBanner`
/ `NeedsDescriptionBanner` (Gmail-import follow-ups, see below), `LastPaycheckBanner`,
`HeroCard` (the hero stat, see below), `BudgetBreakdownCard`, `TopCategoriesChart`, a
`TransactionList` capped to the 3 most recent + "See all" link to `/transactions`, and
`InsightsCard`. Transactions are added via the bottom-nav "+" FAB -> `AddActionSheet.tsx`
(pick Expense/Income/Savings) -> `QuickAddSheet.tsx` — the actual amount/date/category/
payment-method/note form, submit button reads "Log it" when creating, "Save changes" when
editing (clicking an existing row in `TransactionList` reopens `QuickAddSheet` pre-filled,
in edit mode). The rule-based insights card (`lib/insights.ts`, unit-tested in
`lib/insights.test.ts`) shows up to 3 of: a top-category delta vs the last closed cycle, an
on-track/over-budget restatement, an under-budget streak (≥2 cycles) — or a fallback if
there's no closed-cycle history yet.

**Hero stat**: `HeroCard.tsx`, class `.hero-value` (not `.kpi-value`), labeled "Available to
spend" / "Remaining this Quincena" (not "Amount left this cycle"). Math: `baseIncome` (sum of
`CycleIncomeEntry.netAmount` for the cycle) `+` sum of `CycleTransaction` type=INCOME `-` sum
of type=EXPENSE `-` sum of type=SAVINGS. Driven by **actually logged transactions**, not the
planned `CycleBudgetGoal` targets from onboarding — a fixed expense set during onboarding
does nothing to this number until you separately log it happening. Savings reduces this
number but does **not** count toward Fixed budget used or the Top categories chart (those
are EXPENSE-only, see below) — a deliberate split, not an oversight.

**Category linkage**: logging any transaction (EXPENSE, SAVINGS, **or INCOME** — Income now
has its own category concept too, seeded per-user from `DEFAULT_INCOME_CATEGORIES` in
`lib/categories.ts`: Salary, Transfer, Reimbursement, Gift, Side work, Other) resolves its
category via `getOrCreateCategory(db, userId, name, type)` (`lib/categories.ts`) — a
**case-insensitive** match on `(userId, type, name)`, so "rent" reuses an existing "Rent"
instead of creating a second row, and `type` is part of the identity (a Budget "Travel" and a
Goal "Travel" are distinct rows). Backed at the DB level by a case-insensitive expression
unique index (see the race-condition migration note in Gotchas below), not just app-level
matching. Worth checking in the DB after logging a same-named transaction: exactly one
`ExpenseCategory` row for that name+type, and the new `CycleTransaction.expenseCategoryId`
points at it.

**Payment method**: EXPENSE and INCOME transactions have one (Cash/Credit Card/Debit Card/
Yappy/ACH); **SAVINGS transactions intentionally have no payment method field at all** —
category (destination) only, enforced both in `QuickAddSheet.tsx` (the field block is gated
`{type !== "SAVINGS" && (...)}`) and server-side in `_actions/transactions.ts`
(`paymentMethod: type !== "SAVINGS" ? (paymentMethod ?? null) : null`). Not a gap to "fix" if
you see a SAVINGS row with no payment method — that's correct.

**Transaction date field**: creating a new transaction bounds the date to
`[cycle.periodStart, today]` (`lib/pay-date.ts`'s `parseTransactionDate`, enforced both by the
date input's `min` and server-side in `addTransactionAction`). **Editing an existing
transaction has no cycle-start floor** — `updateTransactionAction` only checks "not in the
future," deliberately (comment in the code: "unlike addTransactionAction's create-time min").
Seeing an edited transaction's date fall before the cycle start is correct, not a bug.

**Transaction row rendering** (`_components/TransactionList.tsx`): each row shows
`Name` / `Category-or-"Uncategorized" · Payment method` (either half of the subline drops
cleanly if absent) / an amount with **direction shown only by sign and color, never a text
label** — EXPENSE is default-color with a leading `-`, INCOME is green with a leading `+`,
SAVINGS has its own color with a leading `-`. A closed-cycle row also gets a trailing 🔒
marker.

**Top categories chart**: only EXPENSE-type transactions feed it (grouped by category,
summed, top 5) — a SAVINGS-type transaction with the same name must NOT appear in it.
Bars are a single hue (sequential encoding, not per-category identity — see the dataviz
skill notes below), so don't expect distinct colors per bar; distinguish by the direct
label instead. Long category names truncate with ellipsis in the fixed-width label column
— that's intentional (measured, not accidentally clipped).

Worth probing on the dashboard specifically: delete a transaction and confirm both the hero
stat and the chart update; log an expense large enough to make "Available to spend" negative
and confirm it switches to the critical/red state with explicit "you're over" text (never
color alone); try to delete another user's transaction id directly (should no-op, not
error/leak).

## Transactions (`/transactions`)

All-time list across every cycle (not just current), each row showing its cycle's label.
Reuses the same `TransactionList`/actions as Home — logging or deleting here updates Home too
(and vice versa), since both are covered by `revalidateAppPages()`. Has real filtering/
sorting now (`_components/TransactionFilters.tsx`, not in earlier versions of this doc):
search by name/category, filter by type/payment method/category (including "uncategorized"),
sort by date/amount.

## Fixed Expenses (`/budget` — page heading is "Fixed Expenses", route is still `/budget`)

**EXPENSE-type categories only** — SAVINGS categories are Goals' territory (explicit split,
see Goals below). Shows this cycle's `CycleBudgetGoal` rows cross-referenced against actual
spend (`getCycleFinancials(cycle.id).categoryTotals`, the *full* unsliced list, not the
top-5 `topCategories` Home uses — a goal with $0 actual spend so far still needs to show up).
Editing a target only affects *this* cycle — `closeCycleAndStartNext` copies whatever the
value is at the moment of closing, so the UI says so explicitly near the edit control. Adding
a goal upserts the category via `getOrCreateCategory` (same case-insensitive resolution as
transactions) + upserts `CycleBudgetGoal` for the current cycle
(`budget/actions.ts` `upsertBudgetGoalAction`). Removing a goal
(`deleteBudgetGoalAction`) does an ownership-scoped `findFirst` then `delete` on that one
`CycleBudgetGoal` row — **not** a `deleteMany`, though the net effect (only that row is
removed, category untouched) is the same.

Each category also has a **recurring toggle + frequency** (`RecurringToggle.tsx`/
`RecurringFrequencyControl.tsx` -> `toggleCategoryRecurringAction`/
`updateCategoryFrequencyAction`, `budget/actions.ts`): BIWEEKLY (default, carries into every
new cycle) or MONTHLY + a `dueDay` (carries into only the one quincena per month matching that
day). This directly controls what "I just got paid" carries forward — see below.

## Goals (`/goals`)

A "goal" is a **SAVINGS-type `ExpenseCategory` with `lifetimeTargetAmount` set** — not a
separate model (a `SavingsGoal` model was considered and rejected: it would've meant two
different fields both claiming to be "the target" for the same category). Progress sums
`CycleTransaction` type=SAVINGS **across every cycle** for that category (`lib/goals.ts`
`getGoalsWithProgress`), not just the current one. Also shows the current cycle's recurring
`CycleBudgetGoal` amount if one exists (e.g. carried forward from onboarding's savings step),
so that per-cycle contribution target isn't stranded now that Budget excludes SAVINGS.
"Remove goal" (`removeGoalAction`) clears `lifetimeTargetAmount` back to `null`, sets
`recurring: false`, and clears the current cycle's `CycleBudgetGoal` — it does **not** delete
the `ExpenseCategory` (that would cascade/orphan real historical rows). `ContributeButton.tsx`
lets you log a SAVINGS transaction toward a goal directly from this page, and
`lib/goal-projection.ts`'s `computeGoalProjection` shows an ETA ("on track to hit goal by
{date}" or "Goal reached!") based on recent contribution pace — neither of these existed in
earlier versions of this doc.

**The whole feature's value depends on exact category-name matches** — logging a SAVINGS
transaction elsewhere only moves a goal's progress bar if the transaction's category matches
the goal's category (case-insensitively, per `getOrCreateCategory` — see Home above). Worth
testing: create a goal named "Emergency fund", log a SAVINGS transaction with that category
from Home's "+" or Transactions, confirm the Goals page progress bar updates.

## Profile (`/profile`)

Grew well beyond user info + sign-out since this doc was last accurate. Current contents:
- User info (name, email, member-since) and sign-out (`signOutAction`, Auth.js
  `signOut({ redirectTo: "/login" })`). Test: sign out -> confirm redirect to `/login` ->
  confirm a protected route (e.g. `/dashboard`) now bounces to `/login` too (session actually
  cleared) -> sign back in.
- **Edit income** (`EditIncomeSheet.tsx`, see "Editing income later" above).
- **Change password** (`ChangePasswordSheet.tsx` / `ChangePasswordForm.tsx` ->
  `changePasswordAction`, rate-limited via `lib/rate-limit.ts`'s `checkRateLimit`).
- **Connect Gmail** (`GmailConnectionCard.tsx`) — import status/errors surfaced via
  `?gmail=error` / `?gmail=rate_limited` query params; see `profile/gmail-actions.ts` and
  `lib/gmail-sync.ts`.
- **Manage categories** -> `/profile/categories` (`ManageCategories.tsx`,
  `CategorySearchList.tsx`, `profile/category-actions.ts`) — rename/merge categories.
- **History** -> `/history` (+ `/history/[cycleId]`) — list of past closed quincenas.
- **Reset** section, `EraseCyclesButton.tsx` -> `profile/cycle-actions.ts` — a
  **user-facing, production-available** "wipe your quincena history, keep categories/income
  setup" reset. This is distinct from the dev-only onboarding reset below; don't confuse the
  two when testing.
- Dev-only **"Reset onboarding"** button (`DevResetButton.tsx` -> `resetOnboardingAction`,
  `app/(app)/profile/dev-actions.ts`), gated by `process.env.NODE_ENV !== "production"` both
  on render and inside the action. Deletes the current `BudgetCycle` (cascades income/goals)
  and clears `User.onboardingCompletedAt`, then redirects to `/onboarding`. Use this instead
  of manually poking the DB when you need to re-run onboarding during testing.

## "I just got paid" (`HeroCard.tsx` -> `justGotPaidAction` -> `lib/cycles.ts` `closeCycleAndStartNext`)

**Multi-step flow, not a single click-to-close button**:
1. "I just got paid" on `HeroCard.tsx` opens `ConfirmJustGotPaidSheet.tsx` — the user
   picks/confirms the actual pay date (not necessarily "now"; bounded by
   `PAY_DATE_LOOKBACK_DAYS`, see `lib/pay-date.ts`).
2. Confirming calls `justGotPaidAction(payDate)` (`dashboard/actions.ts`), which calls
   `closeCycleAndStartNext(userId, payDate)`; `CycleClosedCard.tsx` then shows a summary
   overlay (spent/saved/rolled-over/top-category/budget-vs-actual for the closed cycle).
3. Dismissing that opens `NewCycleIncomeSheet.tsx` to confirm/adjust the carried-forward
   income amount for the new cycle before it's actually used.

A cycle is a **paycheck period, not a calendar month** — `getOrCreateDraftCycle` finds the
user's current open (DRAFT/ACTIVE) cycle regardless of date (now guaranteed unique per user
by a DB constraint, see Gotchas below), and `BudgetCycle` has no `(userId, label)` unique
constraint, so closing twice in the same day is fine. `label` is just a display string (the
start date, `YYYY-MM-DD`), not a dedupe key.

Closing sets `status: CLOSED`/`periodEnd` on the old cycle and creates a new `ACTIVE` one,
carrying forward the primary `IncomeSource` (`netQuincenaAmount` copied as-is, then
overridable via step 3 above). **`CycleBudgetGoal` carry-forward is conditional, not
unconditional**: only categories with `recurring: true` carry forward at all, and
`shouldCarryForwardToCycle` (`lib/cycles.ts`) further gates it by frequency — BIWEEKLY
carries into every new cycle, MONTHLY only into the one quincena per month matching the
category's `dueDay`. A category with `recurring: false`, or a MONTHLY one whose `dueDay`
doesn't match the new cycle, correctly does **not** get a `CycleBudgetGoal` row in the new
cycle — that's not a bug. `CycleTransaction` rows never carry forward; they stay on their
original (now closed) cycle forever.

The **"Last paycheck" banner** (`dashboard/_components/LastPaycheckBanner.tsx` — note: under
`dashboard/_components/`, not the shared `_components/` dir) is computed fresh on every
dashboard load from `getMostRecentClosedCycle` + `getCycleFinancials` — it's not a one-time
flash message tied to the click, so it persists across reloads until the next paycheck closes
another cycle. It won't render at all if the user has never closed a cycle yet.

## Verify DB state
```bash
psql -U "$USER" -d budgetapp_dev -c 'SELECT ... FROM "CycleIncomeEntry" ...'
```
There is no accounts/balances step anymore — `FinancialAccount`/`CycleAccountBalance`
models still exist in the schema (kept for a future proper multi-account dashboard
feature) but nothing in onboarding writes to them; expect 0 rows there always.

## Gotchas
- **Theme**: "Subtle Gradient" design system — Gradient Indigo brand (`--color-button-bg`
  etc.), near-black text, cool-gray neutrals, white surfaces — **not** the old warm
  cream/pastel-green palette an earlier version of this doc described. All colors live as
  CSS custom properties at `:root` (+ a `prefers-color-scheme: dark` override block) in
  `app/globals.css` — never hardcode a hex color in a new rule, use the existing
  `var(--color-*)` roles (`--color-bg`, `--color-card` — deliberately distinct from the page
  background so cards visually lift — `--color-text-secondary`,
  `--color-success`/`--color-warning`/`--color-error` + their `-bg` tint variants). Fonts are
  Manrope (`--font-manrope`, headings/display via `--font-display`) + Inter
  (`--font-inter`, body text) via `next/font/google` in `app/layout.tsx` — not Geist. A small
  `--radius-*` scale exists (`--radius-sm`/`--radius-button`/`--radius-pill`/etc.) — buttons
  cap at 12px (`--radius-button`), never pill-shaped; chips/badges use `--radius-pill`.
- **Race-condition DB constraints**: three partial/expression unique indexes exist only via
  hand-written migration SQL, not representable in `schema.prisma`'s DSL — see
  `prisma/migrations/20260815035814_race_condition_partial_unique_indexes`: at most one
  `BudgetCycle` per user with `status IN (DRAFT, ACTIVE)`, at most one `IncomeSource` per user
  with `isActive = true`, and case-insensitive `(userId, name, type)` uniqueness on
  `ExpenseCategory` (on top of the schema-native case-sensitive one). `getOrCreateDraftCycle`
  (`lib/cycles.ts`), `getOrCreateCategory` (`lib/categories.ts`), and the onboarding income
  action's income-source creation all rely on catching that constraint's P2002 violation and
  re-reading the winner, not on the find-before-create check being reliable on its own — see
  `lib/cycles.concurrency.test.ts` / `lib/categories.concurrency.test.ts` (real-Postgres
  tests, skipped unless `DATABASE_URL` is set — they run in the E2E CI job, not the fast
  no-DB one).
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
  user's existing active `IncomeSource` (now DB-guaranteed unique, see the race-condition
  bullet above) and the cycle's existing `CycleIncomeEntry`, updating both in place if found.
  `expenses`/`savings` actions do `deleteMany` on that cycle's goals (filtered by category
  type) before re-upserting the submitted set, so a removed row actually disappears instead
  of lingering.
- Prisma 7's `prisma-client` generator requires an explicit driver adapter at
  runtime — `lib/prisma.ts` uses `@prisma/adapter-pg`'s `PrismaPg`. A bare
  `new PrismaClient()` throws "Expected 1 arguments, but got 0".
- Next.js 16 renamed `middleware.ts` to `proxy.ts` (old name still works but
  warns "deprecated, use proxy instead").
