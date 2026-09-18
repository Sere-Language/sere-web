import type { Metadata } from "next";
import Card from "../../components/Card";
import Heading from "../../components/Heading";
import PageIntro from "../../components/PageIntro";
import Stack from "../../components/Stack";
import AuthForm from "../../components/developers/AuthForm";
import { pageMetadata } from "../../lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Sign in",
  description: "Sign in to your Sere developer account to manage publish tokens.",
  path: "/developers/login",
  noIndex: true,
});

export default function DeveloperLoginPage() {
  return (
    <PageIntro
      title="Sign in"
      description="Sign in to manage your publish tokens and packages."
    >
      <Card variant="elevated" className="w-full max-w-md">
        <Stack gap="md">
          <Heading level={2} className="text-xl">
            Developer account
          </Heading>
          <AuthForm mode="login" />
        </Stack>
      </Card>
    </PageIntro>
  );
}
