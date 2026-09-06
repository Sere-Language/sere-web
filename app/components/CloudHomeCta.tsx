"use client";

import { useAuthSession } from "@/app/hooks/useAuthSession";
import Button from "./Button";
import Stack from "./Stack";
import Text from "./Text";

export default function CloudHomeCta() {
  const { signedIn, ready } = useAuthSession();

  if (!ready) {
    return <div className="h-[4.75rem]" aria-hidden />;
  }

  if (signedIn) {
    return (
      <Stack gap="sm">
        <Text muted className="max-w-2xl text-sm leading-6">
          You are signed in. Open the dashboard to create or continue a project.
        </Text>
        <div className="flex flex-wrap items-center gap-3">
          <Button href="/cloud/dashboard">Go to dashboard</Button>
          <Button href="/cloud/projects" variant="ghost">
            Projects
          </Button>
        </div>
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      <Text muted className="max-w-2xl text-sm leading-6">
        Create an account to save and run your projects in the browser.
      </Text>
      <div className="flex flex-wrap items-center gap-3">
        <Button href="/cloud/auth/signup">Sign up</Button>
        <Button href="/cloud/auth/login" variant="ghost">
          Sign in
        </Button>
        <Button href="/install" variant="ghost">
          Local install
        </Button>
      </div>
    </Stack>
  );
}
