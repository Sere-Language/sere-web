import { getSupabaseClient } from "./db";

export interface SignUpFormData {
  email: string;
  password: string;
  confirmPassword: string;
}

export type SignUpField = "email" | "password" | "confirmPassword";

export enum SignUpVerificationError {
  PASSWORD_REQUIREMENTS_NOT_MET = "Password requirements not met",
  PASSWORD_MISMATCH = "Passwords do not match",
  EMAIL_INVALID = "Invalid email address",
  EMAIL_ALREADY_IN_USE = "Email already in use",
  PASSWORD_TOO_SHORT = "Password must be at least 8 characters long",
  PASSWORD_TOO_LONG = "Password must be less than 128 characters long",
  UNKNOWN_ERROR = "An unknown error occurred",
  NO_ERROR = "No error occurred",
}

export function formatPasswordTooShortError(minPasswordLength: number): string {
  return `Password must be at least ${minPasswordLength} characters long`;
}

export function formatPasswordTooLongError(maxPasswordLength: number): string {
  return `Password must be less than ${maxPasswordLength} characters long`;
}

export interface SignUpVerificationResult {
  error?: string;
  success: boolean;
  fieldErrors: Partial<Record<SignUpField, string>>;
}

export interface SignUpVerificationRequirements {
  minPasswordLength?: number;
  maxPasswordLength?: number;
  passwordRequirements?: string[];
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asText(value: string | null | undefined): string {
  return typeof value === "string" ? value : "";
}

function containsCharFrom(value: string, charset: string): boolean {
  for (const character of value) {
    if (charset.includes(character)) {
      return true;
    }
  }

  return false;
}

export function verifySignUpFormData(
  formData: SignUpFormData,
  requirements: SignUpVerificationRequirements,
): SignUpVerificationResult {
  const email = asText(formData.email).trim();
  const password = asText(formData.password);
  const confirmPassword = asText(formData.confirmPassword);
  const fieldErrors: Partial<Record<SignUpField, string>> = {};
  const minPasswordLength = requirements.minPasswordLength ?? 8;
  const maxPasswordLength = requirements.maxPasswordLength ?? 128;

  if (!EMAIL_PATTERN.test(email)) {
    fieldErrors.email = SignUpVerificationError.EMAIL_INVALID;
  }

  if (password.length < minPasswordLength) {
    fieldErrors.password = formatPasswordTooShortError(minPasswordLength);
  } else if (password.length > maxPasswordLength) {
    fieldErrors.password = formatPasswordTooLongError(maxPasswordLength);
  } else if (
    requirements.passwordRequirements &&
    requirements.passwordRequirements.length > 0
  ) {
    const meetsRequirements = requirements.passwordRequirements.every((charset) =>
      containsCharFrom(password, charset),
    );

    if (!meetsRequirements) {
      fieldErrors.password = SignUpVerificationError.PASSWORD_REQUIREMENTS_NOT_MET;
    }
  }

  if (password !== confirmPassword) {
    fieldErrors.confirmPassword = SignUpVerificationError.PASSWORD_MISMATCH;
  }

  const firstError = fieldErrors.email ?? fieldErrors.password ?? fieldErrors.confirmPassword;

  return {
    error: firstError,
    success: firstError === undefined,
    fieldErrors,
  };
}

export function fieldErrorHint(field: SignUpField, error: string | undefined): string | undefined {
  if (!error) {
    return undefined;
  }

  if (field === "email") {
    return "Use a valid address, like you@example.com.";
  }

  if (field === "confirmPassword") {
    return "Type the same password again.";
  }

  if (error === SignUpVerificationError.PASSWORD_REQUIREMENTS_NOT_MET) {
    return "Include at least one uppercase letter and one special character.";
  }

  if (
    error === SignUpVerificationError.PASSWORD_TOO_SHORT ||
    error.startsWith("Password must be at least")
  ) {
    return "Make it longer, then try again.";
  }

  if (
    error === SignUpVerificationError.PASSWORD_TOO_LONG ||
    error.startsWith("Password must be less than")
  ) {
    return "Shorten it, then try again.";
  }

  return error;
}

export function mapSignUpApiError(message: string): {
  field?: SignUpField;
  error: string;
} {
  const lower = message.toLowerCase();

  if (lower.includes("already") || lower.includes("registered")) {
    return {
      field: "email",
      error: SignUpVerificationError.EMAIL_ALREADY_IN_USE,
    };
  }

  if (lower.includes("email")) {
    return {
      field: "email",
      error: SignUpVerificationError.EMAIL_INVALID,
    };
  }

  if (lower.includes("password")) {
    return {
      field: "password",
      error: message,
    };
  }

  return { error: message };
}

export type LoginField = "email" | "password";

export interface LoginFormData {
  email: string;
  password: string;
}

export interface LoginVerificationResult {
  error?: string;
  success: boolean;
  fieldErrors: Partial<Record<LoginField, string>>;
}

export enum LoginVerificationError {
  EMAIL_INVALID = "Invalid email address",
  PASSWORD_REQUIRED = "Password is required",
  INVALID_CREDENTIALS = "Invalid email or password",
  UNKNOWN_ERROR = "An unknown error occurred",
}

export function verifyLoginFormData(formData: LoginFormData): LoginVerificationResult {
  const email = asText(formData.email).trim();
  const password = asText(formData.password);
  const fieldErrors: Partial<Record<LoginField, string>> = {};

  if (!EMAIL_PATTERN.test(email)) {
    fieldErrors.email = LoginVerificationError.EMAIL_INVALID;
  }

  if (password.length === 0) {
    fieldErrors.password = LoginVerificationError.PASSWORD_REQUIRED;
  }

  const firstError = fieldErrors.email ?? fieldErrors.password;

  return {
    error: firstError,
    success: firstError === undefined,
    fieldErrors,
  };
}

export function loginFieldErrorHint(
  field: LoginField,
  error: string | undefined,
): string | undefined {
  if (!error) {
    return undefined;
  }

  if (field === "email") {
    return "Use a valid address, like you@example.com.";
  }

  if (error === LoginVerificationError.PASSWORD_REQUIRED) {
    return "Enter the password for this account.";
  }

  return "Check the password and try again.";
}

export function mapLoginApiError(error: { message: string; code?: string }): {
  field?: LoginField;
  error: string;
} {
  const code = (error.code ?? "").toLowerCase();
  const lower = error.message.toLowerCase();

  if (
    code === "invalid_credentials" ||
    code === "email_not_confirmed" ||
    lower.includes("invalid login") ||
    lower.includes("invalid credentials") ||
    lower.includes("email not confirmed")
  ) {
    return {
      field: "password",
      error: LoginVerificationError.INVALID_CREDENTIALS,
    };
  }

  return { error: error.message };
}

export async function signInWithEmail(formData: { email: string; password: string }) {
  const supabaseClient = getSupabaseClient();
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: formData.email.trim(),
    password: formData.password,
  });

  return {
    error,
    success: !error,
  };
}

export async function signUpWithEmail(formData: { email: string; password: string }) {
  const supabaseClient = getSupabaseClient();
  const email = formData.email.trim();
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password: formData.password,
  });

  if (error) {
    return {
      error,
      success: false,
    };
  }

  if (data.user?.identities?.length === 0) {
    return {
      error: {
        message: SignUpVerificationError.EMAIL_ALREADY_IN_USE,
        code: "user_already_exists",
      },
      success: false,
    };
  }

  if (!data.session) {
    return signInWithEmail({ email, password: formData.password });
  }

  return {
    error: null,
    success: true,
  };
}

export async function signOut() {
  const supabaseClient = getSupabaseClient();
  const { error } = await supabaseClient.auth.signOut();

  return {
    error,
    success: !error,
  };
}
