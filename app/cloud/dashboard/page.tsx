import type { Metadata } from "next";
import CloudDashboard from "../../components/CloudDashboard";
import Container from "../../components/Container";
import Section from "../../components/Section";
import { pageMetadata } from "../../lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Dashboard",
  description: "Cloud workspaces for Sere projects.",
  path: "/cloud/dashboard",
  noIndex: true,
});

export default function CloudDashboardPage() {
  return (
    <Container className="max-w-7xl">
      <Section className="py-8">
        <CloudDashboard />
      </Section>
    </Container>
  );
}
