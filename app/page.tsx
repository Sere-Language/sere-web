import BrandMark from "./components/BrandMark";
import Card from "./components/Card";
import CloudCtaBand from "./components/CloudCtaBand";
import CloudSnapshot from "./components/CloudSnapshot";
import CodeBlock from "./components/CodeBlock";
import Container from "./components/Container";
import Grid from "./components/Grid";
import Heading from "./components/Heading";
import HomeHeroActions from "./components/HomeHeroActions";
import Reveal from "./components/Reveal";
import TryInCloudButton from "./components/TryInCloudButton";
import Section from "./components/Section";
import Stack from "./components/Stack";
import Text from "./components/Text";
import { getReleaseCatalog, recommendedRelease } from "./lib/release";
import { CODE_SAMPLE } from "./utils/code";
import { highlightSere } from "./utils/highlight";

export const revalidate = 300;

function Feature({
  title,
  delay = 0,
  children,
}: {
  title: string;
  delay?: number;
  children: string;
}) {
  return (
    <Reveal delay={delay}>
      <Card className="relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary/80 before:to-transparent">
        <Stack gap="sm">
          <Heading level={3}>{title}</Heading>
          <Text muted className="text-sm leading-6">
            {children}
          </Text>
        </Stack>
      </Card>
    </Reveal>
  );
}

export default async function Home() {
  const catalog = await getReleaseCatalog();
  const featured = recommendedRelease(catalog);
  const downloadHref = featured?.zip?.url ?? "/install";
  const downloadLabel = featured ? `Download ${featured.tag}` : "Install";

  return (
    <Container>
      <Section className="relative flex min-h-[calc(100svh-7rem)] flex-col justify-center overflow-hidden py-10">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-8 h-72 w-[38rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(194,82,72,0.22),transparent_68%)] blur-2xl"
        />
        <div className="relative flex flex-col items-center justify-center gap-10 md:flex-row md:items-center md:gap-16">
          <div className="fade-up flex max-w-xl flex-col items-center gap-6 text-center md:items-start md:text-left">
            <p className="m-0 text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
              Compiled language · browser workspace
            </p>
            <div className="flex items-center gap-5 md:gap-7">
              <BrandMark
                size={148}
                priority
                className="hero-mark hidden sm:block"
              />
              <Heading className="text-6xl sm:text-7xl">
                Simple. <br />
                <span className="hero-compiled">Compiled.</span> <br />
                Powerful.
              </Heading>
            </div>
            <Text muted className="max-w-md text-base leading-7">
              Python-like syntax, LLVM native binaries. Write, build, and run
              Sere in the cloud — no local toolchain required.
            </Text>
            <HomeHeroActions
              downloadHref={downloadHref}
              downloadLabel={downloadLabel}
            />
          </div>
          <div className="fade-up fade-up-delay relative flex w-fit max-w-full flex-col items-stretch gap-4">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-8 rounded-[1.5rem] bg-[radial-gradient(ellipse_at_center,rgba(194,82,72,0.16),transparent_70%)]"
            />
            <CodeBlock filename="main.sere" className="relative">
              {highlightSere(CODE_SAMPLE)}
            </CodeBlock>
            <div className="relative flex justify-center md:justify-start">
              <TryInCloudButton className="w-full justify-center sm:w-auto" />
            </div>
          </div>
        </div>
      </Section>

      <Section className="pt-4">
        <Reveal>
          <CloudSnapshot priority />
        </Reveal>
      </Section>

      <Section>
        <Stack gap="lg">
          <Reveal>
            <Heading level={2}>Simple to write. Native to run.</Heading>
          </Reveal>
          <Grid cols={3}>
            <Feature title="Simple">
              Clean syntax: defs, lists, f-strings, and indentation. Read it
              once and you can start writing.
            </Feature>
            <Feature title="Compiled" delay={80}>
              LLVM 22 backend. Sere compiles to a native binary — no interpreter
              and no VM between you and the machine.
            </Feature>
            <Feature title="Powerful" delay={160}>
              Systems control when you need it: Unique and Shared pointers,
              structs, enums, and macros.
            </Feature>
          </Grid>
        </Stack>
      </Section>

      <Section>
        <Stack gap="lg">
          <Reveal>
            <Heading level={2}>What you get</Heading>
          </Reveal>
          <Grid cols={3}>
            <Feature title="Real types">
              i8–i64, f32/f64, list[T], dict[K, V], Unique[T], and copy-by-value
              structs. Types are checked, not guessed at runtime.
            </Feature>
            <Feature title="Macros" delay={80}>
              quote bodies and name!(...) invocation. Expand code at compile
              time without leaving the language.
            </Feature>
            <Feature title="Memory" delay={160}>
              unique, shared, alloc, and free. Plug in mark-sweep, arena, or
              your own collector.
            </Feature>
            <Feature title="Diagnostics">
              Errors are labeled TypeError, NameError, AttributeError — clear
              names that match what actually went wrong.
            </Feature>
            <Feature title="Tooling" delay={80}>
              LSP for Cursor and VS Code: highlighting, go-to-definition,
              hover, rename, and # type: ignore.
            </Feature>
            <Feature title="Libraries" delay={160}>
              Pack a project into a .slib and drop it in libs/. Native C in
              the library compiles into the same file.
            </Feature>
          </Grid>
        </Stack>
      </Section>

      <Section>
        <Reveal>
          <CloudCtaBand
            title="Start in the cloud"
            body={
              featured
                ? `Open a browser workspace, or grab ${featured.name} and install locally.`
                : "Open a browser workspace, or download a release zip to install locally."
            }
            primaryHref="/cloud"
            primaryLabel="Try in cloud"
          />
        </Reveal>
      </Section>
    </Container>
  );
}
