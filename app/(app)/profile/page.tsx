import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signOutAction } from "./actions";
import { resetOnboardingAction } from "./dev-actions";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, createdAt: true },
  });

  return (
    <div className="home-page">
      <h1 className="page-title">Profile</h1>

      <div className="dashboard-section">
        <p className="profile-name">{user?.name}</p>
        <p className="field-hint">{user?.email}</p>
        <p className="field-hint" style={{ marginTop: "0.5rem" }}>
          Member since{" "}
          {user?.createdAt.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="dashboard-section">
        <form action={signOutAction}>
          <button type="submit" className="button button--secondary">
            Sign out
          </button>
        </form>
      </div>

      {process.env.NODE_ENV !== "production" && (
        <div className="dashboard-section">
          <h2>Developer tools</h2>
          <form action={resetOnboardingAction}>
            <button type="submit" className="button button--secondary">
              Reset onboarding (dev only)
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
