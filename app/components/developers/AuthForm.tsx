"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "../Button";
import Stack from "../Stack";
import Text from "../Text";

interface AuthFormProps {
  mode: "login" | "signup";
}

const FIELD_CLASS = "w-full";

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  const signup = mode === "signup";

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/developers/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          signup ? { email, password, handle } : { email, password },
        ),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        needsConfirmation?: boolean;
        email?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? "Something went wrong. Try again.");
        return;
      }

      if (payload.needsConfirmation) {
        setNotice(
          `Account created. Open the confirmation link we sent to ${
            payload.email ?? "your inbox"
          }, then sign in.`,
        );
        return;
      }

      router.push("/developers");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (resending) return;

    setError(null);
    setNotice(null);

    if (!email.trim()) {
      setError("Enter your email address first, then resend.");
      return;
    }

    setResending(true);
    try {
      const response = await fetch("/api/developers/resend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? "Could not send that email.");
        return;
      }

      setNotice(
        payload.message ??
          "If that address still needs confirming, a new link is on its way.",
      );
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="sm">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-xs tracking-[0.14em] text-muted uppercase">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={FIELD_CLASS}
          />
        </div>

        {signup ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="handle" className="text-xs tracking-[0.14em] text-muted uppercase">
              Handle
            </label>
            <input
              id="handle"
              name="handle"
              type="text"
              autoComplete="username"
              required
              spellCheck={false}
              placeholder="ada-lovelace"
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              className={FIELD_CLASS}
            />
            <p className="m-0 text-xs text-muted">
              Shown on your packages. Lowercase letters, digits and dashes.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-xs tracking-[0.14em] text-muted uppercase">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            required
            minLength={signup ? 10 : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={FIELD_CLASS}
          />
          {signup ? (
            <p className="m-0 text-xs text-muted">At least 10 characters.</p>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="m-0 text-sm text-red-400">
            {error}
          </p>
        ) : null}

        {notice ? (
          <p role="status" className="m-0 text-sm text-emerald-400">
            {notice}
          </p>
        ) : null}

        <Button type="submit" disabled={busy} className="mt-1 w-full" size="md">
          {busy ? "Working…" : signup ? "Create developer account" : "Sign in"}
        </Button>

        <button
          type="button"
          onClick={resend}
          disabled={resending}
          className="w-full rounded-md border border-border px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-60"
        >
          {resending ? "Sending…" : "Didn't get the confirmation email? Resend it"}
        </button>

        <Text muted className="m-0 text-sm">
          {signup ? (
            <>
              Already have an account?{" "}
              <Link href="/developers/login" className="text-primary">
                Sign in
              </Link>
            </>
          ) : (
            <>
              No account yet?{" "}
              <Link href="/developers/signup" className="text-primary">
                Create one
              </Link>
            </>
          )}
        </Text>
      </Stack>
    </form>
  );
}
