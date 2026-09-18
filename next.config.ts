import type { NextConfig } from "next";

/**
 * Defence in depth for anything that finds its way into rendered markup.
 * `unsafe-inline` is required by Next's hydration bootstrap; every other source
 * is locked to this origin.
 */
const CONTENT_SECURITY_POLICY_HEADER = {
  key: "Content-Security-Policy",
  value: [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; "),
};

const nextConfig: NextConfig = {
  // Don't advertise the framework on every response.
  poweredByHeader: false,
  redirects: async () => [
    {
      // Consolidate the www host onto the canonical apex domain.
      source: "/:path*",
      has: [{ type: "host", value: "www.sere-lang.com" }],
      destination: "https://sere-lang.com/:path*",
      permanent: true,
    },
  ],
  headers: async () => [
    {
      // JSON endpoints have no search value; keep them out of the index.
      source: "/api/:path*",
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    },
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(), payment=()",
        },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        // Production only: the dev server relies on eval-based hot reloading.
        ...(process.env.NODE_ENV === "production"
          ? [CONTENT_SECURITY_POLICY_HEADER]
          : []),
      ],
    },
  ],
};

export default nextConfig;
