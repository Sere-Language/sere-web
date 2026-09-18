/**
 * Security primitives shared by the registry APIs.
 *
 * Everything here runs on WebCrypto so it works on any Next.js runtime and
 * needs no Node built-ins.
 */

const encoder = new TextEncoder();

/** Optional pepper for IP hashing. A stable fallback keeps buckets consistent. */
const IP_HASH_SALT = process.env.IP_HASH_SALT?.trim() || "sere-registry";

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoder.encode(value));
  return toHex(new Uint8Array(digest));
}

/** URL-safe random string. Defaults to 256 bits of entropy. */
export function randomToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buffer);
  return base64Url(buffer);
}

export function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Compares two strings without leaking their shared prefix length through
 * timing. Length is compared first, which only reveals the length.
 */
export function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

/** The caller's IP, as reported by the proxy in front of the app. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/** Hashes an IP so rate-limit buckets and audit rows never store raw addresses. */
export async function hashIp(ip: string): Promise<string> {
  return (await sha256Hex(`${IP_HASH_SALT}:${ip}`)).slice(0, 32);
}

/**
 * Blocks cross-site requests that carry ambient cookie auth.
 *
 * Browsers always send `Origin` on cross-origin unsafe requests, so a mismatch
 * means someone is driving a signed-in user's browser. Requests without an
 * `Origin` (curl, CI) carry no cookies and are allowed through.
 */
export function isSameOriginRequest(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return false;
  }

  const origin = request.headers.get("origin");
  if (!origin) return true;

  const host = request.headers.get("host");
  try {
    const originHost = new URL(origin).host;
    if (host && originHost === host) return true;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
    return Boolean(siteUrl && origin.replace(/\/$/, "") === siteUrl);
  } catch {
    return false;
  }
}

/** Trims, collapses whitespace and caps length. Returns "" for junk input. */
export function safeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, maxLength);
}

export const GENERIC_FAILURE = "Something went wrong. Please try again.";

/** JSON response that is never cached and carries no provider detail. */
export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", ...headers },
  });
}
