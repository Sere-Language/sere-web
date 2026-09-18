import type { Metadata } from "next";
import Button from "../components/Button";
import Card from "../components/Card";
import CodeBlock from "../components/CodeBlock";
import SignOutButton from "../components/developers/SignOutButton";
import TokenManager from "../components/developers/TokenManager";
import Grid from "../components/Grid";
import Heading from "../components/Heading";
import PageIntro from "../components/PageIntro";
import Reveal from "../components/Reveal";
import Stack from "../components/Stack";
import Text from "../components/Text";
import { listDeveloperTokens, requireDeveloper } from "../lib/developers.server";
import { SITE_URL, pageMetadata } from "../lib/seo";
import { registryStatus } from "../lib/supabase/server";

export const metadata: Metadata = pageMetadata({
  title: "Developer accounts",
  description:
    "Create a Sere developer account, issue publish tokens, and upload packages to the registry.",
  path: "/developers",
  noIndex: true,
});

// Sessions live in cookies, so this page is rendered per request.
export const dynamic = "force-dynamic";

const PUBLISH_SHAPE = `curl -X POST ${SITE_URL}/api/packages \\
  -H "Authorization: Bearer $SERE_TOKEN" \\
  -F "name=hello-utils" \\
  -F "version=0.1.0" \\
  -F "summary=Small helpers for Sere projects." \\
  -F "manifest=@sere.toml" \\
  -F "readme=@README.md" \\
  -F tarball=@dist/hello-utils-0.1.0.tar.gz`;

export default async function DevelopersPage() {
  const status = registryStatus();
  const session = status.supabase ? await requireDeveloper() : null;

  if (!status.supabase) {
    return (
      <PageIntro
        title="Developer accounts"
        description="Accounts are not open on this deployment yet."
      >
        <Card variant="panel">
          <Stack gap="sm">
            <Heading level={3}>Not open yet</Heading>
            <Text muted className="text-sm leading-6">
              Publishing accounts and the package registry are part of this site,
              and they are not switched on here yet. There is nothing to install
              or configure on your side — check back shortly.
            </Text>
            <Button href="/libraries" variant="secondary" className="mt-1">
              Browse packages
            </Button>
          </Stack>
        </Card>
      </PageIntro>
    );
  }

  if (!session) {
    return (
      <PageIntro
        title="Publish packages"
        description="Create an account to publish to the Sere registry. You get a handle, a dashboard and publish tokens — no third-party accounts to wire up, no keys to copy out of a console."
      >
        <Grid cols={2}>
          <Reveal>
            <Card variant="elevated" className="h-full">
              <Stack gap="sm">
                <Heading level={3}>Create an account</Heading>
                <Text muted className="text-sm leading-6">
                  An email, a password and a handle. Takes a few seconds and gives
                  you somewhere to publish from.
                </Text>
                <Button href="/developers/signup" className="mt-1">
                  Create developer account
                </Button>
              </Stack>
            </Card>
          </Reveal>
          <Reveal delay={80}>
            <Card variant="panel" className="h-full">
              <Stack gap="sm">
                <Heading level={3}>Sign in</Heading>
                <Text muted className="text-sm leading-6">
                  Back to your tokens, publish history and package list.
                </Text>
                <Button href="/developers/login" variant="secondary" className="mt-1">
                  Sign in
                </Button>
              </Stack>
            </Card>
          </Reveal>
        </Grid>

        <Grid cols={3}>
          <Card variant="panel">
            <Stack gap="sm">
              <Heading level={3}>Tokens, not passwords</Heading>
              <Text muted className="text-sm leading-6">
                Issue a token per machine or pipeline. Revoke one without touching
                the others. Tokens are stored hashed and shown once.
              </Text>
            </Stack>
          </Card>
          <Card variant="panel">
            <Stack gap="sm">
              <Heading level={3}>Immutable versions</Heading>
              <Text muted className="text-sm leading-6">
                Publishing the same version twice is rejected, so a version always
                resolves to the same bytes and checksum.
              </Text>
            </Stack>
          </Card>
          <Card variant="panel">
            <Stack gap="sm">
              <Heading level={3}>Audited</Heading>
              <Text muted className="text-sm leading-6">
                Publishes, failed attempts and credential changes are recorded
                against your account.
              </Text>
            </Stack>
          </Card>
        </Grid>
      </PageIntro>
    );
  }

  const { developer } = session;
  const tokens = await listDeveloperTokens(session);
  const active = tokens.filter((token) => !token.revokedAt).length;

  return (
    <PageIntro
      title={developer.handle ? `@${developer.handle}` : "Your account"}
      description={`Signed in as ${developer.email ?? "your account"}. Manage publish tokens below, then push packages with them.`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="chip">
          {active} active {active === 1 ? "token" : "tokens"}
        </span>
        {developer.createdAt ? (
          <span className="chip">
            member since{" "}
            {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
              new Date(developer.createdAt),
            )}
          </span>
        ) : null}
        <SignOutButton />
        <Button href="/libraries" variant="ghost" size="sm">
          Browse packages
        </Button>
      </div>

      {status.publishProblem ? (
        <Card variant="panel">
          <Stack gap="sm">
            <Heading level={3}>Publishing is paused</Heading>
            <Text muted className="text-sm leading-6">
              The registry is not accepting uploads at the moment. You can still
              create a token below — publishes will return <code>503</code> until
              it is back.
            </Text>
          </Stack>
        </Card>
      ) : null}

      <TokenManager initialTokens={tokens} publishUrl={`${SITE_URL}/api/packages`} />

      <Stack gap="lg">
        <Stack gap="sm">
          <Heading level={2}>Publishing</Heading>
          <Text muted className="max-w-2xl text-sm leading-6">
            Pack the library, describe it in <code>sere.toml</code>, then POST the
            archive with a token. The registry validates the name and version,
            stores the payload, records the checksum, and points the package at the
            highest version published so far.
          </Text>
          <Button href="/docs/publishing" variant="secondary" className="mt-1">
            Read the publishing guide
          </Button>
        </Stack>

        <Grid cols={2}>
          <Reveal>
            <CodeBlock filename="sere.toml" wide>
              {`[package]
name = "hello-utils"
version = "0.1.0"
summary = "Small helpers for Sere projects."
license = "MIT"
keywords = ["utilities", "strings"]`}
            </CodeBlock>
          </Reveal>
          <Reveal delay={80}>
            <CodeBlock filename="publish" wide>
              {PUBLISH_SHAPE.replace("///api/packages", "/api/packages")}
            </CodeBlock>
          </Reveal>
        </Grid>

        <Stack gap="sm">
          <Heading level={3}>Rules the API enforces</Heading>
          <Text muted className="text-sm leading-6">
            Names are lowercase letters, digits, dots, dashes or underscores.
            Versions are semantic (<code>MAJOR.MINOR.PATCH</code>). Archives are
            capped at 25&nbsp;MB and READMEs at 64&nbsp;KB. Failed credentials,
            repeated uploads and bursts from one network are rate limited and
            logged.
          </Text>
        </Stack>
      </Stack>
    </PageIntro>
  );
}
