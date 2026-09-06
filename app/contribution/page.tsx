import type { Metadata } from "next";
import Button from "../components/Button";
import Card from "../components/Card";
import Grid from "../components/Grid";
import Heading from "../components/Heading";
import PageIntro from "../components/PageIntro";
import Reveal from "../components/Reveal";
import Stack from "../components/Stack";
import Text from "../components/Text";

export const metadata: Metadata = {
  title: "Contribution — Sere",
  description: "How to contribute to the Sere compiler, runtime, and tooling.",
};

const PILLARS = [
  {
    title: "Compiler",
    description: "The lexer, parser, type checker, and LLVM codegen live in the compiler crate. Start with a small patch that touches one phase.",
    href: "https://github.com/Sere-Language/sere/tree/main/compiler",
  },
  {
    title: "Runtime & stdlib",
    description: "Unique and Shared pointers, the prelude, and the opt-in modules are all visible in the repo. Add a function or fix a bug in one of them.",
    href: "https://github.com/Sere-Language/sere/tree/main/stdlib",
  },
  {
    title: "Editor tooling",
    description: "The LSP and VS Code extension are open too. Miss a hover payload or a rename? That is a good first issue.",
    href: "https://github.com/Sere-Language/sere/tree/main/tools",
  },
] as const;

const HOW_TO = [
  {
    step: "Pick something small",
    detail: "A typo fix, a clearer error message, or a missing test case is a solid first contribution.",
  },
  {
    step: "Read CONTRIBUTING.md",
    detail: "It covers the patch process, review expectations, and how the repository is laid out.",
  },
  {
    step: "Know the pipeline",
    detail: "Lexer, parser, macros, type checker, then LLVM codegen. Each crate has its own readme.",
  },
  {
    step: "Open a focused pull request",
    detail: "One thing per PR. Match the existing style and add a test when the change deserves one.",
  },
] as const;

export default function ContributionPage() {
  return (
    <PageIntro
      eyebrow="Open source"
      title="Contribution"
      description="The compiler, runtime, stdlib, and editor tooling all take patches. Start with something small and keep it typed."
    >
      <Reveal>
        <Grid cols={3}>
          {PILLARS.map((pillar) => (
            <Card key={pillar.title} variant="elevated" hover className="h-full">
              <Stack gap="sm">
                <Heading level={3}>{pillar.title}</Heading>
                <Text muted className="text-sm leading-6">
                  {pillar.description}
                </Text>
                <Button href={pillar.href} variant="ghost" size="sm" className="mt-1">
                  Explore this area
                </Button>
              </Stack>
            </Card>
          ))}
        </Grid>
      </Reveal>

      <Stack gap="lg" className="mt-12">
        <Reveal>
          <Heading level={2}>How to contribute</Heading>
        </Reveal>
        <Grid cols={2}>
          {HOW_TO.map((item, index) => (
            <Reveal key={item.step} delay={index * 80}>
              <Card variant="panel" hover className="h-full">
                <Stack gap="sm">
                  <Heading level={3}>{item.step}</Heading>
                  <Text muted className="text-sm leading-6">
                    {item.detail}
                  </Text>
                </Stack>
              </Card>
            </Reveal>
          ))}
        </Grid>
      </Stack>

      <div className="flex flex-wrap items-center gap-3 mt-8">
        <Button href="https://github.com/Sere-Language/sere/blob/main/CONTRIBUTING.md">
          Contributing guide
        </Button>
        <Button href="https://github.com/Sere-Language/sere/pulls" variant="secondary">
          Pull requests
        </Button>
        <Button href="https://github.com/Sere-Language/sere/issues" variant="ghost">
          Good first issues
        </Button>
      </div>
    </PageIntro>
  );
}
