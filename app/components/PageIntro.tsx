import Container from "./Container";
import Heading from "./Heading";
import Section from "./Section";
import Stack from "./Stack";
import Text from "./Text";

interface PageIntroProps {
  title: string;
  description: string;
  eyebrow?: string;
  children: React.ReactNode;
}

export default function PageIntro({
  title,
  description,
  eyebrow = "Sere",
  children,
}: PageIntroProps) {
  return (
    <Container>
      <Section className="relative pt-12">
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-4 h-56 w-[28rem] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(194,82,72,0.18),transparent_68%)] blur-2xl"
        />
        <Stack gap="lg">
          <Stack gap="sm">
            <p className="fade-up m-0 text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
              {eyebrow}
            </p>
            <Heading className="fade-up text-4xl sm:text-5xl">
              {title}
            </Heading>
            <Text muted className="fade-up fade-up-delay max-w-2xl">
              {description}
            </Text>
          </Stack>
          {children}
        </Stack>
      </Section>
    </Container>
  );
}
