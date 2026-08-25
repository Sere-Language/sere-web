import type { Metadata } from "next";
import CloudCtaBand from "../components/CloudCtaBand";
import Button from "../components/Button";
import Card from "../components/Card";
import CodeBlock from "../components/CodeBlock";
import Grid from "../components/Grid";
import Heading from "../components/Heading";
import PageIntro from "../components/PageIntro";
import Reveal from "../components/Reveal";
import Stack from "../components/Stack";
import Text from "../components/Text";
import { highlightSere } from "../utils/highlight";

export const metadata: Metadata = {
  title: "Libraries — Sere",
  description: "Standard library modules and drop-in .slib packages.",
};

const MODULES = [
  { name: "prelude", body: "Always injected: print, abs, min, max, Int / Float, dbg!." },
  { name: "io", body: "read_line, eprint — extra I/O on top of the print intrinsic." },
  { name: "fs / path / os / env / sys", body: "Files, paths, process, and the host." },
  { name: "string / bytes / encoding / regex", body: "Text and binary. Backtick literals type as regex." },
  { name: "math / vec / matrix / ml / arrays", body: "Numeric work and linear algebra." },
  { name: "hash / random / time / log / bit", body: "Utilities you reach for in a real binary." },
  { name: "gc / heap / memory", body: "Collectors, arenas, pointer vocabulary." },
  { name: "inspect", body: "label and describe — not the builtin typeof / dir." },
  { name: "html_lang", body: "html: raw macro plus the Html wrapper." },
  { name: "windows / gl / qt6", body: "Win32, OpenGL 2.1+, Qt widgets (stub if missing)." },
  { name: "requests", body: "HTTP client: get, post, put, delete." },
  { name: "wsgi", body: "Blocking HTTP server. Subclass Handler and implement handle." },
] as const;

export default function LibrariesPage() {
  return (
    <PageIntro
      eyebrow="Packages"
      title="Libraries"
      description="The stdlib ships with the compiler. Your own code packs into a .slib you drop in libs/. A package manager is not here yet."
    >
      <Stack gap="lg">
        <Reveal>
          <Stack gap="sm">
            <Heading level={2}>.slib</Heading>
            <Text muted className="max-w-2xl">
              Create a library, pack it into one file, copy that file into
              another project. Folder libraries work too if you do not want to
              pack.
            </Text>
          </Stack>
        </Reveal>
        <CodeBlock filename="powershell" wide quiet>
          {`sere init-lib mathlib
cd mathlib
sere pack
copy dist\\mathlib.slib ..\\myapp\\libs\\`}
        </CodeBlock>
        <CodeBlock filename="main.sere" wide quiet>
          {highlightSere(`import mathlib

def main() -> i32:
    return mathlib.add(2, 3)`)}
        </CodeBlock>
        <Grid cols={2}>
          <Reveal>
            <Card>
              <Stack gap="sm">
                <Heading level={3}>What gets packed</Heading>
                <Text muted className="text-sm leading-6">
                  The entry, the local modules it actually imports, and compiled
                  native objects. Unused files next to the library stay out.
                </Text>
              </Stack>
            </Card>
          </Reveal>
          <Reveal delay={80}>
            <Card>
              <Stack gap="sm">
                <Heading level={3}>Folder form</Heading>
                <Text muted className="text-sm leading-6">
                  <code>libs/mylib/lib.sere</code> or <code>mylib.sere</code>,
                  plus optional <code>.c</code> / <code>native/</code>. Same
                  import, no pack step.
                </Text>
              </Stack>
            </Card>
          </Reveal>
        </Grid>
        <Button href="/docs/libraries">Libraries in the docs</Button>
      </Stack>

      <Reveal>
        <CloudCtaBand
          title="Drop a .slib in the cloud"
          body="Create a library workspace, pack it, and import it from another project — all in the browser."
        />
      </Reveal>

      <Stack gap="lg">
        <Reveal>
          <Stack gap="sm">
            <Heading level={2}>Standard library</Heading>
            <Text muted className="max-w-2xl">
              Prelude is always there. Everything else is <code>import</code>.
            </Text>
          </Stack>
        </Reveal>
        <Grid cols={2}>
          {MODULES.map((mod, index) => (
            <Reveal key={mod.name} delay={(index % 2) * 80}>
              <Card>
                <Stack gap="sm">
                  <Heading level={3}>{mod.name}</Heading>
                  <Text muted className="text-sm leading-6">
                    {mod.body}
                  </Text>
                </Stack>
              </Card>
            </Reveal>
          ))}
        </Grid>
      </Stack>
    </PageIntro>
  );
}
