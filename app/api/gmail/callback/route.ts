import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/gmail-crypto";
import { verifyGmailOAuthState } from "@/lib/gmail-oauth-state";
import { checkRateLimit } from "@/lib/rate-limit";

const GMAIL_CALLBACK_RATE_LIMIT = { max: 5, windowMs: 60_000 };

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const stateUserId = state ? verifyGmailOAuthState(state) : null;

  // stateUserId must match the currently-logged-in session — prevents this
  // callback being used to attach Gmail access to the wrong account.
  if (!code || !stateUserId || stateUserId !== session.user.id) {
    return NextResponse.redirect(new URL("/profile?gmail=error", request.url));
  }

  // Keyed by the verified stateUserId (== session.user.id at this point) —
  // this endpoint performs a real token exchange with Google and a DB
  // write per call, so it's worth throttling independently of /connect
  // even though a normal user only ever hits it once per connect attempt.
  const rateLimit = checkRateLimit(`gmail-callback:${stateUserId}`, GMAIL_CALLBACK_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return NextResponse.redirect(new URL("/profile?gmail=rate_limited", request.url));
  }

  const redirectUri = new URL("/api/gmail/callback", request.nextUrl.origin).toString();
  const client = new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  });

  try {
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
      // /connect always sets prompt: "consent", so a missing refresh_token
      // here means something went wrong with the flow itself, not just a
      // routine reconnect.
      return NextResponse.redirect(new URL("/profile?gmail=error", request.url));
    }

    client.setCredentials(tokens);
    const profileRes = await client.request<{ emailAddress: string }>({
      url: "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    });

    // lastSyncedAt is set to "now" here (not left null) on both create and
    // reconnect: syncGmailTransactions treats it as the forward-only cutoff,
    // so this is what makes a reconnect start fresh from this moment rather
    // than falling back to a stale original createdAt from months ago.
    const connectedNow = new Date();
    await prisma.gmailConnection.upsert({
      where: { userId: stateUserId },
      create: {
        userId: stateUserId,
        encryptedRefreshToken: encryptToken(tokens.refresh_token),
        googleEmail: profileRes.data.emailAddress,
        lastSyncedAt: connectedNow,
      },
      update: {
        encryptedRefreshToken: encryptToken(tokens.refresh_token),
        googleEmail: profileRes.data.emailAddress,
        lastSyncedAt: connectedNow,
        lastSyncError: null,
      },
    });

    return NextResponse.redirect(new URL("/profile?gmail=connected", request.url));
  } catch {
    return NextResponse.redirect(new URL("/profile?gmail=error", request.url));
  }
}
