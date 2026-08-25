"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/app/lib/db";
import Container from "@/app/components/Container";
import Heading from "@/app/components/Heading";
import Section from "@/app/components/Section";
import Text from "@/app/components/Text";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Signing you in…");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const supabaseClient = getSupabaseClient();
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          const { error } = await supabaseClient.auth.exchangeCodeForSession(code);
          if (error) {
            throw error;
          }
        }

        if (cancelled) {
          return;
        }

        router.replace("/cloud/dashboard");
        router.refresh();
      } catch (caught) {
        if (cancelled) {
          return;
        }

        setIsError(true);
        setMessage(caught instanceof Error ? caught.message : "Could not finish sign in.");
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <Container>
      <Section className="flex min-h-[calc(100svh-8rem)] items-center py-10">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-card/50 shadow-[0_40px_120px_-36px_rgba(194,82,72,0.45)]">
          <div className="relative min-h-[16rem] px-8 py-10">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(194,82,72,0.22),transparent_55%)]"
            />
            <Heading level={2} className="relative">
              Sign in
            </Heading>
            <Text className={`relative mt-3 text-sm ${isError ? "text-danger" : "text-muted"}`}>
              {message}
            </Text>
          </div>
        </div>
      </Section>
    </Container>
  );
}
