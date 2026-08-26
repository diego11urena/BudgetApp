import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCategoryUsageStats } from "@/lib/category-usage";
import { findPossibleDuplicates } from "@/lib/category-duplicates";
import { CategoryManagerScreen } from "./_components/CategoryManagerScreen";
import type { CategoryWithUsage } from "./_components/types";
import type { DuplicatePairWithUsage } from "./_components/CategoryCleanupSection";

export const metadata: Metadata = { title: "Manage Categories" };

export default async function ManageCategoriesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const [rawCategories, usageStats] = await Promise.all([
    prisma.expenseCategory.findMany({
      where: { userId, type: "EXPENSE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, icon: true, color: true },
    }),
    getCategoryUsageStats(userId, "EXPENSE"),
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

  const byId = new Map(categories.map((c) => [c.id, c]));
  const duplicates: DuplicatePairWithUsage[] = findPossibleDuplicates(categories)
    .map((pair) => ({ a: byId.get(pair.a.id), b: byId.get(pair.b.id) }))
    .filter((pair): pair is DuplicatePairWithUsage => Boolean(pair.a && pair.b));

  return (
    <div className="home-page">
      <Link href="/profile" className="back-link">
        <ChevronLeft size={16} aria-hidden="true" /> Back
      </Link>
      <h1 className="page-title">Manage Categories</h1>

      <CategoryManagerScreen categories={categories} duplicates={duplicates} />
    </div>
  );
}
