import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Button from "../../components/Button";
import DocMarkdown from "../../components/docs/Markdown";
import Heading from "../../components/Heading";
import JsonLd from "../../components/JsonLd";
import InstallCommand from "../../components/packages/InstallCommand";
import VersionList from "../../components/packages/VersionList";
import PageIntro from "../../components/PageIntro";
import Stack from "../../components/Stack";
import Text from "../../components/Text";
import {
    getPackage,
    listPackageNames,
    packageDownloadUrl,
} from "../../lib/packageRegistry.server";
import {
    PACKAGE_MAX_LIMIT,
    formatBytes,
    formatDate,
    formatDownloads,
    packageInstallCommand,
    packagePath,
} from "../../lib/packages";
import { breadcrumbJsonLd, pageMetadata } from "../../lib/seo";

export const revalidate = 300;

// New packages appear without a rebuild; known ones are prerendered.
export const dynamicParams = true;

interface LibraryPageProps {
  params: Promise<{ name: string }>;
}

export async function generateStaticParams() {
  const names = await listPackageNames(PACKAGE_MAX_LIMIT);
  return names.map((name) => ({ name }));
}

export async function generateMetadata({
  params,
}: LibraryPageProps): Promise<Metadata> {
  const { name } = await params;
  const pkg = await getPackage(decodeURIComponent(name));

  if (!pkg) {
    return { title: "Package", robots: { index: false, follow: true } };
  }

  return pageMetadata({
    title: pkg.displayName,
    description:
      pkg.summary || `Install the ${pkg.name} package for Sere with sere add.`,
    path: packagePath(pkg.name),
    ogType: "article",
    modifiedTime: pkg.updatedAt ?? undefined,
    keywords: [
      `Sere ${pkg.name}`,
      "Sere package",
      ...pkg.keywords.slice(0, 5).map((keyword) => `Sere ${keyword}`),
    ],
  });
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] tracking-[0.16em] text-muted uppercase">{label}</span>
      <span className="font-mono text-sm text-foreground">{value}</span>
    </div>
  );
}

export default async function LibraryPage({ params }: LibraryPageProps) {
  const { name } = await params;
  const pkg = await getPackage(decodeURIComponent(name));
  if (!pkg) notFound();

  const latest = pkg.versions[0] ?? null;
  const readme = pkg.versions.find((entry) => entry.readme?.trim())?.readme ?? null;
  const installTarget = pkg.latestVersion ?? latest?.version ?? null;

  const rows = pkg.versions.map((version) => ({
    version,
    downloadUrl: packageDownloadUrl(version.tarballPath),
  }));

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Libraries", path: "/libraries" },
          { name: pkg.displayName, path: packagePath(pkg.name) },
        ])}
      />

      <PageIntro
        eyebrow="Package"
        title={pkg.displayName}
        description={pkg.summary || `The ${pkg.name} package for Sere.`}
      >
        <div className="flex flex-wrap items-center gap-2">
          {installTarget ? <span className="chip">{installTarget}</span> : null}
          {pkg.license ? <span className="chip">{pkg.license}</span> : null}
          <span className="chip">{formatDownloads(pkg.downloads)} downloads</span>
          <span className="chip">
            {pkg.versionsCount} {pkg.versionsCount === 1 ? "version" : "versions"}
          </span>
          {pkg.updatedAt ? (
            <span className="chip">updated {formatDate(pkg.updatedAt)}</span>
          ) : null}
        </div>

        <div className="w-full max-w-xl">
          <InstallCommand
            command={packageInstallCommand(pkg.name, installTarget)}
            hint={`Adds ${pkg.name} to libs/ so you can import it.`}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button href={`/api/packages/${encodeURIComponent(pkg.name)}`} variant="secondary" size="sm">
            JSON API
          </Button>
          {pkg.repositoryUrl ? (
            <Button href={pkg.repositoryUrl} variant="ghost" size="sm">
              Repository
            </Button>
          ) : null}
          {pkg.homepageUrl ? (
            <Button href={pkg.homepageUrl} variant="ghost" size="sm">
              Homepage
            </Button>
          ) : null}
          <Button href="/docs/installing-packages" variant="ghost" size="sm">
            How to install
          </Button>
          <Button href="/libraries" variant="ghost" size="sm">
            All libraries
          </Button>
        </div>

        {latest ? (
          <div className="grid grid-cols-2 gap-6 border-t border-border-muted pt-6 sm:grid-cols-4">
            <Detail label="Latest" value={latest.version} />
            <Detail label="Published" value={formatDate(latest.publishedAt) || "—"} />
            <Detail label="Archive" value={formatBytes(latest.tarballBytes) || "—"} />
            <Detail label="Entry" value={latest.entry ?? "lib.sere"} />
          </div>
        ) : null}

        {pkg.author || pkg.keywords.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {pkg.author ? <Text muted className="m-0 text-sm">by {pkg.author}</Text> : null}
            {pkg.keywords.map((keyword) => (
              <span key={keyword} className="chip">
                {keyword}
              </span>
            ))}
          </div>
        ) : null}

        <Stack gap="sm">
          <Heading level={2}>README</Heading>
          {readme ? (
            <DocMarkdown source={readme} />
          ) : (
            <Text muted className="text-sm">
              This package has not published a README yet.
            </Text>
          )}
        </Stack>

        <Stack gap="sm">
          <Heading level={2}>Versions</Heading>
          <Text muted className="text-sm">
            Published versions are immutable. Pin one with{" "}
            <code>{packageInstallCommand(pkg.name, latest?.version ?? "x.y.z")}</code>.
          </Text>
          <VersionList name={pkg.name} rows={rows} />
        </Stack>

        {pkg.description && pkg.description !== pkg.summary ? (
          <Stack gap="sm">
            <Heading level={2}>About</Heading>
            <Text muted className="text-sm leading-7">
              {pkg.description}
            </Text>
          </Stack>
        ) : null}
      </PageIntro>
    </>
  );
}
