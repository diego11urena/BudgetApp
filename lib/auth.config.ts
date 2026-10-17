import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config (no Prisma). Used directly by proxy.ts, and
 * spread into the full config in lib/auth.ts, which adds the providers and
 * the database-backed callbacks.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
    // A refused or failed Google sign-in lands back on /login?error=...
    // instead of Auth.js's own unstyled error page.
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
