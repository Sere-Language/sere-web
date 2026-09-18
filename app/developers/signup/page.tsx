import type { Metadata } from "next";
import Card from "../../components/Card";
import Heading from "../../components/Heading";
import PageIntro from "../../components/PageIntro";
import Stack from "../../components/Stack";
import AuthForm from "../../components/developers/AuthForm";
import { pageMetadata } from "../../lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Create a developer account",
  description:
    "Create a Sere developer account to publish packages and issue publish tokens.",
  path: "/developers/signup",
  noIndex: true,
});

export default function DeveloperSignupPage() {
  return (
    <PageIntro
      eyebrow="Developers"
      title="Create an account"
      description="Publish packages to the Sere registry. One account, as many tokens as you need."
    >
      <Card variant="elevated" className="w-full max-w-md">
        <Stack gap="md">
          <Heading level={2} className="text-xl">
            Developer account
          </Heading>
          <AuthForm mode="signup" />
        </Stack>
      </Card>
    </PageIntro>
  );
}
