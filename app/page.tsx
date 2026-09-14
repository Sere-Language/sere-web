import type { Metadata } from "next";
import Link from "next/link";
import BrandMark from "./components/BrandMark";
import Card from "./components/Card";
import CodeBlock from "./components/CodeBlock";
import Container from "./components/Container";
import Grid from "./components/Grid";
import Heading from "./components/Heading";
import HomeHeroActions from "./components/HomeHeroActions";
import JsonLd from "./components/JsonLd";
import Reveal from "./components/Reveal";
import Section from "./components/Section";
import Stack from "./components/Stack";
import Text from "./components/Text";
import { getReleaseCatalog, recommendedRelease } from "./lib/release";
import {
  SITE_DESCRIPTION,
  SITE_TITLE,
  faqJsonLd,
  pageMetadata,
  softwareApplicationJsonLd,
} from "./lib/seo";
import { CODE_SAMPLE } from "./utils/code";
import { highlightSere } from "./utils/highlight";

export const revalidate = 300;

export const metadata: Metadata = pageMetadata({
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  path: "/",
  absoluteTitle: true,
});

/**
 * Answers are kept in one place so the visible section and the FAQPage
 * structured data can never disagree.
 */
const FAQS = [
  {
    question: "What is Sere?",
    answer:
      "Sere is a statically typed, indentation-significant programming language that reads like Python and compiles to native code. It is built for people who want a small, readable language without giving up control over memory or performance.",
  },
  {
    question: "Does Sere need a runtime or a virtual machine?",
    answer:
      "No. Sere compiles your source into a standalone native binary. There is no interpreter, virtual machine, or runtime to bundle with your program — the build output is a real executable.",
  },
  {
    question: "What does Sere compile to?",
    answer:
      "Sere lowers to LLVM 22 IR and then to native machine code. sere build main.sere produces ./main, and sere --emit-llvm or sere --emit-asm let you inspect the intermediate output.",
  },
  {
    question: "How do I install the Sere toolchain?",
    answer:
      "Download the Windows installer or a release archive from the install page, then put the compiler on your PATH. Building from source needs CMake 3.28+, Ninja 1.11+, Visual Studio 2022 Build Tools, and the LLVM 22.1.8 clang+llvm archive.",
  },
  {
    question: "Is there editor support for Sere?",
    answer:
      "Yes. The toolchain ships a language server (sere --lsp) and a VS Code extension with highlighting, go-to-definition, hover, and rename. The extension also works in Cursor.",
  },
  {
    question: "How do I add a third-party library?",
    answer:
      "Pack a project with sere pack to produce a .slib file, then drop it in your project's libs/ directory. The standard library ships with the compiler, and there is no package manager yet.",
  },
] as const;

function Feature({
  title,
  href,
  index,
  delay = 0,
  children,
}: {
  title: string;
  href?: string;
  index: number;
  delay?: number;
  children: string;
}) {
  const serial = String(index).padStart(2, "0");

  const body = (
    <Card variant="elevated" className="h-full">
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="serial">{serial}</span>
          <span className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
        </div>
        <Heading level={3}>{title}</Heading>
        <Text muted className="text-sm leading-6">
          {children}
        </Text>
        {href ? (
          <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-xs font-medium text-primary">
            Read the docs
            <span className="transition-transform duration-200 group-hover/card:translate-x-0.5">→</span>
          </span>
        ) : null}
      </div>
    </Card>
  );

  return (
    <Reveal delay={delay} className="h-full">
      {href ? (
        <Link href={href} className="group/card block h-full no-underline">
          {body}
        </Link>
      ) : (
        body
      )}
    </Reveal>
  );
}

const HERO_SPECS: Array<[string, string]> = [
  ["Backend", "LLVM 22"],
  ["Output", "Native binary"],
  ["Tooling", "LSP · VSIX"],
];

export default async function Home() {
  const catalog = await getReleaseCatalog();
  const featured = recommendedRelease(catalog);
  const downloadHref = featured?.installer?.url ?? featured?.zip?.url ?? "/install";
  const downloadLabel = featured?.installer
    ? `Download installer ${featured.tag}`
    : featured ? `Download ${featured.tag}` : "Install";

  return (
    <Container>
      <JsonLd
        data={[
          softwareApplicationJsonLd({
            version: featured?.tag ?? null,
            downloadUrl: downloadHref,
            releaseNotesUrl: featured?.pageUrl ?? null,
            datePublished: featured?.publishedAt ?? null,
          }),
          faqJsonLd(
            FAQS.map((faq) => ({
              question: faq.question,
              answer: faq.answer,
            })),
          ),
        ]}
      />
      <Section className="relative flex flex-col justify-center overflow-hidden py-16 md:py-24">
        {/* Ambient depth behind the hero */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-28 left-[14%] h-[440px] w-[440px] rounded-full bg-primary/[0.09] blur-[100px]" />
          <div className="absolute -bottom-32 right-[4%] h-[360px] w-[360px] rounded-full bg-primary/[0.05] blur-[110px]" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
        </div>

        <div className="relative grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16">
          <div className="flex flex-col items-start gap-7">
            <p className="chip fade-up">
              <span className="chip-dot" />
              Compiled language · Native toolchain
            </p>

            <div className="flex items-center gap-5 md:gap-7">
              <div className="relative shrink-0">
                <div className="absolute -inset-5 rounded-full bg-primary/20 blur-2xl" />
                <div
                  className="relative rounded-2xl border border-border-strong p-2.5 shadow-xl"
                  style={{
                    background:
                      "linear-gradient(180deg, var(--color-card-elevated-start) 0%, var(--color-card-elevated-end) 100%)",
                    boxShadow:
                      "0 1px 0 rgba(255,255,255,0.07) inset, 0 -1px 0 rgba(0,0,0,0.55) inset, 0 18px 38px -14px rgba(0,0,0,0.75)",
                  }}
                >
                  <BrandMark
                    size={92}
                    priority
                    className="relative block drop-shadow-[0_8px_20px_rgba(0,0,0,0.55)]"
                  />
                </div>
              </div>
              <Heading className="fade-up text-5xl leading-[1.02] tracking-tight sm:text-6xl">
                <span className="sr-only">
                  Sere: a Python-like programming language that compiles to
                  native code.
                </span>
                <span aria-hidden="true">
                  Simple.
                  <br />
                  <span className="hero-compiled">Compiled.</span>
                  <br />
                  Powerful.
                </span>
              </Heading>
            </div>

            <Text muted className="fade-up fade-up-delay max-w-md text-base leading-7">
              Sere reads like Python and compiles down to native code through LLVM.
              Write it, build it, run it. Same toolchain the whole way, no runtime hiding in the background.
            </Text>

            <HomeHeroActions
              downloadHref={downloadHref}
              downloadLabel={downloadLabel}
            />

            <dl className="fade-up grid w-full max-w-md grid-cols-3 gap-px overflow-hidden rounded-lg border border-border-muted bg-border-muted">
              {HERO_SPECS.map(([label, value]) => (
                <div
                  key={label}
                  className="flex flex-col gap-1 bg-surface-raised/85 px-3.5 py-3"
                >
                  <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted/70">
                    {label}
                  </dt>
                  <dd className="m-0 text-[13px] font-medium text-foreground/90">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="fade-up fade-up-delay relative flex w-full min-w-0 flex-col">
            <CodeBlock filename="main.sere" wide>
              {highlightSere(CODE_SAMPLE)}
            </CodeBlock>
            <p className="mt-3.5 text-center font-mono text-[11px] text-muted/70">
              <span className="text-primary/80">$</span> sere build main.sere
              <span className="text-muted/40"> → </span>
              ./main
            </p>
          </div>
        </div>
      </Section>

      <Section className="py-16 md:py-20">
        <Stack gap="lg">
          <Reveal>
            <div className="flex flex-col gap-4">
              <p className="eyebrow">Standalone by design</p>
              <Heading level={2} className="section-title">
                Completely standalone.
              </Heading>
              <Text muted className="max-w-xl">
                Sere takes your code and turns it into a standalone binary.
                No interpreter, no virtual machine, no extra runtime to bundle.
              </Text>
            </div>
          </Reveal>
          <Grid cols={3}>
            <Feature index={1} title="Clean syntax">
              Definitions, lists, f-strings, and indentation.
              Once you read a few lines, you are already writing.
            </Feature>
            <Feature index={2} title="Native binaries" delay={80}>
              LLVM 22 backend turns Sere into a real executable.
              Your code runs directly on the machine, nothing in between.
            </Feature>
            <Feature index={3} title="When you need it" delay={160}>
              Unique and Shared pointers, structs, enums, and macros.
              Drop down to systems level work without leaving the language.
            </Feature>
          </Grid>
        </Stack>
      </Section>

      <Section className="py-16 md:py-20">
        <Stack gap="lg">
          <Reveal>
            <div className="flex flex-col gap-4">
              <p className="eyebrow">Language surface</p>
              <Heading level={2} className="section-title">
                The pieces that matter
              </Heading>
            </div>
          </Reveal>
          <Grid cols={3}>
            <Feature index={1} title="Real types" href="/docs/types">
              i8 through i64, f32 and f64, list[T], dict[K, V], Unique[T],
              and structs that copy by value. Checked at compile time, so you find out
              before you run it.
            </Feature>
            <Feature index={2} title="Macros" href="/docs/macros" delay={80}>
              Quote bodies and call name!(...) when you need them.
              Generate code at compile time without leaving Sere.
            </Feature>
            <Feature index={3} title="Memory control" href="/docs/memory" delay={160}>
              unique, shared, alloc, and free give you a choice.
              Plug in mark-sweep, arena allocation, or write your own collector.
            </Feature>
            <Feature index={4} title="Clear errors" href="/docs/errors">
              TypeError, NameError, AttributeError. Names that actually tell you what broke.
              Diagnostics point at the exact spot, not just the line above it.
            </Feature>
            <Feature index={5} title="Editor support" href="/docs/diagnostics" delay={80}>
              LSP for Cursor and VS Code handles highlighting, go-to-definition,
              hover, rename, and the usual # type: ignore escape hatch.
            </Feature>
            <Feature index={6} title="Libraries" href="/docs/libraries" delay={160}>
              Pack a project into a .slib and drop it in libs/.
              Native C in the library compiles into the same file.
            </Feature>
          </Grid>
        </Stack>
      </Section>

      <Section className="py-16 md:py-20">
        <Stack gap="lg">
          <Reveal>
            <div className="flex flex-col gap-4">
              <p className="eyebrow">Questions</p>
              <Heading level={2} className="section-title">
                Frequently asked
              </Heading>
              <Text muted className="max-w-xl">
                The short answers. Deeper detail lives in the{" "}
                <Link href="/docs" className="text-primary no-underline hover:underline">
                  documentation
                </Link>{" "}
                and the{" "}
                <Link href="/install" className="text-primary no-underline hover:underline">
                  install guide
                </Link>
                .
              </Text>
            </div>
          </Reveal>
          <Grid cols={2}>
            {FAQS.map((faq, index) => (
              <Reveal key={faq.question} delay={index * 60} className="h-full">
                <Card variant="elevated" className="h-full">
                  <Stack gap="sm">
                    <Heading level={3}>{faq.question}</Heading>
                    <Text muted className="text-sm leading-6">
                      {faq.answer}
                    </Text>
                  </Stack>
                </Card>
              </Reveal>
            ))}
          </Grid>
          <Reveal>
            <Text muted className="max-w-xl">
              Coming from Python?{" "}
              <Link
                href="/docs/sere-vs-python"
                className="text-primary no-underline hover:underline"
              >
                See how Sere compares
              </Link>
              .
            </Text>
          </Reveal>
        </Stack>
      </Section>

    </Container>
  );
}
