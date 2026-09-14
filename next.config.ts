import type { NextConfig } from "next";

const nodeFsStub = "./app/lib/nodeFsStub.ts";

const nextConfig: NextConfig = {
  // Don't advertise the framework on every response.
  poweredByHeader: false,
  transpilePackages: ["@userland-run/nano-sdk"],
  turbopack: {
    resolveAlias: {
      "fs/promises": { browser: nodeFsStub },
      "node:fs/promises": { browser: nodeFsStub },
      fs: { browser: nodeFsStub },
      "node:fs": { browser: nodeFsStub },
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "fs/promises": false,
        "node:fs/promises": false,
        fs: false,
        "node:fs": false,
      };
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        "fs/promises": false,
        path: false,
        module: false,
        os: false,
        child_process: false,
        worker_threads: false,
      };
    }
    return config;
  },
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
      source: "/cloud/projects/:path*",
      headers: [
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
      ],
    },
    {
      source: "/nano/:path*",
      headers: [
        { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
      ],
    },
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
  ],
};

export default nextConfig;
