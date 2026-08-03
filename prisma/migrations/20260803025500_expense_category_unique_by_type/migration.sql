-- DropIndex
DROP INDEX "ExpenseCategory_userId_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_userId_name_type_key" ON "ExpenseCategory"("userId", "name", "type");
