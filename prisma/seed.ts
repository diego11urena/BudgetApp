import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

async function main() {
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
