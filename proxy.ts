import { NextResponse, type NextRequest } from "next/server";
import {
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    accessCookieOptions,
    refreshSessionTokens,
    validateAccessToken,
} from "./app/lib/supabase/session";

/**
 * Keeps a developer's session alive without exposing anything to the browser.
 *
 * Access tokens are short lived, so when one has expired this exchanges the
 * refresh cookie for a new pair and writes them on the response. The proxy is
 * the only place that can refresh and persist cookies during a page render.
 *
 * Anything unexpected falls through untouched: a request must never fail
 * because the session store was briefly unavailable.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  // No refresh token means nothing to renew; the pages handle signed-out state.
  if (!refreshToken) return NextResponse.next();

  try {
    if (accessToken && (await validateAccessToken(accessToken))) {
      return NextResponse.next();
    }

    const session = await refreshSessionTokens(refreshToken);
    if (!session) {
      // The refresh token is dead — drop both cookies so the UI shows sign-in.
      const response = NextResponse.next();
      response.cookies.set(ACCESS_COOKIE, "", { ...accessCookieOptions(0), maxAge: 0 });
      response.cookies.set(REFRESH_COOKIE, "", { ...accessCookieOptions(0), maxAge: 0 });
      return response;
    }

    const response = NextResponse.next();
    response.cookies.set(
      ACCESS_COOKIE,
      session.accessToken,
      accessCookieOptions(Math.max(Math.min(session.expiresIn, 3600), 60)),
    );
    response.cookies.set(
      REFRESH_COOKIE,
      session.refreshToken,
      accessCookieOptions(60 * 60 * 24 * 30),
    );
    return response;
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  // Only the developer area pays for session validation.
  matcher: ["/developers/:path*", "/api/developers/:path*"],
};
