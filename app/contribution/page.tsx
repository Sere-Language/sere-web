import type { Metadata } from "next";
import CloudCtaBand from "../components/CloudCtaBand";
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
  description: "How to contribute to the Sere compiler and language.",
};

const STEPS = [
  {
    title: "Read the guide",
    body: "CONTRIBUTING.md covers patches, review, and how the tree is laid out.",
  },
  {
    title: "Know the pipeline",
    body: "Lexer, parser, macros, type checker, then LLVM codegen. Docs/README.md maps each library.",
  },
  {
    title: "Open a pull request",
    body: "Small, focused changes. Match the existing compiler style and add a test when you can.",
  },
] as const;

export default function ContributionPage() {
  return (
    <PageIntro
      eyebrow="Open source"
      title="Contribution"
      description="The compiler, runtime, stdlib, and editor tooling all take patches. Start with something small and keep it typed."
    >
      <Grid cols={3}>
        {STEPS.map((step, index) => (
          <Reveal key={step.title} delay={index * 80}>
            <Card>
              <Stack gap="sm">
                <Heading level={3}>{step.title}</Heading>
                <Text muted className="text-sm leading-6">
                  {step.body}
                </Text>
              </Stack>
            </Card>
          </Reveal>
        ))}
      </Grid>
      <div className="flex items-center gap-3">
        <Button href="https://github.com/Sere-Language/sere/blob/main/CONTRIBUTING.md">
          Contributing guide
        </Button>
        <Button href="https://github.com/Sere-Language/sere/pulls" variant="ghost">
          Pull requests
        </Button>
      </div>
      <Reveal>
        <CloudCtaBand
          title="See the workbench first"
          body="Use Sere Cloud to feel the language, then open a pull request on the compiler."
        />
      </Reveal>
    </PageIntro>
  );
}
