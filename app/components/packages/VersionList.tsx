import {
    formatBytes,
    formatDate,
    packageInstallCommand,
    type PackageVersion,
} from "../../lib/packages";

export interface VersionRow {
  version: PackageVersion;
  downloadUrl: string | null;
}

interface VersionListProps {
  name: string;
  rows: VersionRow[];
}

export default function VersionList({ name, rows }: VersionListProps) {
  if (rows.length === 0) {
    return <p className="m-0 text-sm text-muted">No versions published yet.</p>;
  }

  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] tracking-[0.14em] text-muted uppercase">
              <th className="px-4 py-3 font-medium">Version</th>
              <th className="px-4 py-3 font-medium">Published</th>
              <th className="px-4 py-3 font-medium">Size</th>
              <th className="px-4 py-3 font-medium">Install</th>
              <th className="px-4 py-3 font-medium">SHA-256</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ version, downloadUrl }) => (
              <tr
                key={version.version}
                className="border-b border-border-muted last:border-b-0"
              >
                <td className="px-4 py-3 font-mono text-[13px] whitespace-nowrap text-foreground">
                  {downloadUrl ? (
                    <a href={downloadUrl} className="text-foreground no-underline hover:text-primary">
                      {version.version}
                    </a>
                  ) : (
                    version.version
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">
                  {formatDate(version.publishedAt) || "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">
                  {formatBytes(version.tarballBytes) || "—"}
                </td>
                <td className="px-4 py-3">
                  <code className="font-mono text-[12px] whitespace-nowrap text-muted-foreground">
                    {packageInstallCommand(name, version.version)}
                  </code>
                </td>
                <td className="px-4 py-3 font-mono text-[11px] whitespace-nowrap text-muted">
                  {version.checksumSha256
                    ? `${version.checksumSha256.slice(0, 12)}…`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
