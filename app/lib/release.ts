export const SERE_GITHUB_REPO = "Sere-Language/sere";
export const SERE_RELEASES_PAGE = `https://github.com/${SERE_GITHUB_REPO}/releases`;

const RELEASES_API = `https://api.github.com/repos/${SERE_GITHUB_REPO}/releases?per_page=50`;

export type ReleaseAsset = {
  name: string;
  url: string;
  size: number;
};

export type SereRelease = {
  tag: string;
  name: string;
  prerelease: boolean;
  stable: boolean;
  publishedAt: string | null;
  pageUrl: string;
  installer: ReleaseAsset | null;
  zip: ReleaseAsset | null;
  linuxZip: ReleaseAsset | null;
  vsix: ReleaseAsset | null;
};

export type ReleaseCatalog = {
  latest: SereRelease | null;
  latestStable: SereRelease | null;
  others: SereRelease[];
  all: SereRelease[];
};

type GithubAsset = {
  name: string;
  browser_download_url: string;
  size: number;
};

type GithubRelease = {
  tag_name: string;
  name: string | null;
  draft: boolean;
  prerelease: boolean;
  html_url: string;
  published_at: string | null;
  assets: GithubAsset[];
};

function pickAsset(
  assets: GithubAsset[],
  match: (name: string) => boolean,
): ReleaseAsset | null {
  const asset = assets.find((item) => match(item.name.toLowerCase()));
  if (!asset) return null;
  return {
    name: asset.name,
    url: asset.browser_download_url,
    size: asset.size,
  };
}

function toSereRelease(release: GithubRelease): SereRelease {
  const name = release.name?.trim() || release.tag_name;
  return {
    tag: release.tag_name,
    name,
    prerelease: release.prerelease,
    stable: !release.prerelease,
    publishedAt: release.published_at,
    pageUrl: release.html_url,
    installer: pickAsset(
      release.assets,
      (assetName) => assetName.endsWith(".exe") && /setup|install/.test(assetName),
    ),
    zip: pickAsset(
      release.assets,
      (assetName) =>
        assetName.endsWith(".zip") &&
        !assetName.endsWith(".vsix") &&
        !assetName.includes("linux"),
    ),
    linuxZip: pickAsset(
      release.assets,
      (assetName) =>
        assetName === "linux.zip" ||
        (assetName.includes("linux") && assetName.endsWith(".zip")),
    ),
    vsix: pickAsset(release.assets, (assetName) => assetName.endsWith(".vsix")),
  };
}

function publishedTime(release: SereRelease): number {
  return release.publishedAt ? Date.parse(release.publishedAt) : 0;
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = value >= 10 || unit === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

export function formatReleaseDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function recommendedRelease(catalog: ReleaseCatalog): SereRelease | null {
  return catalog.latest;
}

export function linuxToolchainRelease(catalog: ReleaseCatalog): SereRelease | null {
  if (catalog.latest?.linuxZip) {
    return catalog.latest;
  }
  return catalog.all.find((release) => release.linuxZip !== null) ?? null;
}

export async function getReleaseCatalog(): Promise<ReleaseCatalog> {
  const empty: ReleaseCatalog = {
    latest: null,
    latestStable: null,
    others: [],
    all: [],
  };

  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "sere-web",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const token = process.env.GITHUB_TOKEN;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(RELEASES_API, {
      headers,
      next: { revalidate: 300, tags: ["releases"] },
    });
    if (!response.ok) {
      // Retry once — GitHub occasionally hiccups or briefly rate-limits.
      // Don't cache the failure so the next request can succeed.
      const retry = await fetch(RELEASES_API, {
        headers,
        cache: "no-store",
      });
      if (!retry.ok) return empty;
      return parseReleases((await retry.json()) as GithubRelease[]);
    }

    return parseReleases((await response.json()) as GithubRelease[]);
  } catch {
    return empty;
  }
}

function parseReleases(payload: GithubRelease[]): ReleaseCatalog {
  const all = payload
    .filter((release) => !release.draft)
    .map(toSereRelease)
    .sort((a, b) => publishedTime(b) - publishedTime(a));

  const latest = all[0] ?? null;
  const latestStable = all.find((release) => release.stable) ?? null;
  const featuredTags = new Set(
    [latest?.tag, latestStable?.tag].filter((tag): tag is string => Boolean(tag)),
  );
  const others = all.filter((release) => !featuredTags.has(release.tag));

  return { latest, latestStable, others, all };
}
