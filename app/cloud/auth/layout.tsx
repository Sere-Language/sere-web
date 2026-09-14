import type { Metadata } from "next";
import { pageMetadata } from "../../lib/seo";

// Login, signup, and callback are client components, so the auth section's
// metadata is declared once here.
export const metadata: Metadata = pageMetadata({
  title: "Sign in",
  description: "Sign in to your Sere Cloud account.",
  path: "/cloud/auth/login",
  noIndex: true,
});

export default function CloudAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
