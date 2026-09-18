import type { Metadata } from "next";
import Button from "../components/Button";
import Card from "../components/Card";
import CodeBlock from "../components/CodeBlock";
import Grid from "../components/Grid";
import Heading from "../components/Heading";
import PackageExplorer from "../components/packages/PackageExplorer";
import PageIntro from "../components/PageIntro";
import Reveal from "../components/Reveal";
import Stack from "../components/Stack";
import Text from "../components/Text";
import { isRegistryConfigured, listPackages } from "../lib/packageRegistry.server";
import { PACKAGE_MAX_LIMIT } from "../lib/packages";
import { pageMetadata } from "../lib/seo";
import { highlightSere } from "../utils/highlight";

export const metadata: Metadata = pageMetadata({
  title: "Libraries",
  description:
    "Search the Sere package registry, install a library with sere add, or publish your own. Includes the standard library modules that ship with the compiler.",
  path: "/libraries",
  keywords: [
    "Sere libraries",
    "Sere packages",
    "Sere package registry",
    "Sere standard library",
    "sere add",
    "slib package",
  ],
});

// Published packages change over time; refresh on the same cadence as the docs.
export const revalidate = 300;

const MODULES = [
  { name: "prelude", body: "Always injected: print, abs, min, max, Int / Float, dbg!." },
  { name: "io", body: "read_line, eprint, extra I/O on top of the print intrinsic." },
  { name: "fs / path / os / env / sys", body: "Files, paths, process, and the host." },
  { name: "string / bytes / encoding / regex", body: "Text and binary. Backtick literals type as regex." },
  { name: "math / vec / matrix / ml / arrays", body: "Numeric work and linear algebra." },
  { name: "hash / random / time / log / bit", body: "Utilities you reach for in a real binary." },
  { name: "gc / heap / memory", body: "Collectors, arenas, pointer vocabulary." },
  { name: "inspect", body: "label and describe, not the builtin typeof / dir." },
  { name: "html_lang", body: "html: raw macro plus the Html wrapper." },
  { name: "windows / gl / qt6", body: "Win32, OpenGL 2.1+, Qt widgets (stub if missing)." },
  { name: "requests", body: "HTTP client: get, post, put, delete." },
  { name: "wsgi", body: "Blocking HTTP server. Subclass Handler and implement handle." },
] as const;

const MANIFEST_SAMPLE = `# sere.toml — read by the registry and by sere add
[package]
name = "hello-utils"
version = "0.1.0"
summary = "Small helpers for Sere projects."
license = "MIT"
repository = "https://github.com/you/hello-utils"
keywords = ["utilities", "strings"]`;

const PUBLISH_SAMPLE = `sere pack hello-utils

curl -X POST https://sere-lang.com/api/packages \\
  -H "Authorization: Bearer $SERE_TOKEN" \\
  -F "name=hello-utils" \\
  -F "version=0.1.0" \\
  -F "manifest=@sere.toml" \\
  -F "readme=@README.md" \\
  -F tarball=@dist/hello-utils-0.1.0.tar.gz`;

export default async function LibrariesPage() {
  const packages = await listPackages({ limit: PACKAGE_MAX_LIMIT });
  const registryConfigured = isRegistryConfigured();

  return (
    <PageIntro
      eyebrow="Packages"
      title="Libraries"
      description="Search every package published to the Sere registry. Install one with sere add, or push your own with the publish API. The standard library still ships with the compiler — everything in the list above is a package you opt into."
    >
      <PackageExplorer packages={packages} registryConfigured={registryConfigured} />

      <Stack gap="lg">
        <Stack gap="sm">
          <Heading level={2}>Publish a package</Heading>
          <Text muted className="max-w-2xl">
            Describe the package in <code>sere.toml</code>, pack it, then POST the
            archive to the registry. Versions are immutable: uploading the same
            version twice is rejected, so a tag in a manifest always resolves to
            the same bytes.
          </Text>
          <Button href="/developers" className="mt-1">
            Open your developer account
          </Button>
        </Stack>

        <Grid cols={2}>
          <Reveal>
            <CodeBlock filename="sere.toml" wide>
              {MANIFEST_SAMPLE}
            </CodeBlock>
          </Reveal>
          <Reveal delay={80}>
            <CodeBlock filename="publish" wide>
              {PUBLISH_SAMPLE}
            </CodeBlock>
          </Reveal>
        </Grid>

        <Grid cols={3} className="gap-x-8 gap-y-8">
          <Reveal>
            <Card variant="plain" hover={false}>
              <Stack gap="sm">
                <Heading level={3}>Authenticate</Heading>
                <Text muted className="text-sm leading-6">
                  Create an account and issue a token, then send it as{" "}
                  <code>Authorization: Bearer</code>. Revoke a token whenever you
                  like without disturbing the others.
                </Text>
              </Stack>
            </Card>
          </Reveal>
          <Reveal delay={80}>
            <Card variant="plain" hover={false}>
              <Stack gap="sm">
                <Heading level={3}>Where archives live</Heading>
                <Text muted className="text-sm leading-6">
                  Each upload lands in the <code>packages</code> bucket at{" "}
                  <code>
                    &lt;name&gt;/&lt;version&gt;/&lt;name&gt;-&lt;version&gt;.tar.gz
                  </code>
                  , alongside its SHA-256 so installs can verify what they fetch.
                </Text>
              </Stack>
            </Card>
          </Reveal>
          <Reveal delay={160}>
            <Card variant="plain" hover={false}>
              <Stack gap="sm">
                <Heading level={3}>Read API</Heading>
                <Text muted className="text-sm leading-6">
                  <code>GET /api/packages</code> lists and searches,{" "}
                  <code>/api/packages/&lt;name&gt;</code> returns every version, and{" "}
                  <code>/api/packages/&lt;name&gt;/&lt;version&gt;</code> hands back a
                  download URL.
                </Text>
              </Stack>
            </Card>
          </Reveal>
        </Grid>
      </Stack>

      <Stack gap="lg">
        <Stack gap="sm">
          <Heading level={2}>Standard library</Heading>
          <Text muted className="max-w-2xl">
            Prelude is always there. Everything else is <code>import</code>.
          </Text>
        </Stack>
        <Grid cols={3} className="gap-x-8 gap-y-7">
          {MODULES.map((mod, index) => (
            <Reveal key={mod.name} delay={(index % 3) * 80}>
              <div className="border-t border-border pt-3">
                <p className="m-0 font-mono text-[13px] text-foreground">
                  {mod.name}
                </p>
                <p className="m-0 mt-1.5 text-sm leading-6 text-muted-foreground">
                  {mod.body}
                </p>
              </div>
            </Reveal>
          ))}
        </Grid>
      </Stack>

      <Stack gap="lg">
        <Stack gap="sm">
          <Heading level={2}>Packing your own</Heading>
          <Text muted className="max-w-2xl">
            A library is either a packed <code>.slib</code> you drop in{" "}
            <code>libs/</code>, or a folder the compiler reads directly. Packing
            keeps the entry, the local modules it imports, and any compiled native
            objects in one file.
          </Text>
        </Stack>
        <CodeBlock filename="powershell" wide>
          {`sere init-lib mathlib
cd mathlib
sere pack
copy dist\\mathlib.slib ..\\myapp\\libs\\`}
        </CodeBlock>
        <CodeBlock filename="main.sere" wide>
          {highlightSere(`import mathlib

def main() -> i32:
    return mathlib.add(2, 3)`)}
        </CodeBlock>
        <div className="flex flex-wrap gap-2">
          <Button href="/docs/installing-packages" variant="secondary">
            How to install a package
          </Button>
          <Button href="/docs/libraries" variant="secondary">
            Libraries in the docs
          </Button>
        </div>
      </Stack>
    </PageIntro>
  );
}
