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
  title: "Community — Sere",
  description: "Talk about Sere, report issues, and follow the project.",
};

export default function CommunityPage() {
  return (
    <PageIntro
      eyebrow="Together"
      title="Community"
      description="Sere is built in the open. Use the repo to follow releases, file issues, and talk through design."
    >
      <Grid cols={2}>
        <Reveal>
          <Card>
            <Stack gap="sm">
              <Heading level={3}>GitHub</Heading>
              <Text muted className="text-sm leading-6">
                Source, examples, and the compiler live in one repository.
              </Text>
              <Button href="https://github.com/Sere-Language/sere">Open the repo</Button>
            </Stack>
          </Card>
        </Reveal>
        <Reveal delay={80}>
          <Card>
            <Stack gap="sm">
              <Heading level={3}>Issues</Heading>
              <Text muted className="text-sm leading-6">
                Bugs, language questions, and feature requests go on the tracker.
              </Text>
              <Button href="https://github.com/Sere-Language/sere/issues" variant="ghost">
                View issues
              </Button>
            </Stack>
          </Card>
        </Reveal>
      </Grid>
      <Reveal>
        <CloudCtaBand
          title="Talk is cheap. Compile it."
          body="Spin up a cloud workspace and try the language while you follow the repo."
        />
      </Reveal>
    </PageIntro>
  );
}
