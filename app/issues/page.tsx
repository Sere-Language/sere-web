import type { Metadata } from "next";
import Button from "../components/Button";
import Card from "../components/Card";
import Container from "../components/Container";
import Grid from "../components/Grid";
import Heading from "../components/Heading";
import PageIntro from "../components/PageIntro";
import Reveal from "../components/Reveal";
import Section from "../components/Section";
import Stack from "../components/Stack";
import Text from "../components/Text";

export const metadata: Metadata = {
  title: "Issues - Sere",
  description: "View and track issues from the Sere GitHub repository.",
};

const GITHUB_ISSUES_API = "https://api.github.com/repos/Sere-Language/sere/issues?state=all&per_page=30";

interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  labels: Array<{ name: string; color: string }>;
  html_url: string;
  created_at: string;
  user: { login: string };
  pull_request?: object;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getLabelColor(label: string): string {
  const colors: Record<string, string> = {
    bug: "#ef4444",
    feature: "#3b82f6",
    enhancement: "#8b5cf6",
    docs: "#22c55e",
    "good first issue": "#10b981",
    question: "#f59e0b",
    wip: "#6b7280",
  };
  return colors[label.toLowerCase()] ?? "#6b7280";
}

async function fetchIssues(): Promise<GitHubIssue[]> {
  try {
    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "sere-web",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(GITHUB_ISSUES_API, {
      headers,
      next: { revalidate: 300 },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.filter((issue: GitHubIssue) => !issue.pull_request) as GitHubIssue[];
  } catch {
    return [];
  }
}

function IssueCard({
  issue,
  index,
}: {
  issue: GitHubIssue;
  index: number;
}) {
  const isOpen = issue.state === "open";
  const labels = issue.labels.slice(0, 3);

  return (
    <Reveal key={issue.number} delay={index * 50}>
      <Card variant="panel" hover className="h-full">
        <Stack gap="sm">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-mono px-2 py-0.5 rounded"
              style={{
                backgroundColor: isOpen ? "rgba(34, 197, 94, 0.15)" : "rgba(107, 114, 128, 0.15)",
                color: isOpen ? "#22c55e" : "#6b7280",
              }}
            >
              #{issue.number}
            </span>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded"
              style={{
                backgroundColor: "rgba(107, 114, 128, 0.15)",
                color: "#9ca3af",
              }}
            >
              {formatDate(issue.created_at)}
            </span>
          </div>

          <Heading level={3} className="!text-base !leading-snug">
            <a
              href={issue.html_url}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:text-primary-hover transition-colors no-underline"
            >
              {issue.title}
            </a>
          </Heading>

          {labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {labels.map((label) => (
                <span
                  key={label.name}
                  className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${getLabelColor(label.name)}20`,
                    color: getLabelColor(label.name),
                    border: `1px solid ${getLabelColor(label.name)}40`,
                  }}
                >
                  {label.name}
                </span>
              ))}
            </div>
          )}

          <Text muted className="text-xs leading-5">
            Opened by{" "}
            <a
              href={`https://github.com/${issue.user.login}`}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:text-accent-muted transition-colors"
            >
              {issue.user.login}
            </a>
          </Text>
        </Stack>
      </Card>
    </Reveal>
  );
}

export default async function IssuesPage() {
  const issues = await fetchIssues();
  const openIssues = issues.filter((i) => i.state === "open");
  const closedIssues = issues.filter((i) => i.state === "closed");

  return (
    <PageIntro
      eyebrow="GitHub"
      title="Issues"
      description="Track bugs, feature requests, and language discussions from the Sere repository. Filter by status or search by label."
    >
      <Section className="py-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Stack gap="xs">
            <Heading level={2} className="text-xl">
              {openIssues.length} open
            </Heading>
            <Text muted className="text-sm">
              {openIssues.length === 1
                ? "1 open issue"
                : `${openIssues.length} open issues`}
            </Text>
          </Stack>
          <Button
            href="https://github.com/Sere-Language/sere/issues"
            variant="secondary"
            size="sm"
          >
            View all on GitHub
          </Button>
        </div>
      </Section>

      {openIssues.length > 0 ? (
        <Grid cols={2}>
          {openIssues.slice(0, 12).map((issue, index) => (
            <IssueCard key={issue.number} issue={issue} index={index} />
          ))}
        </Grid>
      ) : (
        <Card variant="elevated" className="py-12 text-center">
          <Stack gap="md">
            <Heading level={3}>No open issues</Heading>
            <Text muted>
              Everything is resolved for now. Check back later or browse the
              closed issues on GitHub.
            </Text>
            <Button href="https://github.com/Sere-Language/sere/issues" variant="ghost">
              Browse GitHub issues
            </Button>
          </Stack>
        </Card>
      )}

      {closedIssues.length > 0 && (
        <Section className="py-12 mt-8">
          <Stack gap="lg">
            <Reveal>
              <Heading level={2} className="text-xl">
                Recently closed
              </Heading>
            </Reveal>
            <Grid cols={2}>
              {closedIssues.slice(0, 8).map((issue, index) => (
                <IssueCard
                  key={issue.number}
                  issue={issue}
                  index={index + 12}
                />
              ))}
            </Grid>
          </Stack>
        </Section>
      )}
    </PageIntro>
  );
}
