import type { Metadata } from "next";
import { Suspense } from "react";
import NewProjectMenu from "../../components/NewProjectMenu";
import Container from "../../components/Container";
import Section from "../../components/Section";

export const metadata: Metadata = {
  title: "Projects - Sere Cloud",
  description: "Create and open Sere Cloud projects.",
};

export default function CloudProjectsPage() {
  return (
    <Container className="max-w-7xl">
      <Section className="py-8">
        <Suspense>
          <NewProjectMenu />
        </Suspense>
      </Section>
    </Container>
  );
}
