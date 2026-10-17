import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { seedDefaultIncomeCategories } from "@/lib/categories";
import { isUniqueConstraintViolation } from "@/lib/prisma-errors";
import { LOCALE_COOKIE, getRequestLocale } from "@/lib/i18n/locale";

const userSelect = { id: true, sessionVersion: true, locale: true } as const;

/**
 * Google is the only way in, so first sign-in IS signup. Matched by email
 * (case-insensitively -- accounts from the old email/password signup keep
 * their data), created otherwise. A new account takes whatever language
 * the visitor was already browsing in, and gets the starter income
 * categories in the same transaction (onboarding's income step has an
 * empty picker without them).
 */
async function findOrCreateUser(email: string, name: string | null | undefined) {
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: userSelect,
  });
  if (existing) return existing;

  const locale = (await getRequestLocale()).toUpperCase() as "EN" | "ES";
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, name, locale }, select: userSelect });
      await seedDefaultIncomeCategories(tx, user.id);
      return user;
    });
  } catch (error) {
    // Two first sign-ins racing on the same email -- the unique
    // constraint picks one winner; the loser just uses it.
    if (!isUniqueConstraintViolation(error)) throw error;
    return prisma.user.findUniqueOrThrow({ where: { email }, select: userSelect });
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    signIn({ account, profile }) {
      // Matching by email is only safe when Google vouches for it.
      if (account?.provider === "google") return profile?.email_verified === true;
      return true;
    },
    async jwt({ token, user, account }) {
      // `account` is only present on the sign-in request itself.
      if (account && user?.email) {
        const dbUser = await findOrCreateUser(user.email, user.name);
        token.id = dbUser.id;
        // Compared against the live value in session() below -- see there.
        token.sessionVersion = dbUser.sessionVersion;
        // A fresh browser should show the account's own language, not the
        // anonymous-visitor default.
        (await cookies()).set(LOCALE_COOKIE, dbUser.locale.toLowerCase(), {
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
          sameSite: "lax",
        });
      }
      return token;
    },
    // Overrides authConfig's edge-safe session() with a Postgres-backed
    // one. Compares the version baked into this token at sign-in against
    // the account's current one; a mismatch means "Log out everywhere"
    // was used since this session was issued, so it's treated as logged
    // out from this point on (every page already does
    // `if (!session?.user?.id) redirect(...)`).
    async session({ session, token }) {
      if (!session.user || typeof token.id !== "string") {
        return session;
      }
      const dbUser = await prisma.user.findUnique({
        where: { id: token.id },
        select: { sessionVersion: true },
      });
      if (!dbUser || dbUser.sessionVersion !== (token.sessionVersion ?? 0)) {
        return session;
      }
      session.user.id = token.id;
      return session;
    },
  },
  providers: [
    Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }),
    // E2E only: a browser test can't click through Google's consent screen.
    // Signs in as any email with no secret, so it must never exist on a
    // deployed app -- off unless the test runner sets E2E_TEST_LOGIN, and
    // refused outright on Vercel even if someone sets it there.
    ...(process.env.E2E_TEST_LOGIN === "1" && !process.env.VERCEL
      ? [
          Credentials({
            id: "e2e",
            credentials: { email: {} },
            authorize: (c) => (typeof c.email === "string" ? { email: c.email, name: "E2E Tester" } : null),
          }),
        ]
      : []),
  ],
});
