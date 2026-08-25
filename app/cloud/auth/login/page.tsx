"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  loginFieldErrorHint,
  LoginVerificationError,
  mapLoginApiError,
  signInWithEmail,
  verifyLoginFormData,
  type LoginField,
} from "@/app/lib/auth";
import AuthSplit from "@/app/components/AuthSplit";
import Button from "@/app/components/Button";
import Container from "@/app/components/Container";
import Heading from "@/app/components/Heading";
import Section from "@/app/components/Section";
import Stack from "@/app/components/Stack";
import Text from "@/app/components/Text";

const ERROR_INPUT_CLASS =
  "border-danger ring-1 ring-danger/60 focus:border-danger focus:ring-danger/40";

function readField(formData: FormData, name: LoginField): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function Field({
  id,
  name,
  label,
  type,
  placeholder,
  autoComplete,
  error,
}: {
  id: string;
  name: LoginField;
  label: string;
  type: "email" | "password";
  placeholder: string;
  autoComplete: string;
  error?: string;
}) {
  const hint = loginFieldErrorHint(name, error);
  const hintId = `${id}-hint`;

  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
      {label}
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        required
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint ? hintId : undefined}
        className={`w-full px-3 py-2 text-sm ${error ? ERROR_INPUT_CLASS : ""}`}
      />
      {hint ? (
        <span id={hintId} className="text-[11px] font-normal leading-4 text-danger">
          {error}
          {hint !== error ? ` ${hint}` : ""}
        </span>
      ) : null}
    </label>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<LoginField, string>>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const rawFormData = {
      email: readField(formData, "email"),
      password: readField(formData, "password"),
    };

    setLoading(true);
    setMessage("");
    setFieldErrors({});
    setIsError(false);

    const verificationResult = verifyLoginFormData(rawFormData);

    if (!verificationResult.success) {
      setFieldErrors(verificationResult.fieldErrors);
      setMessage(verificationResult.error ?? LoginVerificationError.UNKNOWN_ERROR);
      setIsError(true);
      setLoading(false);
      return;
    }

    try {
      const { error } = await signInWithEmail(rawFormData);

      if (error) {
        const mapped = mapLoginApiError(error);
        setFieldErrors(mapped.field ? { [mapped.field]: mapped.error } : {});
        setMessage(mapped.error);
        setIsError(true);
        setLoading(false);
        return;
      }

      router.push("/cloud/dashboard");
      router.refresh();
    } catch (caught) {
      const fallback =
        caught instanceof Error ? caught.message : LoginVerificationError.UNKNOWN_ERROR;
      setMessage(fallback);
      setIsError(true);
      setLoading(false);
    }
  }

  return (
    <Container>
      <Section className="flex min-h-[calc(100svh-8rem)] items-center py-10">
        <AuthSplit
          title={
            <>
              Welcome back
              <br />
              to Sere Cloud.
            </>
          }
          subtitle="Sign in to open your workspaces. Compile stays in the cloud."
        >
          <form className="w-full" onSubmit={handleSubmit} noValidate>
            <Stack gap="md">
              <Stack gap="sm">
                <Heading level={2}>Sign in</Heading>
                <Text muted className="text-sm">
                  Same email and password you used to sign up.
                </Text>
              </Stack>
              <Stack gap="sm">
                <Field
                  id="login-email"
                  name="email"
                  label="Email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  error={fieldErrors.email}
                />
                <Field
                  id="login-password"
                  name="password"
                  label="Password"
                  type="password"
                  placeholder="Your password"
                  autoComplete="current-password"
                  error={fieldErrors.password}
                />
              </Stack>
              <Button type="submit" disabled={loading} className="w-full justify-center py-2.5">
                {loading ? "Signing in..." : "Sign in"}
              </Button>

              {message ? (
                <Text className={`text-sm ${isError ? "text-danger" : "text-success"}`}>
                  {message}
                </Text>
              ) : null}

              <Text muted className="text-sm">
                No account yet?{" "}
                <Link href="/cloud/auth/signup" className="text-primary hover:text-primary-hover">
                  Sign up
                </Link>
              </Text>
            </Stack>
          </form>
        </AuthSplit>
      </Section>
    </Container>
  );
}
