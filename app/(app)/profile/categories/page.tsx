import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CategorySearchList } from "./_components/CategorySearchList";

export default async function ManageCategoriesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const categories = await prisma.expenseCategory.findMany({
    where: { userId },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: { id: true, name: true, type: true },
  });

  return (
    <div className="home-page">
      <Link href="/profile" className="back-link">
        <ChevronLeft size={16} aria-hidden="true" /> Back
      </Link>
      <h1 className="page-title">Manage Categories</h1>
      <p className="field-hint" style={{ marginBottom: "1rem" }}>
        Rename a typo&apos;d category, or merge two into one — moves all its transactions and
        budget history along with it.
      </p>

      <div className="dashboard-section">
        {categories.length === 0 ? (
          <p className="field-hint">No categories yet.</p>
        ) : (
          <CategorySearchList categories={categories} />
        )}
      </div>
    </div>
  );
}
