import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCategoryUsageStats } from "@/lib/category-usage";
import { IncomeCategoryManagerScreen } from "./_components/IncomeCategoryManagerScreen";
import type { CategoryWithUsage } from "../_components/types";

export default async function ManageIncomeCategoriesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const [rawCategories, usageStats] = await Promise.all([
    prisma.expenseCategory.findMany({
      where: { userId, type: "INCOME" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, icon: true, color: true },
    }),
    getCategoryUsageStats(userId, "INCOME"),
  ]);

  const categories: CategoryWithUsage[] = rawCategories.map((c) => {
    const usage = usageStats.get(c.id);
    return {
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      transactionCount: usage?.transactionCount ?? 0,
      totalAmount: usage?.totalAmount ?? 0,
      hasBudgetGoal: usage?.hasBudgetGoal ?? false,
      isUnused: usage?.isUnused ?? true,
    };
  });

  return (
    <div className="home-page">
      <Link href="/profile/categories" className="back-link">
        <ChevronLeft size={16} aria-hidden="true" /> Back
      </Link>
      <h1 className="page-title">Income Categories</h1>
      <p className="field-hint" style={{ marginBottom: "1rem" }}>
        Rename a typo&apos;d category, or merge two into one.
      </p>

      <IncomeCategoryManagerScreen categories={categories} />
    </div>
  );
}
