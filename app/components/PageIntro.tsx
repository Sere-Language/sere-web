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
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30rem] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.05] via-transparent to-transparent" />
        <div className="absolute -top-28 left-1/4 h-64 w-[36rem] rounded-full bg-primary/[0.07] blur-[90px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </div>
      <Container>
      <Section className="py-14 md:py-18">
        <Stack gap="lg">
          <Stack gap="sm">
            <p className="eyebrow fade-up w-fit">{eyebrow}</p>
            <Heading className="fade-up text-4xl font-semibold tracking-tight sm:text-5xl">
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
