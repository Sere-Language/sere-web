import type { Metadata } from "next";
import { pageMetadata } from "../lib/seo";

// The page itself is a client component, so metadata lives here.
export const metadata: Metadata = pageMetadata({
  title: "Design review",
  description: "Internal component and layout preview for the Sere site.",
  path: "/design-review",
  noIndex: true,
});

export default function DesignReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
