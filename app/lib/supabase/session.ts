/**
 * Session plumbing shared by the developer pages, the API routes and the
 * proxy. Deliberately free of `next/headers` so it can run anywhere.
 *
 * The client only ever sees two opaque httpOnly cookies.
 */

import { getSupabaseServerClient } from "./server";

export const ACCESS_COOKIE = "sere_dev_access";
export const REFRESH_COOKIE = "sere_dev_refresh";

export const ACCESS_MAX_AGE_SECONDS = 60 * 60;
export const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SessionUser {
  id: string;
  email: string | null;
  createdAt: string | null;
}

export function toSessionTokens(session: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}): SessionTokens {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in,
  };
}

export function accessCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function refreshCookieOptions() {
  return accessCookieOptions(REFRESH_MAX_AGE_SECONDS);
}

/** Trades a refresh token for a new session. Returns null when it is dead. */
export async function refreshSessionTokens(
  refreshToken: string,
): Promise<SessionTokens | null> {
  const client = getSupabaseServerClient();
  if (!client) return null;

  const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) return null;

  return toSessionTokens(data.session);
}

/** Verifies an access token and reports who it belongs to. */
export async function validateAccessToken(accessToken: string): Promise<SessionUser | null> {
  const client = getSupabaseServerClient(accessToken);
  if (!client) return null;

  const { data, error } = await client.auth.getUser(accessToken);
  const user = data?.user;
  if (error || !user) return null;

  return {
    id: user.id,
    email: user.email ?? null,
    createdAt: user.created_at ?? null,
  };
}
