import BrandMark from "./components/BrandMark";
import Card from "./components/Card";
import CodeBlock from "./components/CodeBlock";
import Container from "./components/Container";
import Grid from "./components/Grid";
import Heading from "./components/Heading";
import Link from "next/link";
import HomeHeroActions from "./components/HomeHeroActions";
import Reveal from "./components/Reveal";
import Section from "./components/Section";
import Stack from "./components/Stack";
import Text from "./components/Text";
import { getReleaseCatalog, recommendedRelease } from "./lib/release";
import { CODE_SAMPLE } from "./utils/code";
import { highlightSere } from "./utils/highlight";

export const revalidate = 300;

function Feature({
  title,
  href,
  delay = 0,
  children,
}: {
  title: string;
  href?: string;
  delay?: number;
  children: string;
}) {
  return (
    <Reveal delay={delay}>
      {href ? (
        <Link href={href} className="block no-underline">
          <Card variant="elevated">
            <Stack gap="sm">
              <Heading level={3}>{title}</Heading>
              <Text muted className="text-sm leading-6">
                {children}
              </Text>
              <span className="text-xs font-medium text-primary">
                Read the docs →
              </span>
            </Stack>
          </Card>
        </Link>
      ) : (
        <Card variant="elevated">
          <Stack gap="sm">
            <Heading level={3}>{title}</Heading>
            <Text muted className="text-sm leading-6">
              {children}
            </Text>
          </Stack>
        </Card>
      )}
    </Reveal>
  );
}

export default async function Home() {
  const catalog = await getReleaseCatalog();
  const featured = recommendedRelease(catalog);
  const downloadHref = featured?.installer?.url ?? featured?.zip?.url ?? "/install";
  const downloadLabel = featured?.installer
    ? `Download installer ${featured.tag}`
    : featured ? `Download ${featured.tag}` : "Install";

  return (
    <Container>
      <Section className="relative flex flex-col justify-center py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-32 bg-gradient-to-t from-card/40 to-transparent" />
        </div>
        <div className="relative flex flex-col items-center justify-center gap-10 md:flex-row md:items-center md:gap-16">
          <div className="fade-up flex max-w-xl flex-col items-start gap-6 text-left">
            <p className="m-0 text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
              Compiled language · native toolchain
            </p>
            <div className="flex items-center gap-5 md:gap-7">
              <div className="relative transition-transform duration-500 group-hover:scale-105">
                <BrandMark size={104} priority />
                <div className="absolute -inset-1 bg-primary/10 rounded-full blur-md -z-10 group-hover:bg-primary/20 transition-colors duration-300" />
              </div>
              <Heading className="text-5xl sm:text-6xl">
                Simple.
                <br />
                <span className="hero-compiled">Compiled.</span>
                <br />
                Powerful.
              </Heading>
            </div>
            <Text muted className="max-w-md text-base leading-7">
              Sere reads like Python and compiles to native code through LLVM.
              Write it, build it, run it — same toolchain, no runtime hidden in the background.
            </Text>
            <HomeHeroActions
              downloadHref={downloadHref}
              downloadLabel={downloadLabel}
            />
          </div>
          <div className="fade-up fade-up-delay relative flex w-fit max-w-full flex-col items-stretch gap-4">
            <CodeBlock filename="main.sere">
              {highlightSere(CODE_SAMPLE)}
            </CodeBlock>
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-24 h-8 bg-gradient-to-t from-card/50 to-transparent rounded-full blur-sm" />
          </div>
        </div>
      </Section>

      <Section className="py-16 md:py-20">
        <Stack gap="lg">
          <Reveal>
            <Heading level={2}>Write once. Run anywhere.</Heading>
            <Text muted className="max-w-xl">
              Sere takes your code and turns it into a standalone binary.
              No interpreter, no virtual machine, no extra runtime to bundle.
            </Text>
          </Reveal>
          <Grid cols={3}>
            <Feature title="Clean syntax">
              Definitions, lists, f-strings, and indentation.
              Once you read a few lines, you are already writing.
            </Feature>
            <Feature title="Native binaries" delay={80}>
              LLVM 22 backend turns Sere into a real executable.
              Your code runs directly on the machine — nothing in between.
            </Feature>
            <Feature title="When you need it" delay={160}>
              Unique and Shared pointers, structs, enums, and macros.
              Drop down to systems level work without leaving the language.
            </Feature>
          </Grid>
        </Stack>
      </Section>

      <Section className="py-16 md:py-20">
        <Stack gap="lg">
          <Reveal>
            <Heading level={2}>The pieces that matter</Heading>
          </Reveal>
          <Grid cols={3}>
            <Feature title="Real types" href="/docs/types">
              i8 through i64, f32 and f64, list[T], dict[K, V], Unique[T],
              and structs that copy by value. Types are checked at compile time.
            </Feature>
            <Feature title="Macros" href="/docs/macros" delay={80}>
              Quote bodies and call name!(...) when you need them.
              Generate code at compile time without leaving Sere.
            </Feature>
            <Feature title="Memory control" href="/docs/memory" delay={160}>
              unique, shared, alloc, and free give you a choice.
              Plug in mark-sweep, arena allocation, or write your own collector.
            </Feature>
            <Feature title="Clear errors" href="/docs/errors">
              TypeError, NameError, AttributeError — names that match what went wrong.
              Diagnostics point to the exact spot, not just the line above it.
            </Feature>
            <Feature title="Editor support" href="/docs/diagnostics" delay={80}>
              LSP for Cursor and VS Code handles highlighting, go-to-definition,
              hover, rename, and the usual # type: ignore escape hatch.
            </Feature>
            <Feature title="Libraries" href="/docs/libraries" delay={160}>
              Pack a project into a .slib and drop it in libs/.
              Native C in the library compiles into the same file.
            </Feature>
          </Grid>
        </Stack>
      </Section>

    </Container>
  );
}
