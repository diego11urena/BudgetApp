import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config (no Prisma/bcrypt). Used directly by middleware,
 * and spread into the full config in lib/auth.ts which adds the Credentials
 * provider (Node-only, since it hits Postgres and bcrypt).
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
