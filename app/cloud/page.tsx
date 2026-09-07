import type { Metadata } from "next";
import CloudOverview from "../components/CloudOverview";
import Container from "../components/Container";
import Section from "../components/Section";

export const metadata: Metadata = {
  title: "Cloud - Sere",
  description:
    "Browser workbench for Sere: Monaco and a Linux VM in this tab, files on your account.",
};

export default function CloudPage() {
  return (
    <Container>
      <Section className="pt-10 pb-20">
        <CloudOverview />
      </Section>
    </Container>
  );
}
