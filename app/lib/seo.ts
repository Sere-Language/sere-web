import type { Metadata } from "next";

/**
 * Single source of truth for everything search engines and social crawlers read.
 *
 * The production origin. Set NEXT_PUBLIC_SITE_URL to override (previews, staging,
 * custom domains) — everything else here derives from it so canonicals, sitemaps,
 * Open Graph URLs, and structured data never drift apart.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://sere-lang.com"
).replace(/\/$/, "");

export const SITE_NAME = "Sere";
export const SITE_LOCALE = "en_US";
export const SITE_LANGUAGE = "en";

export const SERE_GITHUB_ORG = "https://github.com/Sere-Language";
export const SERE_GITHUB_REPO = `${SERE_GITHUB_ORG}/sere`;
export const SERE_GITHUB_REPO_NAME = "Sere-Language/sere";

/** Short, keyword-dense headline used in <title> defaults and OG tags. */
export const SITE_TAGLINE =
  "A Python-like language that compiles to native code";

export const SITE_TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`;

/** ~155 characters, front-loads the primary keyword and the differentiators. */
export const SITE_DESCRIPTION =
  "Sere is a statically typed language that reads like Python and compiles to standalone native binaries through LLVM. No interpreter, no VM, no runtime.";

/** Longer prose for structured data, where there is no snippet length limit. */
export const SITE_LONG_DESCRIPTION =
  "Sere is a statically typed, indentation-significant programming language that reads like Python and compiles to standalone native binaries through LLVM 22. Install the toolchain, write .sere source, and ship real executables — no interpreter, VM, or bundled runtime.";

export const DEFAULT_KEYWORDS = [
  "Sere",
  "Sere language",
  "Sere programming language",
  "Sere compiler",
  "compiled programming language",
  "Python-like syntax",
  "LLVM compiler",
  "native binary compiler",
  "statically typed language",
  "systems programming language",
  "standalone executable",
  "language server protocol",
  "Sere docs",
  "Sere install",
];

/** Build an absolute URL for a site-relative path. */
export function absoluteUrl(path = "/"): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
  return new URL(path.startsWith("/") ? path : `/${path}`, SITE_URL).toString();
}

/**
 * Collapses whitespace and trims a description to a length search engines will
 * actually display, cutting on a word boundary rather than mid-word.
 */
export function clampDescription(text: string, max = 158): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const body = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${body.replace(/[\s,;:.\-–—]+$/, "")}…`;
}

export interface PageMetadataOptions {
  /** Page title without the site suffix — the root layout appends " | Sere". */
  title: string;
  description: string;
  /** Site-relative path, used for the canonical URL. */
  path: string;
  keywords?: string[];
  /** `article` for docs and posts, `website` for everything else. */
  ogType?: "website" | "article";
  /** Keep a page out of the index (auth, dashboards, internal previews). */
  noIndex?: boolean;
  /**
   * Render the title verbatim instead of letting the root layout template
   * append " | Sere". Use this on the home page, which already names the brand.
   */
  absoluteTitle?: boolean;
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
}

/**
 * Builds consistent per-page metadata: canonical URL, Open Graph, and Twitter
 * cards. Open Graph images are supplied by the `opengraph-image` file
 * conventions, so they are intentionally not hard-coded here.
 */
export function pageMetadata({
  title,
  description,
  path,
  keywords,
  ogType = "website",
  noIndex = false,
  absoluteTitle = false,
  publishedTime,
  modifiedTime,
  authors,
}: PageMetadataOptions): Metadata {
  const url = absoluteUrl(path);
  const trimmed = clampDescription(description);

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description: trimmed,
    keywords: Array.from(new Set([...DEFAULT_KEYWORDS, ...(keywords ?? [])])),
    alternates: { canonical: path },
    openGraph: {
      type: ogType,
      title,
      description: trimmed,
      url,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      ...(ogType === "article"
        ? {
            ...(publishedTime ? { publishedTime } : {}),
            ...(modifiedTime ? { modifiedTime } : {}),
            ...(authors ? { authors } : {}),
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: trimmed,
    },
    ...(noIndex
      ? { robots: { index: false, follow: true } }
      : {
          robots: {
            index: true,
            follow: true,
            googleBot: {
              index: true,
              follow: true,
              "max-snippet": -1,
              "max-image-preview": "large" as const,
              "max-video-preview": -1,
            },
          },
        }),
  };
}

/* ------------------------------------------------------------------ */
/* Structured data (JSON-LD)                                          */
/* ------------------------------------------------------------------ */

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    alternateName: "Sere Programming Language",
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/sere-mark.png"),
    },
    description: SITE_LONG_DESCRIPTION,
    sameAs: [SERE_GITHUB_REPO, SERE_GITHUB_ORG],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: `${SITE_NAME} Programming Language`,
    url: SITE_URL,
    description: SITE_LONG_DESCRIPTION,
    inLanguage: SITE_LANGUAGE,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}

export interface SoftwareApplicationJsonLdInput {
  version?: string | null;
  downloadUrl?: string | null;
  releaseNotesUrl?: string | null;
  datePublished?: string | null;
}

export function softwareApplicationJsonLd({
  version,
  downloadUrl,
  releaseNotesUrl,
  datePublished,
}: SoftwareApplicationJsonLdInput = {}) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    alternateName: "Sere programming language",
    applicationCategory: "DeveloperApplication",
    applicationSubCategory: "Programming Language",
    operatingSystem: "Windows, Linux, macOS",
    description: SITE_LONG_DESCRIPTION,
    url: SITE_URL,
    ...(version ? { softwareVersion: version } : {}),
    ...(downloadUrl ? { downloadUrl: absoluteUrl(downloadUrl) } : {}),
    ...(releaseNotesUrl ? { releaseNotes: releaseNotesUrl } : {}),
    ...(datePublished ? { datePublished } : {}),
    license: `${SERE_GITHUB_REPO}/blob/main/LICENSE`,
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    sameAs: [SERE_GITHUB_REPO],
  };
}

export interface TechArticleJsonLdInput {
  headline: string;
  description: string;
  path: string;
  modifiedTime?: string | null;
  keywords?: string[];
}

export function techArticleJsonLd({
  headline,
  description,
  path,
  modifiedTime,
  keywords,
}: TechArticleJsonLdInput) {
  const url = absoluteUrl(path);
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline,
    description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: SITE_LANGUAGE,
    ...(modifiedTime ? { dateModified: modifiedTime } : {}),
    ...(keywords?.length ? { keywords: keywords.join(", ") } : {}),
    author: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/sere-mark.png"),
      },
    },
  };
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqJsonLd(
  questions: Array<{ question: string; answer: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: entry.answer,
      },
    })),
  };
}
