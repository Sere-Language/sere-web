"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  fieldErrorHint,
  mapSignUpApiError,
  SignUpVerificationError,
  signUpWithEmail,
  verifySignUpFormData,
  type SignUpField,
} from "@/app/lib/auth";
import { constants } from "@/app/lib/constants";
import AuthSplit from "@/app/components/AuthSplit";
import Button from "@/app/components/Button";
import Container from "@/app/components/Container";
import Heading from "@/app/components/Heading";
import Section from "@/app/components/Section";
import Stack from "@/app/components/Stack";
import Text from "@/app/components/Text";

const ERROR_INPUT_CLASS =
  "border-danger ring-1 ring-danger/60 focus:border-danger focus:ring-danger/40";

function readField(formData: FormData, name: SignUpField): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function Field({
  id,
  name,
  label,
  type,
  placeholder,
  error,
}: {
  id: string;
  name: SignUpField;
  label: string;
  type: "email" | "password";
  placeholder: string;
  error?: string;
}) {
  const hint = fieldErrorHint(name, error);
  const hintId = `${id}-hint`;

  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
      {label}
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        required
        autoComplete={
          name === "email" ? "email" : name === "password" ? "new-password" : "new-password"
        }
        aria-invalid={error ? true : undefined}
        aria-describedby={hint ? hintId : undefined}
        className={`w-full px-3 py-2 text-sm ${error ? ERROR_INPUT_CLASS : ""}`}
      />
      {hint ? (
        <span id={hintId} className="text-xs font-normal leading-5 text-danger">
          {error}
          {hint !== error ? ` ${hint}` : ""}
        </span>
      ) : null}
    </label>
  );
}

export default function SignUpPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<SignUpField, string>>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const rawFormData = {
      email: readField(formData, "email"),
      password: readField(formData, "password"),
      confirmPassword: readField(formData, "confirmPassword"),
    };

    setLoading(true);
    setMessage("");
    setFieldErrors({});
    setIsError(false);

    const verificationResult = verifySignUpFormData(rawFormData, {
      minPasswordLength: constants.auth.minPasswordLength,
      maxPasswordLength: constants.auth.maxPasswordLength,
      passwordRequirements: constants.auth.passwordRequirements,
    });

    if (!verificationResult.success) {
      const displayMessage =
        verificationResult.error === SignUpVerificationError.PASSWORD_REQUIREMENTS_NOT_MET
          ? "Password must include at least one special character along with one uppercase letter."
          : (verificationResult.error ?? "An unknown error occurred");

      setFieldErrors(verificationResult.fieldErrors);
      setMessage(displayMessage);
      setIsError(true);
      setLoading(false);
      return;
    }

    try {
      const { error } = await signUpWithEmail({
        email: rawFormData.email,
        password: rawFormData.password,
      });

      if (error) {
        const mapped = mapSignUpApiError(error.message);
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
        caught instanceof Error ? caught.message : SignUpVerificationError.UNKNOWN_ERROR;
      setMessage(fallback);
      setIsError(true);
    }

    setLoading(false);
  }

  return (
    <Container>
      <Section className="flex min-h-[calc(100svh-8rem)] items-center py-10">
        <AuthSplit
          title={
            <>
              Write Sere
              <br />
              in the cloud.
            </>
          }
          subtitle="One account. Browser editor, remote compile, workspaces that follow you."
        >
          <form className="w-full" onSubmit={handleSubmit} noValidate>
            <Stack gap="md">
              <Stack gap="sm">
                <Heading level={2}>Sign up</Heading>
                <Text muted className="text-sm">
                  Email and a password. That is the whole start.
                </Text>
              </Stack>
              <Stack gap="sm">
                <Field
                  id="signup-email"
                  name="email"
                  label="Email"
                  type="email"
                  placeholder="you@example.com"
                  error={fieldErrors.email}
                />
                <Field
                  id="signup-password"
                  name="password"
                  label="Password"
                  type="password"
                  placeholder="At least 8 characters"
                  error={fieldErrors.password}
                />
                <Field
                  id="signup-confirm-password"
                  name="confirmPassword"
                  label="Confirm password"
                  type="password"
                  placeholder="Repeat password"
                  error={fieldErrors.confirmPassword}
                />
              </Stack>
              <Button type="submit" disabled={loading} className="w-full justify-center py-2.5">
                {loading ? "Creating account..." : "Create Account"}
              </Button>

              {message ? (
                <p role={isError ? "alert" : "status"} className={`m-0 text-sm ${isError ? "text-danger" : "text-success"}`}>
                  {message}
                </p>
              ) : null}

              <Text muted className="text-sm">
                Already have an account?{" "}
                <Link href="/cloud/auth/login" className="text-primary hover:text-primary-hover">
                  Sign in
                </Link>
              </Text>
            </Stack>
          </form>
        </AuthSplit>
      </Section>
    </Container>
  );
}
