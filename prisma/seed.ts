import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

async function main() {
  // A well-known, printed-to-stdout credential -- fine for a disposable
  // local/CI database, never for one holding real accounts. Same guard
  // dev-actions.ts's resetOnboardingAction already uses.
  if (process.env.NODE_ENV === "production") {
    console.log("Skipping demo user seed in production.");
    return;
  }

  const email = "demo@example.com";
  const password = "password123";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Demo user already exists: ${email}`);
    return;
  }

  const hashedPassword = await hashPassword(password);
  await prisma.user.create({
    data: { email, hashedPassword, name: "Demo User" },
  });

  console.log(`Created demo user: ${email} / ${password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
