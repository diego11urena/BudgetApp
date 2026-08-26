import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

const PROTECTED_PREFIXES = [
  "/onboarding",
  "/dashboard",
  "/transactions",
  "/budget",
  "/goals",
  "/history",
  "/profile",
];

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isProtectedRoute && !isLoggedIn) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: [
    "/onboarding/:path*",
    "/dashboard/:path*",
    "/transactions/:path*",
    "/budget/:path*",
    "/goals/:path*",
    "/history/:path*",
    "/profile/:path*",
  ],
};
