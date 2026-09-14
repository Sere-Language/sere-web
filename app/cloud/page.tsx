import type { Metadata } from "next";
import CloudOverview from "../components/CloudOverview";
import Container from "../components/Container";
import Section from "../components/Section";
import { pageMetadata } from "../lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Cloud",
  description:
    "The Sere Cloud workbench: Monaco, a language server, and a Linux VM in your browser, with projects saved to your account.",
  path: "/cloud",
  noIndex: true,
});

export default function CloudPage() {
  return (
    <Container>
      <Section className="pt-10 pb-20">
        <CloudOverview />
      </Section>
    </Container>
  );
}
