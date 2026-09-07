import type { Metadata } from "next";
import Button from "../components/Button";
import Card from "../components/Card";
import CodeBlock from "../components/CodeBlock";
import Container from "../components/Container";
import Grid from "../components/Grid";
import Heading from "../components/Heading";
import ReleaseCard from "../components/ReleaseCard";
import Reveal from "../components/Reveal";
import Section from "../components/Section";
import Stack from "../components/Stack";
import Text from "../components/Text";
import {
  formatBytes,
  formatReleaseDate,
  getReleaseCatalog,
  recommendedRelease,
  SERE_GITHUB_REPO,
  SERE_RELEASES_PAGE,
} from "../lib/release";

export const metadata: Metadata = {
  title: "Install - Sere",
  description: "Install the Sere toolchain, put it on PATH, and compile a native binary.",
};

export const revalidate = 300;

const REQUIREMENTS = [
  { name: "CMake", detail: "3.28 or newer. 4.3 is fine." },
  { name: "Ninja", detail: "1.11 or newer for the Windows presets." },
  { name: "MSVC", detail: "Visual Studio 2022 Build Tools, x64." },
  { name: "LLVM", detail: "22.1.8 official clang+llvm Windows MSVC archive." },
] as const;

const COMMANDS = [
  { name: "sere init <app>", detail: "Create a new project with src/main.sere." },
  { name: "sere init-lib <name>", detail: "Create a kind = \"lib\" project you can pack." },
  { name: "sere pack", detail: "Write dist/<name>.slib from a library project." },
  { name: "sere build", detail: "Compile src/main.sere, or pack a lib project." },
  { name: "sere run", detail: "Build, then execute the binary." },
  { name: "sere refresh-bin", detail: "Copy compiler, runtime, and stdlib into ./bin." },
  { name: "sere --analyze file.sere", detail: "Print JSON diagnostics." },
  { name: "sere --lsp", detail: "Language server on stdin/stdout." },
  { name: "sere --emit-llvm", detail: "Write LLVM IR instead of an executable." },
  { name: "sere --emit-asm", detail: "Write native assembly." },
  { name: "sere --build-installer", detail: "Package the Windows setup.exe." },
] as const;

function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Reveal>
      <Stack gap="sm">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-xs text-primary">{n}</span>
          <Heading level={3}>{title}</Heading>
        </div>
        {children}
      </Stack>
    </Reveal>
  );
}

export default async function InstallPage() {
  const catalog = await getReleaseCatalog();
  const recommended = recommendedRelease(catalog);
  const latestIsStable =
    catalog.latest !== null &&
    catalog.latestStable !== null &&
    catalog.latest.tag === catalog.latestStable.tag;
  const zipName = recommended?.zip?.name ?? "sere.zip";
  const vsixName = recommended?.vsix?.name ?? "sere.vsix";

  return (
    <Container>
      <Section className="pt-12 pb-10">
        <Stack gap="lg">
          <Stack gap="sm">
            <p className="fade-up m-0 text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
              Toolchain
            </p>
            <Heading className="fade-up">
              Install Sere
            </Heading>
            <Text muted className="fade-up fade-up-delay max-w-2xl">
              Downloads come from GitHub Releases. Run the Windows installer,
              or grab a portable zip and run <code>install.ps1</code>. Building from source is
              still how you work on the compiler itself.
            </Text>
          </Stack>

          {catalog.latest ? (
            <Grid cols={2}>
              <Reveal>
                <ReleaseCard
                  release={catalog.latest}
                  eyebrow={latestIsStable ? "Latest · stable" : "Latest"}
                />
              </Reveal>
              {!latestIsStable && catalog.latestStable ? (
                <Reveal delay={80}>
                  <ReleaseCard
                    release={catalog.latestStable}
                    eyebrow="Latest stable"
                  />
                </Reveal>
              ) : (
                <Reveal delay={80}>
                  <Card variant="plain">
                    <Stack gap="sm">
                      <Heading level={3}>From source</Heading>
                      <Text muted className="text-sm leading-6">
                        Clone the repo, bootstrap LLVM, configure with CMake, and
                        build. Developer scripts, not end-user steps.
                      </Text>
                      <Button href="#from-source" variant="ghost">
                        Build from source
                      </Button>
                    </Stack>
                  </Card>
                </Reveal>
              )}
            </Grid>
          ) : (
            <Reveal>
              <Card variant="plain">
                <Stack gap="sm">
                  <Heading level={3}>Releases unavailable</Heading>
                  <Text muted className="text-sm leading-6">
                    GitHub did not return the catalog just now. Open the repo
                    releases page instead.
                  </Text>
                  <Button href={SERE_RELEASES_PAGE}>GitHub releases</Button>
                </Stack>
              </Card>
            </Reveal>
          )}

          {!latestIsStable && catalog.latestStable ? (
            <Reveal>
              <div className="flex flex-wrap gap-2">
                <Button href="#from-source" variant="ghost">
                  Build from source
                </Button>
                <Button href={recommended?.installer ? "#installer" : "#portable"} variant="ghost">
                  Install steps
                </Button>
              </div>
            </Reveal>
          ) : catalog.latest ? (
            <Reveal>
              <Button href={recommended?.installer ? "#installer" : "#portable"} variant="ghost">
                Install steps
              </Button>
            </Reveal>
          ) : null}
        </Stack>
      </Section>

      {catalog.others.length > 0 ? (
        <Section id="releases">
          <Stack gap="lg">
            <Reveal>
              <Stack gap="sm">
                <Heading level={2}>Other releases</Heading>
                <Text muted className="max-w-2xl">
                  Everything else on GitHub. Prefer the latest release unless you are
                  chasing a specific tag.
                </Text>
              </Stack>
            </Reveal>
            <div className="overflow-hidden rounded-lg border border-border">
              {catalog.others.map((release) => {
                const date = formatReleaseDate(release.publishedAt);
                const zipSize = release.zip
                  ? formatBytes(release.zip.size)
                  : "";
                return (
                  <div
                    key={release.tag}
                    className="flex flex-col gap-3 border-b border-border px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{release.name}</span>
                        {release.stable ? (
                          <span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted">
                            stable
                          </span>
                        ) : null}
                        {release.prerelease ? (
                          <span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted">
                            pre
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        <code>{release.tag}</code>
                        {date ? ` · ${date}` : ""}
                        {zipSize ? ` · ${zipSize}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {release.installer ? (
                        <Button href={release.installer.url}>Download installer</Button>
                      ) : null}
                      {release.zip ? (
                        <Button href={release.zip.url} variant={release.installer ? "ghost" : "primary"}>Zip</Button>
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
                  </div>
                );
              })}
            </div>
            <Button href={SERE_RELEASES_PAGE} variant="ghost">
              All releases on GitHub
            </Button>
          </Stack>
        </Section>
      ) : null}

      <Section id="portable">
        <Stack gap="lg">
          <Reveal>
            <Stack gap="sm">
              <Heading level={2}>Portable zip</Heading>
              <Text muted className="max-w-2xl">
                Unzip {recommended?.name ?? "the release"}, then run the script.
                LLVM is reused from a previous bootstrap or downloaded, it is
                not stored in git. After install, a new terminal should run{" "}
                <code>sere --version</code> without this repository.
              </Text>
            </Stack>
          </Reveal>
          <CodeBlock filename="powershell" wide>
            {`# after unzipping ${zipName}
.\\install.ps1
sere --version`}
          </CodeBlock>
          <Text muted className="text-sm">
            Options: <code>-Prefix</code>, <code>-NoPath</code>,{" "}
            <code>-Associate</code>, <code>-Editor</code>, <code>-Msvc</code>,{" "}
            <code>-DownloadLlvm</code>. Uninstall with{" "}
            <code>uninstall.ps1</code>. From a source checkout,{" "}
            <code>.\releases\stage.ps1</code> refreshes the folder from the
            current build. Default prefix is{" "}
            <code>%LOCALAPPDATA%\Programs\Sere</code>.
          </Text>
          <div className="flex flex-wrap gap-3">
            {recommended?.zip ? (
              <Button href={recommended.zip.url}>Download {zipName}</Button>
            ) : (
              <Button href={SERE_RELEASES_PAGE}>Choose a zip</Button>
            )}
            {recommended ? (
              <Button href={recommended.pageUrl} variant="ghost">
                Release notes
              </Button>
            ) : null}
          </div>
        </Stack>
      </Section>

      <Section className="pt-6">
        <Stack gap="lg">
          <Reveal>
            <Stack gap="sm">
              <Heading level={2}>Requirements</Heading>
              <Text muted className="max-w-2xl">
                The Windows ClangCL presets expect these on the machine before
                you configure. LLVM is installed to
                <code> %LOCALAPPDATA%\sere\toolchains\llvm-22.1.8 </code>
                so it does not live inside OneDrive.
              </Text>
            </Stack>
          </Reveal>
          <Grid cols={2}>
            {REQUIREMENTS.map((item, index) => (
              <Reveal key={item.name} delay={(index % 2) * 80}>
                <Card variant="plain">
                  <Stack gap="sm">
                    <Heading level={3}>{item.name}</Heading>
                    <Text muted className="text-sm leading-6">
                      {item.detail}
                    </Text>
                  </Stack>
                </Card>
              </Reveal>
            ))}
          </Grid>
        </Stack>
      </Section>

      <Section id="from-source">
        <Stack gap="lg">
          <Reveal>
            <Stack gap="sm">
              <Heading level={2}>Build from source</Heading>
              <Text muted className="max-w-2xl">
                Work from the repository root in PowerShell. Dot-source
                <code> env.ps1 </code> so MSVC <code> vcvars64 </code> and
                <code> SERE_LLVM_DIR </code> stay in the current session.
              </Text>
            </Stack>
          </Reveal>

          <Step n="01" title="Get the repository">
            <CodeBlock filename="powershell" wide>
              {`git clone https://github.com/${SERE_GITHUB_REPO}.git
cd sere`}
            </CodeBlock>
          </Step>

          <Step n="02" title="Bootstrap and build">
            <Text muted className="text-sm">
              <code>bootstrap.ps1</code> fetches the pinned LLVM. Then configure
              and compile the compiler itself.
            </Text>
            <CodeBlock filename="powershell" wide>
              {`.\\scripts\\bootstrap.ps1
. .\\scripts\\env.ps1
cmake --preset windows-clang-cl-relwithdebinfo
cmake --build --preset windows-clang-cl-relwithdebinfo`}
            </CodeBlock>
          </Step>

          <Step n="03" title="Run the tests">
            <CodeBlock filename="powershell" wide>
              {`ctest --preset windows-clang-cl-relwithdebinfo --output-on-failure`}
            </CodeBlock>
          </Step>

          <Step n="04" title="Put sere on PATH">
            <Text muted className="text-sm">
              Session-only first. Add <code>-Persistent</code> when you want it
              in your user PATH.
            </Text>
            <CodeBlock filename="powershell" wide>
              {`.\\bin\\sere-path.ps1
.\\bin\\sere-path.ps1 -Persistent`}
            </CodeBlock>
          </Step>
        </Stack>
      </Section>

      <Section id="installer">
        <Stack gap="lg">
          <Reveal>
            <Stack gap="sm">
              <Heading level={2}>Windows installer</Heading>
              <Text muted className="max-w-2xl">
                Download the setup.exe release asset and run it to follow the
                installation wizard. After installation, open a new terminal
                and run <code>sere --version</code>.
              </Text>
            </Stack>
          </Reveal>
          {recommended?.installer ? (
            <Button href={recommended.installer.url}>Download installer</Button>
          ) : (
            <Button href={SERE_RELEASES_PAGE}>Browse installers on GitHub</Button>
          )}
          <Text muted className="text-sm">
            To build the installer from a source checkout:
          </Text>
          <CodeBlock filename="powershell" wide>
            {`.\\scripts\\bootstrap-innosetup.ps1
sere --build-installer`}
          </CodeBlock>
          <Text muted className="text-sm">
            Writes <code>dist/Sere-&lt;version&gt;-setup.exe</code>.
          </Text>
        </Stack>
      </Section>

      <Section>
        <Stack gap="lg">
          <Reveal>
            <Stack gap="sm">
              <Heading level={2}>First project</Heading>
              <Text muted className="max-w-2xl">
                <code>sere build</code> compiles <code>src/main.sere</code>.
                <code>sere run</code> builds and executes
                <code> bin/&lt;name&gt;.exe </code>. Dot-source
                <code> activate.ps1 </code> so this terminal stays put.
              </Text>
            </Stack>
          </Reveal>
          <CodeBlock filename="powershell" wide>
            {`.\\bin\\sere.exe init myapp
cd myapp
. .\\scripts\\activate.ps1
sere build
sere run
deactivate`}
          </CodeBlock>
          <Grid cols={2}>
            <Reveal>
              <Card variant="plain">
                <Stack gap="sm">
                  <Heading level={3}>activate.ps1</Heading>
                  <Text muted className="text-sm leading-6">
                    Dot-source it. Running the script without the leading
                    <code> . </code> starts a nested <code>sere shell</code>{" "}
                    instead of staying in this terminal.
                  </Text>
                </Stack>
              </Card>
            </Reveal>
            <Reveal delay={80}>
              <Card variant="plain">
                <Stack gap="sm">
                  <Heading level={3}>deactivate</Heading>
                  <Text muted className="text-sm leading-6">
                    Restores PATH and the prompt. It does not close the window.
                  </Text>
                </Stack>
              </Card>
            </Reveal>
          </Grid>
        </Stack>
      </Section>

      <Section>
        <Stack gap="lg">
          <Reveal>
            <Stack gap="sm">
              <Heading level={2}>Compile a file</Heading>
              <Text muted className="max-w-2xl">
                Once <code>sere</code> is on PATH it finds the pinned LLVM
                <code> clang </code> / <code> lld </code> automatically. You
                only need <code> scripts/env.ps1 </code> when you are building
                the compiler itself.
              </Text>
            </Stack>
          </Reveal>
          <CodeBlock filename="powershell" wide>
            {`sere examples\\hello.sere -o hello.exe
.\\hello.exe

sere --emit-llvm examples\\hello.sere -o hello.ll
sere --emit-asm examples\\hello.sere -o hello.s`}
          </CodeBlock>
        </Stack>
      </Section>

      <Section>
        <Stack gap="lg">
          <Reveal>
            <Stack gap="sm">
              <Heading level={2}>Editor</Heading>
              <Text muted className="max-w-2xl">
                The workspace extension in <code>editors/vscode</code> talks to
                <code> sere --lsp </code>. You get highlighting, diagnostics,
                hover, completion, rename, and go-to-definition.
              </Text>
            </Stack>
          </Reveal>
          {recommended?.vsix ? (
            <div className="flex flex-wrap gap-3">
              <Button href={recommended.vsix.url}>Download {vsixName}</Button>
              <Button href={recommended.pageUrl} variant="ghost">
                Release notes
              </Button>
            </div>
          ) : (
            <CodeBlock filename="powershell" wide>
              {`.\\scripts\\package-vsix.ps1`}
            </CodeBlock>
          )}
          <Text muted className="text-sm">
            {recommended?.vsix
              ? "In Cursor or VS Code: Extensions → … → Install from VSIX… then reload the window."
              : "That writes a .vsix under editors/vscode and dist/. In Cursor or VS Code: Extensions → … → Install from VSIX… then reload the window."}{" "}
            Set <code> sere.compilerPath </code> if the compiler is not on PATH.
          </Text>
        </Stack>
      </Section>

      <Section>
        <Stack gap="lg">
          <Reveal>
            <Stack gap="sm">
              <Heading level={2}>Command reference</Heading>
              <Text muted className="max-w-2xl">
                The driver is one binary. These are the flags and verbs you will
                use most.
              </Text>
            </Stack>
          </Reveal>
          <Grid cols={2}>
            {COMMANDS.map((command, index) => (
              <Reveal key={command.name} delay={(index % 2) * 60}>
                <Card variant="plain">
                  <Stack gap="sm">
                    <Heading level={3}>
                      <span className="font-mono text-sm">{command.name}</span>
                    </Heading>
                    <Text muted className="text-sm leading-6">
                      {command.detail}
                    </Text>
                  </Stack>
                </Card>
              </Reveal>
            ))}
          </Grid>
        </Stack>
      </Section>

    </Container>
  );
}
