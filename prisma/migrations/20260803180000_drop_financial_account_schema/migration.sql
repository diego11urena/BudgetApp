-- Drop dead schema: FinancialAccount/CycleAccountBalance were fully
-- modeled but never had any UI or server action referencing them.
DROP TABLE IF EXISTS "CycleAccountBalance";
DROP TABLE IF EXISTS "FinancialAccount";
DROP TYPE IF EXISTS "BalanceSnapshotType";
DROP TYPE IF EXISTS "FinancialAccountType";
