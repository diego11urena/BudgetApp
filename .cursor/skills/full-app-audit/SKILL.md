---
name: full-app-audit
description: Runs a whole-repo audit of Balboa (this Next.js + Prisma budgeting app) covering architecture, security, product gaps, tests, UX, and over-engineering. Use when the user says "audit the app", "full audit", "entire audit", "audit this codebase", or asks for an architecture/security/product review of the whole project. Reports only; does not apply fixes unless the user explicitly asks.
---

# Full-app audit (Balboa)

One-shot, repo-wide review. **Do not edit application code.** List findings with evidence. If the user later asks to fix items, leave this skill and implement normally.

Treat **live code** as source of truth. `.claude/skills/verify/SKILL.md` is a driving recipe and can be stale — flag doc drift as a finding, do not treat the recipe as a bug in the app.

## Workflow

1. Map the app: `prisma/schema.prisma`, `proxy.ts`, `lib/auth.ts`, `app/(app)/layout.tsx`, `app/(onboarding)/onboarding/_lib/getOnboardingState.ts`, `app/(app)/_components/BottomNav.tsx`, `package.json`, `tests/e2e/`.
2. Hunt each lane below. Prefer `Grep`/`Glob` over guessing. Before `dead`/`unused`, search the whole tree including tests, fixtures, and string references.
3. Run cheap signals if they finish quickly: `npx tsc --noEmit`, `npm test`, `npm run lint`. Do not start a long E2E suite unless the user asked. Note what you did not run.
4. Deliver findings as a **Cursor canvas** (architecture/security review). Chat gets a short summary + a markdown link to the `.canvas.tsx` file. Follow `~/.cursor/skills-cursor/canvas/SKILL.md` (write under the workspace `canvases/` directory, import only from `cursor/canvas`, no empty states, no emoji/gradients/box-shadows).
5. Stop. Do not start fixing.

## Lanes (cover all unless the user narrowed scope)

### 1. Architecture and data model

- Auth/session vs onboarding vs app-shell checks: `proxy.ts` matcher vs page-level `auth()`. Look for protected routes missing from the matcher **and** missing a page-level guard (`/history`, `/dashboard/breakdown`, `/plan`, `/dashboard/summary`, Gmail API routes).
- Cycle model: unique open cycle, close/carry-forward, `findCycleForDate` vs `periodEnd` same-day behavior, History add vs current cycle.
- Categories: `getOrCreateCategory` case-insensitive identity, EXPENSE vs SAVINGS vs INCOME types, goal progress depending on name+type match.
- Leftover models (`FinancialAccount`, `CycleAccountBalance`, unused tables/fields) vs code that still writes them.
- Server actions: ownership scoping (`userId` on every mutation), `revalidateAppPages()` covering every surface that reads the mutated data.
- Prisma 7: adapter in `lib/prisma.ts`; no bare `new PrismaClient()`.

### 2. Security

- Auth: Google-only in production; `E2E_TEST_LOGIN` credentials provider must not exist without that env and must not ship on Vercel.
- IDOR: every `update`/`delete`/`find` on transactions, cycles, goals, categories, Gmail state must be user-scoped. A foreign id should no-op or 404, never leak.
- Gmail: OAuth state (`lib/gmail-oauth-state.ts`), callback CSRF, token storage, sync route auth, rate limits (`lib/rate-limit.ts`).
- Secrets: `.env` not committed; no secrets in client components; `AUTH_SECRET`, Google, Gmail, DB URLs.
- Destructive actions: delete account, erase cycles, delete closed cycle, merge categories — confirm + server-side ownership.
- Dev-only gates: `resetOnboardingAction` / `DevResetButton` require `NODE_ENV !== "production"` on **both** render and action.
- Cookies/HTTPS: do not flag Auth.js `secure` cookies failing on local `npm start` over HTTP as an app bug (known local-prod artifact).
- XSS: user-entered names/notes rendered safely; no `dangerouslySetInnerHTML` with untrusted data.

### 3. Product completeness

Walk the real user journeys against the **current** UI (nav labels and routes may have changed):

- Unauth `/` → login; incomplete onboarding resume; completed → dashboard.
- Onboarding: income (net quincena, not payroll math), expenses/savings-or-goals zero-rows-allowed, step back-nav, no skip-ahead, post-complete `/onboarding/*` → dashboard.
- App shell: tabs + center `+` FAB → Expense/Income/Savings; Profile from Home avatar (not a tab unless code changed).
- Home hero math: income entries + INCOME tx − EXPENSE − SAVINGS; fixed goals do not move the hero until logged. SAVINGS is not in top-categories / fixed-budget used.
- Transactions: filters, edit/delete/restore, date bounds (create vs edit), payment method omitted for SAVINGS.
- Fixed expenses vs Goals split; recurring BIWEEKLY vs MONTHLY `dueDay`; "I just got paid" → confirm pay date → summary of closed cycle.
- Gmail import follow-ups (uncategorized / needs description).
- i18n: user-visible strings should not be English-only hardcoded if `lib/i18n` is the source of truth — flag mixed/untranslated UI.

Intentional, **not** bugs unless code contradicts them:

- SAVINGS has no payment method.
- Edit-transaction date may fall before cycle start; create may not.
- Zero-row expenses/savings still complete the onboarding step via `expensesConfirmedAt` / `savingsConfirmedAt`.
- `FinancialAccount` unused in onboarding is deferred, not an accidental hole, unless new code started depending on it half-way.

### 4. Tests

- Unit: `*.test.ts` next to `lib/` validators, cycles, categories, insights, gmail parsers, rate-limit, concurrency tests (skipped without `DATABASE_URL`).
- E2E: `tests/e2e/*.spec.ts` vs current routes. Flag flows with **no** spec: onboarding, login bounce, just-got-paid, Gmail (may be untestable), delete account, category merge, `/plan` if shipped.
- Brittle locators (bare `input[type="text"]` on shared name+amount rows).
- `E2E_TEST_LOGIN=1` + `signInAs` required; Playwright starts its own `npm run dev`.

### 5. UX and consistency

- Empty, error, loading, and over-budget (negative available) states. Color is not the only signal.
- Sheets/focus (`useModalFocus`), disabled submit, validation messages translated.
- Theme: colors via `var(--color-*)` in `app/globals.css`; no new hardcoded hex. Buttons use `--radius-button` (not pills); chips may use `--radius-pill`.
- Mobile bottom nav vs overlapping chrome; closed-cycle lock affordance.

### 6. Over-engineering (complexity only)

Rank biggest cut first. Tags:

- `delete:` dead code / unused flexibility. Replacement: nothing. Grep first.
- `stdlib:` hand-rolled thing the platform/stdlib already ships.
- `native:` Next/Prisma/Auth.js already does this.
- `reuse:` duplicate helper already in-repo — name the path.
- `yagni:` one-implementation abstraction, unused config.
- `shrink:` same logic, fewer lines.

Do not mix bugs into this lane.

## Finding format

Each finding needs:

| Field | Rule |
|---|---|
| Severity | `blocker` (wrong money, auth bypass, data loss, IDOR) / `high` / `medium` / `low` / `nit` |
| Lane | architecture, security, product, tests, ux, bloat |
| Title | one line |
| Evidence | path + why (what you grepped/read). No vibes. |
| Impact | user-visible or security consequence |
| Fix | one-sentence direction, not a patch |

Skip style nits unless they hide a real bug. Cap chat summary at the **top 8** by severity, then totals per lane. Canvas holds the full table, grouped by lane, with counts.

If nothing material: say the app is in good shape, list residual nits only, still produce a short canvas with counts (including zeros omitted — do not render empty sections).

## Canvas content

Title: **Balboa full-app audit** plus the audit date. Include:

- Headline stats: finding counts by severity
- Top blockers/highs as a compact table (title, lane, path)
- One section per lane that has findings
- "Not run" (E2E, production build, live Gmail, etc.)
- Caption: source = this repo at HEAD / working tree; not a pentest

Do not apply fixes. Do not open a PR. Do not commit.
