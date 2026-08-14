-- Data-fix, no schema change (the enum value itself landed in the prior
-- migration). Seeds a starter set of INCOME categories for every existing
-- user, mirroring how Expense/Savings categories work once you've added a
-- few by hand -- except Income previously had no category concept at all,
-- so there's nothing organic to build on yet. Names are a starting point
-- (renameable/mergeable in Profile like any other category); "Other" is a
-- catch-all, not a protected system category.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO "ExpenseCategory" (id, "userId", name, type, "createdAt")
SELECT gen_random_uuid()::text, u.id, cat.name, 'INCOME', now()
FROM "User" u
CROSS JOIN (
  VALUES ('Salary'), ('Transfer'), ('Reimbursement'), ('Gift'), ('Side work'), ('Other')
) AS cat(name)
ON CONFLICT ("userId", name, type) DO NOTHING;
