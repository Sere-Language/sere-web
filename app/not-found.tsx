import type { Metadata } from "next";
import Button from "./components/Button";
import Container from "./components/Container";
import Heading from "./components/Heading";
import Section from "./components/Section";
import Text from "./components/Text";

export const metadata: Metadata = {
  title: "Page not found",
  description: "That page does not exist on sere-lang.com.",
  robots: { index: false, follow: true },
};

const SUGGESTIONS = [
  { href: "/docs", label: "Read the docs" },
  { href: "/install", label: "Install Sere" },
  { href: "/libraries", label: "Browse libraries" },
  { href: "/", label: "Go home" },
];

export default function NotFound() {
  return (
    <Container>
      <Section className="flex flex-col items-start gap-5 py-20 md:py-28">
        <Heading className="fade-up text-4xl font-semibold tracking-tight sm:text-5xl">
          Page not found
        </Heading>
        <Text muted className="fade-up fade-up-delay max-w-lg">
          That page does not exist, or it moved. These are the places worth
          starting from.
        </Text>
        <div className="fade-up fade-up-delay flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <Button key={suggestion.href} href={suggestion.href} variant="secondary" size="sm">
              {suggestion.label}
            </Button>
          ))}
        </div>
      </Section>
    </Container>
  );
}
