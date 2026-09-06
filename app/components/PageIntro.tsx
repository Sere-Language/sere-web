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
    <div className="relative">
      <div className="absolute inset-x-0 top-0 h-[28rem] overflow-hidden -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.04] via-transparent to-transparent" />
        <div className="absolute top-0 left-1/4 w-96 h-1 bg-gradient-to-r from-transparent via-primary/10 to-transparent blur-xl" />
      </div>
      <Container>
      <Section className="py-12 md:py-16">
        <Stack gap="lg">
          <Stack gap="sm">
            <p className="fade-up m-0 text-[11px] font-medium uppercase tracking-[0.22em] text-primary bg-primary/10 px-2.5 py-1 rounded inline-flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-primary/60" />
              {eyebrow}
            </p>
            <Heading className="fade-up text-4xl sm:text-5xl font-semibold tracking-tight">
              {title}
            </Heading>
            <Text muted className="fade-up fade-up-delay max-w-2xl text-base leading-7">
              {description}
            </Text>
          </Stack>
          {children}
        </Stack>
      </Section>
      </Container>
    </div>
  );
}
