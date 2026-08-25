import type { Metadata } from "next";
import CloudDashboard from "../../components/CloudDashboard";
import Container from "../../components/Container";
import Section from "../../components/Section";

export const metadata: Metadata = {
  title: "Dashboard — Sere Cloud",
  description: "Cloud workspaces for Sere projects.",
};

export default function CloudDashboardPage() {
  return (
    <Container>
      <Section className="pt-10 pb-16">
        <CloudDashboard />
      </Section>
    </Container>
  );
}
