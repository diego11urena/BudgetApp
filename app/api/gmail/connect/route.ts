import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { auth } from "@/lib/auth";
import { signGmailOAuthState } from "@/lib/gmail-oauth-state";

const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
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
