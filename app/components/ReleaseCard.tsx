import Button from "./Button";
import Card from "./Card";
import Heading from "./Heading";
import Stack from "./Stack";
import Text from "./Text";
import {
  formatBytes,
  formatReleaseDate,
  type SereRelease,
} from "../lib/release";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted">
      {children}
    </span>
  );
}

export default function ReleaseCard({
  release,
  eyebrow,
}: {
  release: SereRelease;
  eyebrow: string;
}) {
  const date = formatReleaseDate(release.publishedAt);
  const zipSize = release.zip ? formatBytes(release.zip.size) : "";

  return (
    <Card>
      <Stack gap="sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-primary">{eyebrow}</span>
          {release.stable ? <Badge>stable</Badge> : null}
          {release.prerelease ? <Badge>pre-release</Badge> : null}
        </div>
        <Heading level={3}>{release.name}</Heading>
        <Text muted className="text-sm leading-6">
          <code>{release.tag}</code>
          {date ? ` · ${date}` : ""}
          {zipSize ? ` · ${zipSize}` : ""}
        </Text>
        <div className="flex flex-wrap gap-2">
          {release.installer ? (
            <Button href={release.installer.url}>Download installer</Button>
          ) : null}
          {release.zip ? (
            <Button href={release.zip.url} variant={release.installer ? "ghost" : "primary"}>Download zip</Button>
          ) : !release.installer ? (
            <Button href={release.pageUrl}>View on GitHub</Button>
          ) : null}
          {release.vsix ? (
            <Button href={release.vsix.url} variant="ghost">
              VSIX
            </Button>
          ) : null}
          <Button href={release.pageUrl} variant="ghost">
            Notes
          </Button>
        </div>
      </Stack>
    </Card>
  );
}
