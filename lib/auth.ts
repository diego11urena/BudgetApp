import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validations/onboarding";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // Overrides authConfig's edge-safe session() with a Postgres-backed
    // one -- only possible here (Node runtime), not in proxy.ts's edge
    // middleware. Compares the version baked into this token at sign-in
    // against the account's current one; a mismatch means the password
    // was changed (or "Log out everywhere" was used) since this session
    // was issued, so it's treated as logged out from this point on,
    // exactly like an expired/missing session everywhere else in the app
    // (every page already does `if (!session?.user?.id) redirect(...)`).
    async session({ session, token }) {
      if (!session.user || typeof token.id !== "string") {
        return session;
      }
      const dbUser = await prisma.user.findUnique({
        where: { id: token.id },
        select: { sessionVersion: true },
      });
      if (!dbUser || dbUser.sessionVersion !== (token.sessionVersion ?? 0)) {
        // Deliberately leave session.user.id unset rather than fabricate
        // a "no session" shape -- every page in the app already gates on
        // `if (!session?.user?.id) redirect("/login")`, so an id-less
        // user is treated as logged out with no special-casing needed
        // anywhere else.
        return session;
      }
      session.user.id = token.id;
      return session;
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user) return null;

        const isValid = await verifyPassword(parsed.data.password, user.hashedPassword);
        if (!isValid) return null;

        return { id: user.id, email: user.email, name: user.name, sessionVersion: user.sessionVersion };
      },
    }),
  ],
});
