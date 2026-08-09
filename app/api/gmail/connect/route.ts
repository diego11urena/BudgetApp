import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { auth } from "@/lib/auth";
import { signGmailOAuthState } from "@/lib/gmail-oauth-state";
import { checkRateLimit } from "@/lib/rate-limit";

const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const GMAIL_CONNECT_RATE_LIMIT = { max: 5, windowMs: 60_000 };

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Keyed by userId, not IP — this route is only reachable once already
  // logged in, so blunts a compromised/scripted session hammering Google's
  // OAuth consent endpoint rather than a specific attack shape.
  const rateLimit = checkRateLimit(`gmail-connect:${session.user.id}`, GMAIL_CONNECT_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return NextResponse.redirect(new URL("/profile?gmail=rate_limited", request.url));
  }

  const redirectUri = new URL("/api/gmail/callback", request.nextUrl.origin).toString();
  const client = new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  });

  const consentUrl = client.generateAuthUrl({
    access_type: "offline",
    // Forces Google to reissue a refresh token even on a reconnect —
    // without this, a returning user who already granted access once
    // wouldn't get a new refresh_token in the callback response.
    prompt: "consent",
    scope: [GMAIL_READONLY_SCOPE],
    state: signGmailOAuthState(session.user.id),
  });

  return NextResponse.redirect(consentUrl);
}
