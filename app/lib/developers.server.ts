/**
 * Developer accounts and sessions.
 *
 * The browser only ever holds two opaque httpOnly cookies; every call to the
 * auth provider happens here, on the server. A developer never sees a project
 * URL, an SDK key, or a provider dashboard — just an email, a password and a
 * list of their own tokens.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { generateApiToken, type GeneratedToken } from "./apiTokens.server";
import { GENERIC_FAILURE, randomToken, safeText } from "./security.server";
import {
    describeRegistryError,
    getSupabaseAdminClient,
    getSupabaseServerClient,
} from "./supabase/server";
import {
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    accessCookieOptions,
    refreshCookieOptions,
    toSessionTokens,
    validateAccessToken,
    type SessionTokens,
    type SessionUser,
} from "./supabase/session";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 128;
const MAX_LABEL_LENGTH = 60;

export interface Developer {
  id: string;
  email: string | null;
  handle: string | null;
  displayName: string | null;
  createdAt: string | null;
}

export interface DeveloperToken {
  id: string;
  label: string;
  prefix: string;
  scope: string;
  createdAt: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface DeveloperSession {
  developer: Developer;
  client: SupabaseClient;
  accessToken: string;
}

export type AuthOutcome =
  | {
      ok: true;
      needsConfirmation: boolean;
      email: string;
      /**
       * The address already had an account, so no confirmation email was sent.
       * Recorded in the audit trail but never returned to the client, which
       * would turn sign-up into an account-enumeration oracle.
       */
      existingAccount?: boolean;
    }
  | { ok: false; error: string };

const NOT_CONFIGURED = "Developer accounts are not available on this deployment yet.";

const EMAIL_SEND_FAILURE =
  "We could not send the confirmation email. This deployment's email settings need attention — try again later, or contact the maintainers.";

/* ------------------------------------------------------------------ */
/* Cookies                                                             */
/* ------------------------------------------------------------------ */

export async function writeSessionCookies(session: SessionTokens): Promise<void> {
  const store = await cookies();
  const accessMaxAge = Math.max(Math.min(session.expiresIn, 60 * 60), 60);

  store.set(ACCESS_COOKIE, session.accessToken, accessCookieOptions(accessMaxAge));
  store.set(REFRESH_COOKIE, session.refreshToken, refreshCookieOptions());
}

export async function clearSessionCookies(): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, "", { ...accessCookieOptions(0), maxAge: 0 });
  store.set(REFRESH_COOKIE, "", { ...accessCookieOptions(0), maxAge: 0 });
}

export async function readSessionTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  const store = await cookies();
  return {
    accessToken: store.get(ACCESS_COOKIE)?.value ?? null,
    refreshToken: store.get(REFRESH_COOKIE)?.value ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export function validateEmail(value: unknown): { email: string } | { error: string } {
  const email = safeText(value, 254).toLowerCase();
  if (!email || !EMAIL_PATTERN.test(email)) {
    return { error: "Enter a valid email address." };
  }
  return { email };
}

export function validatePassword(
  value: unknown,
  email: string,
): { password: string } | { error: string } {
  const password = typeof value === "string" ? value : "";

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.` };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { error: `Passwords are limited to ${MAX_PASSWORD_LENGTH} characters.` };
  }

  const localPart = email.split("@")[0];
  if (localPart && localPart.length >= 3 && password.toLowerCase().includes(localPart)) {
    return { error: "Your password should not contain your email address." };
  }

  return { password };
}

export function validateHandle(value: unknown): { handle: string } | { error: string } {
  const handle = safeText(value, 40).toLowerCase();
  if (!HANDLE_PATTERN.test(handle)) {
    return {
      error: "Pick a handle of 3–40 characters: lowercase letters, digits and dashes.",
    };
  }
  return { handle };
}

export function validateLabel(value: unknown): string {
  return safeText(value, MAX_LABEL_LENGTH) || "default";
}

const WRONG_CREDENTIALS = "That email and password combination is not recognised.";

/**
 * Provider errors are mapped rather than echoed: the raw text can reveal
 * whether an address is registered or what the password policy is.
 *
 * Error *codes* are checked first because they are stable; message text is only
 * a fallback, and the order below matters — narrow cases such as "error sending
 * confirmation email" have to be caught before the generic email check.
 */
function authErrorMessage(error: {
  message?: string;
  code?: string;
  status?: number;
} | null): string {
  const code = (error?.code ?? "").toLowerCase();
  const message = (error?.message ?? "").toLowerCase();

  if (
    error?.status === 429 ||
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    message.includes("rate limit")
  ) {
    return "Too many attempts. Wait a few minutes and try again.";
  }
  if (code === "email_not_confirmed" || message.includes("not confirmed")) {
    return "Your email address is not confirmed yet. Use “Resend it” below, or ask the site operator to turn on confirmation without email.";
  }
  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return WRONG_CREDENTIALS;
  }
  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    message.includes("already registered") ||
    message.includes("already been registered")
  ) {
    return "That email is already registered. Sign in instead.";
  }
  // Must precede the generic "email" case, which would otherwise swallow it.
  if (message.includes("sending confirmation email")) {
    return EMAIL_SEND_FAILURE;
  }
  if (
    code === "signup_disabled" ||
    message.includes("signups not allowed") ||
    message.includes("signup is disabled")
  ) {
    return "New accounts are disabled on this deployment.";
  }
  if (
    code === "email_address_not_authorized" ||
    message.includes("not authorized") ||
    message.includes("not allowed")
  ) {
    return "That address is not allowed to sign up on this deployment.";
  }
  if (code === "weak_password" || message.includes("password")) {
    return "That password is too weak. Use at least 10 characters.";
  }
  if (code === "validation_failed" || code === "email_address_invalid" || message.includes("email")) {
    return "That email address was rejected. Check it and try again.";
  }
  return GENERIC_FAILURE;
}

/* ------------------------------------------------------------------ */
/* Confirmation without email                                          */
/* ------------------------------------------------------------------ */

/**
 * Opt-in switch for deployments with no working mail sender.
 *
 * With confirmation required and no way to send the link, an account can never
 * be activated — which looks exactly like "the right password is rejected".
 * Enabling this activates an account instead, but only ever after the provider
 * itself has checked the password: an `email_not_confirmed` reply is proof the
 * credentials were correct, so this cannot be used to claim someone else's
 * address.
 */
function autoConfirmEnabled(): boolean {
  const value = process.env.DEVELOPER_AUTO_CONFIRM?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

/** Looks up an account id by address when the sign-in reply omits it. */
async function findUserIdByEmail(email: string): Promise<string | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  for (let page = 1; page <= 3; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) return null;

    const match = data.users.find(
      (user) => (user.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    if (match) return match.id;
    if (data.users.length < 200) return null;
  }

  return null;
}

async function confirmAccount(userId: string): Promise<boolean> {
  const admin = getSupabaseAdminClient();
  if (!admin) return false;

  const { error } = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
  return !error;
}

/**
 * Signs in with the password we were just given, activating an unconfirmed
 * account first when the deployment allows that.
 *
 * `email_not_confirmed` means the provider checked the password and only the
 * confirmation check failed, so the confirmation can be skipped safely.
 */
async function signInOrConfirm(
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<AuthOutcome> {
  const first = await client.auth.signInWithPassword({ email, password });

  if (!first.error && first.data.session) {
    await writeSessionCookies(toSessionTokens(first.data.session));
    return { ok: true, needsConfirmation: false, email };
  }

  const code = (first.error?.code ?? "").toLowerCase();
  const unconfirmed =
    code === "email_not_confirmed" ||
    (first.error?.message ?? "").toLowerCase().includes("not confirmed");

  if (!unconfirmed || !autoConfirmEnabled()) {
    return { ok: false, error: authErrorMessage(first.error) };
  }

  const userId = (first.data as { user?: { id?: string } | null } | null)?.user?.id
    ?? (await findUserIdByEmail(email));

  if (!userId || !(await confirmAccount(userId))) {
    return {
      ok: false,
      error:
        "That account exists but could not be activated. Ask the site operator to check the email settings.",
    };
  }

  const second = await client.auth.signInWithPassword({ email, password });
  if (second.error || !second.data.session) {
    return { ok: false, error: authErrorMessage(second.error) };
  }

  await writeSessionCookies(toSessionTokens(second.data.session));
  return { ok: true, needsConfirmation: false, email };
}

/* ------------------------------------------------------------------ */
/* Sign up / sign in / sign out                                        */
/* ------------------------------------------------------------------ */

export async function signUpDeveloper(input: {
  email: unknown;
  password: unknown;
  handle: unknown;
}): Promise<AuthOutcome> {
  const client = getSupabaseServerClient();
  if (!client) return { ok: false, error: NOT_CONFIGURED };

  const emailResult = validateEmail(input.email);
  if ("error" in emailResult) return { ok: false, error: emailResult.error };

  const passwordResult = validatePassword(input.password, emailResult.email);
  if ("error" in passwordResult) return { ok: false, error: passwordResult.error };

  const handleResult = validateHandle(input.handle);
  if ("error" in handleResult) return { ok: false, error: handleResult.error };

  const { data, error } = await client.auth.signUp({
    email: emailResult.email,
    password: passwordResult.password,
    options: {
      data: { handle: handleResult.handle, display_name: handleResult.handle },
    },
  });

  if (error) return { ok: false, error: authErrorMessage(error) };

  if (data.session) {
    await writeSessionCookies(toSessionTokens(data.session));
    return { ok: true, needsConfirmation: false, email: emailResult.email };
  }

  // No session means this deployment requires email confirmation.
  //
  // When the address already has a confirmed account the provider returns a
  // user with no identities and sends nothing at all — the usual reason a
  // confirmation email never arrives. Recorded for the audit trail, never
  // exposed to the caller.
  const existingAccount = Array.isArray(data.user?.identities)
    ? data.user.identities.length === 0
    : false;

  // With no working mail sender, an account that can never be confirmed is
  // useless — which shows up as "the right password is rejected".
  if (autoConfirmEnabled()) {
    // A brand new account: it was created with this password moments ago, so
    // there is nothing to prove and no need to lean on the provider's error
    // codes to activate it.
    const freshId = existingAccount ? null : (data.user?.id ?? null);
    if (freshId && (await confirmAccount(freshId))) {
      const signedIn = await client.auth.signInWithPassword({
        email: emailResult.email,
        password: passwordResult.password,
      });

      if (!signedIn.error && signedIn.data.session) {
        await writeSessionCookies(toSessionTokens(signedIn.data.session));
        return { ok: true, needsConfirmation: false, email: emailResult.email };
      }
    }

    // An account that already existed: activate it only once the provider has
    // checked the password.
    return signInOrConfirm(client, emailResult.email, passwordResult.password);
  }

  return {
    ok: true,
    needsConfirmation: true,
    email: emailResult.email,
    existingAccount,
  };
}

/**
 * Sends the confirmation email again.
 *
 * Reports success for addresses that do not exist, so the endpoint cannot be
 * used to discover which ones do. Only a genuine delivery failure is reported.
 */
export async function resendConfirmationEmail(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getSupabaseServerClient();
  if (!client) return { ok: false, error: NOT_CONFIGURED };

  const emailResult = validateEmail(input);
  if ("error" in emailResult) return { ok: true };

  const { error } = await client.auth.resend({ type: "signup", email: emailResult.email });
  if (!error) return { ok: true };

  const status = error.status ?? 0;
  // Unknown address, or a request the provider declines to explain.
  if (status === 400 || status === 404 || status === 422) return { ok: true };

  if (status === 429 || (error.message ?? "").toLowerCase().includes("rate limit")) {
    return { ok: false, error: "Too many emails requested. Wait a few minutes and try again." };
  }

  return { ok: false, error: EMAIL_SEND_FAILURE };
}

export async function signInDeveloper(input: {
  email: unknown;
  password: unknown;
}): Promise<AuthOutcome> {
  const client = getSupabaseServerClient();
  if (!client) return { ok: false, error: NOT_CONFIGURED };

  const emailResult = validateEmail(input.email);
  const password = typeof input.password === "string" ? input.password : "";

  if ("error" in emailResult || !password) {
    return { ok: false, error: WRONG_CREDENTIALS };
  }

  // Shared with sign-up: it also activates an unconfirmed account when this
  // deployment requires confirmation but cannot send the email.
  return signInOrConfirm(client, emailResult.email, password);
}

export async function signOutDeveloper(): Promise<void> {
  const { accessToken } = await readSessionTokens();
  await clearSessionCookies();

  const admin = getSupabaseAdminClient();
  if (!admin || !accessToken) return;

  try {
    await admin.auth.admin.signOut(accessToken);
  } catch {
    // The cookies are already gone; a dangling server session is harmless.
  }
}

/* ------------------------------------------------------------------ */
/* Current developer                                                   */
/* ------------------------------------------------------------------ */

async function readDeveloperRow(
  client: SupabaseClient,
  user: SessionUser,
): Promise<Developer> {
  const { data } = await client
    .from("developers")
    .select("handle, display_name, created_at")
    .eq("id", user.id)
    .maybeSingle();

  const row = (data ?? {}) as Record<string, unknown>;

  return {
    id: user.id,
    email: user.email,
    handle: typeof row.handle === "string" ? row.handle : null,
    displayName: typeof row.display_name === "string" ? row.display_name : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : user.createdAt,
  };
}

/** Creates the profile row for accounts that predate the trigger. */
async function ensureDeveloperRow(client: SupabaseClient, user: SessionUser): Promise<void> {
  const existing = await client.from("developers").select("id").eq("id", user.id).maybeSingle();
  if (existing.data) return;

  const slug = safeText(user.email?.split("@")[0] ?? "", 24)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const suffix = randomToken(3)
      .replace(/[-_]/g, "a")
      .slice(0, 3)
      .toLowerCase();
    const handle = `${slug || "developer"}-${suffix}`.slice(0, 40);

    const { error } = await client
      .from("developers")
      .insert({ id: user.id, handle, display_name: handle });

    if (!error) return;
    // 23505 means the handle is taken — try another suffix.
    if (error.code !== "23505") break;
  }

  // A row without a handle still lets the developer publish.
  await client.from("developers").insert({ id: user.id });
}

/**
 * Resolves the signed-in developer, or null. Reads cookies only, so it is safe
 * to call from a server component where cookies cannot be written.
 */
export async function getCurrentDeveloper(): Promise<Developer | null> {
  const { accessToken } = await readSessionTokens();
  if (!accessToken) return null;

  const user = await validateAccessToken(accessToken);
  if (!user) return null;

  const client = getSupabaseServerClient(accessToken);
  if (!client) return null;

  return readDeveloperRow(client, user);
}

/** Same, plus a client bound to the developer's identity for RLS-scoped work. */
export async function requireDeveloper(): Promise<DeveloperSession | null> {
  const { accessToken } = await readSessionTokens();
  if (!accessToken) return null;

  const user = await validateAccessToken(accessToken);
  if (!user) return null;

  const client = getSupabaseServerClient(accessToken);
  if (!client) return null;

  await ensureDeveloperRow(client, user);

  return {
    developer: await readDeveloperRow(client, user),
    client,
    accessToken,
  };
}

/* ------------------------------------------------------------------ */
/* Token management — runs as the developer, so RLS applies            */
/* ------------------------------------------------------------------ */

const TOKEN_COLUMNS = "id, label, token_prefix, scope, created_at, last_used_at, expires_at, revoked_at";

function mapToken(row: unknown): DeveloperToken | null {
  if (row === null || typeof row !== "object") return null;

  const record = row as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";
  if (!id) return null;

  return {
    id,
    label: typeof record.label === "string" ? record.label : "default",
    prefix: typeof record.token_prefix === "string" ? record.token_prefix : "",
    scope: typeof record.scope === "string" ? record.scope : "publish",
    createdAt: typeof record.created_at === "string" ? record.created_at : null,
    lastUsedAt: typeof record.last_used_at === "string" ? record.last_used_at : null,
    expiresAt: typeof record.expires_at === "string" ? record.expires_at : null,
    revokedAt: typeof record.revoked_at === "string" ? record.revoked_at : null,
  };
}

export async function listDeveloperTokens(
  session: DeveloperSession,
): Promise<DeveloperToken[]> {
  const { data, error } = await session.client
    .from("api_tokens")
    .select(TOKEN_COLUMNS)
    .eq("developer_id", session.developer.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !Array.isArray(data)) return [];

  return data.flatMap((row) => {
    const token = mapToken(row);
    return token ? [token] : [];
  });
}

export type CreateTokenOutcome =
  | { ok: true; token: GeneratedToken; record: DeveloperToken }
  | { ok: false; error: string };

export async function createDeveloperToken(
  session: DeveloperSession,
  label: unknown,
  expiresInDays: unknown,
): Promise<CreateTokenOutcome> {
  const generated = await generateApiToken();
  const days = Number(expiresInDays);
  const expiresAt =
    Number.isFinite(days) && days > 0 && days <= 3650
      ? new Date(Date.now() + days * 86_400_000).toISOString()
      : null;

  const { data, error } = await session.client
    .from("api_tokens")
    .insert({
      developer_id: session.developer.id,
      label: validateLabel(label),
      token_prefix: generated.prefix,
      token_hash: generated.hash,
      expires_at: expiresAt,
    })
    .select(TOKEN_COLUMNS)
    .single();

  const record = mapToken(data);
  if (error || !record) {
    // A missing table, a wrong key or an unreachable database all used to read
    // as a transient failure, which invited pointless retries.
    const hint = describeRegistryError(error).summary;
    return {
      ok: false,
      error: hint
        ? `Could not create that token: ${hint}.`
        : "Could not create that token. Try again.",
    };
  }

  return { ok: true, token: generated, record };
}

export async function revokeDeveloperToken(
  session: DeveloperSession,
  tokenId: string,
): Promise<boolean> {
  const { error } = await session.client
    .from("api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", tokenId)
    .eq("developer_id", session.developer.id);

  return !error;
}
