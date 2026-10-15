import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

// Every path config.matcher sends here is a protected app route -- the
// matcher is the single list of them, so there's no second one to keep in sync.
export default auth((req) => {
  if (!req.auth) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: [
    "/onboarding/:path*",
    // Its own sibling path (not nested under /onboarding/), since it
    // deliberately sits outside app/(onboarding)/onboarding/layout.tsx's
    // guard -- see onboarding-complete/page.tsx's own comment. Matched
    // separately since the wildcard above requires a path segment after
    // "onboarding/".
    "/onboarding-complete",
    "/dashboard/:path*",
    "/transactions/:path*",
    "/budget/:path*",
    "/goals/:path*",
    "/plan/:path*",
    "/history/:path*",
    "/profile/:path*",
  ],
};
