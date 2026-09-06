"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/app/lib/db";
import Container from "@/app/components/Container";
import Heading from "@/app/components/Heading";
import Section from "@/app/components/Section";

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
        <div className="w-full max-w-lg rounded-lg border border-border bg-card">
          <div className="px-6 py-8">
            <Heading level={2} className="relative">
              Sign in
            </Heading>
            <p role={isError ? "alert" : "status"} className={`mt-3 text-sm ${isError ? "text-danger" : "text-muted"}`}>
              {message}
            </p>
          </div>
        </div>
      </Section>
    </Container>
  );
}
