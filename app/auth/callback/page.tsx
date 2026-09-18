import type { Metadata } from "next";
import Container from "../../components/Container";
import AuthCallbackClient from "../../components/developers/AuthCallbackClient";
import Heading from "../../components/Heading";
import Section from "../../components/Section";
import Stack from "../../components/Stack";

export const metadata: Metadata = {
  title: "Confirming your account",
  description: "Finishing a Sere developer account confirmation.",
  robots: { index: false, follow: false },
};

export default function AuthCallbackPage() {
  return (
    <Container>
      <Section className="py-14 md:py-18">
        <Stack gap="sm" className="max-w-lg">
          <p className="eyebrow w-fit">Developers</p>
          <Heading className="text-3xl font-semibold tracking-tight">
            Confirming your account
          </Heading>
          <AuthCallbackClient />
        </Stack>
      </Section>
    </Container>
  );
}
