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
  title: "Community — Sere",
  description: "Follow releases, file issues, and talk through design in the open.",
};

export default function CommunityPage() {
  return (
    <PageIntro
      eyebrow="Open work"
      title="Community"
      description="The compiler, stdlib, examples, and this site all live in one repository. File issues there, read the release notes, and join the design conversations."
    >
      <Grid cols={2}>
        <Reveal>
          <Card variant="elevated">
            <Stack gap="sm">
              <Heading level={3}>GitHub repository</Heading>
              <Text muted className="text-sm leading-6">
                Source, examples, and the compiler share one repository. Releases, issues, and pull requests all live there.
              </Text>
              <Button href="https://github.com/Sere-Language/sere" size="sm">Open the repo</Button>
            </Stack>
          </Card>
        </Reveal>
        <Reveal delay={80}>
          <Card variant="elevated">
            <Stack gap="sm">
              <Heading level={3}>Issues & discussions</Heading>
              <Text muted className="text-sm leading-6">
                Bugs, language questions, and feature requests go on the issue tracker. Use it for anything that is not a private matter.
              </Text>
              <Button href="https://github.com/Sere-Language/sere/issues" variant="secondary" size="sm">View issues</Button>
            </Stack>
          </Card>
        </Reveal>
      </Grid>
    </PageIntro>
  );
}
