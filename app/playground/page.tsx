import type { Metadata } from "next";
import Container from "../components/Container";
import Heading from "../components/Heading";
import Section from "../components/Section";
import Stack from "../components/Stack";
import Text from "../components/Text";
import { pageMetadata } from "../lib/seo";
import PlaygroundLoader from "./PlaygroundLoader";

export const metadata: Metadata = pageMetadata({
  title: "Playground",
  description:
    "Try the Sere language in your browser. Write Sere code with syntax highlighting, compile it, and see the output in a terminal — no install required.",
  path: "/playground",
  keywords: [
    "Sere playground",
    "try Sere online",
    "Sere online compiler",
    "Sere code runner",
    "Sere REPL",
  ],
});

export default function PlaygroundPage() {
  return (
    <Container>
      <Section className="py-10 md:py-14">
        <Stack gap="lg">
          <Stack gap="sm">
            <Heading level={1} className="fade-up text-3xl font-semibold tracking-tight sm:text-4xl">
              Playground
            </Heading>
            <Text muted className="fade-up fade-up-delay max-w-2xl text-base leading-7">
              Write Sere, press <kbd>Run</kbd>, and watch it compile to a native
              binary and execute. The playground installs the latest release
              while it loads, then keeps itself current on every visit.
            </Text>
          </Stack>

          <PlaygroundLoader />
        </Stack>
      </Section>
    </Container>
  );
}
