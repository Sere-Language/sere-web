import type { MetadataRoute } from "next";
import { absoluteUrl, SITE_URL } from "./lib/seo";

const DISALLOW = ["/api/", "/developers/", "/auth/"];

// Crawlers we explicitly welcome — these feed AI answer engines and developer
// assistants, which is where a language's docs get discovered today.
const AI_AND_SEARCH_BOTS = [
  "Googlebot",
  "Googlebot-Image",
  "Bingbot",
  "DuckDuckBot",
  "Slurp",
  "Baiduspider",
  "YandexBot",
  "Applebot",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Amazonbot",
  "CCBot",
  "cohere-ai",
  "YouBot",
  "Applebot-Extended",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW,
      },
      {
        userAgent: AI_AND_SEARCH_BOTS,
        allow: "/",
        disallow: DISALLOW,
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
