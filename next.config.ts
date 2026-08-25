import type { NextConfig } from "next";

const nodeFsStub = "./app/lib/nodeFsStub.ts";

const nextConfig: NextConfig = {
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
  headers: async () => [
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
  ],
};

export default nextConfig;
