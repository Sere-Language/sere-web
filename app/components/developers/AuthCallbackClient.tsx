"use client";

import { useEffect, useState } from "react";
import Button from "../Button";
import Stack from "../Stack";
import Text from "../Text";

interface FragmentSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Reads the session the confirmation email handed back.
 *
 * The provider redirects with the tokens in the URL fragment, which browsers
 * never send to the server — so this page posts them to our own session
 * endpoint, which validates them and sets httpOnly cookies. The fragment is
 * cleared from the address bar immediately so it does not linger in history.
 */
function readFragment(): FragmentSession | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;

  return {
    accessToken,
    refreshToken,
    expiresIn: Number(params.get("expires_in") ?? 3600),
  };
}

type State =
  | { status: "working"; message: string }
  | { status: "done"; message: string }
  | { status: "error"; message: string };

export default function AuthCallbackClient() {
  const [state, setState] = useState<State>({
    status: "working",
    message: "Confirming your account…",
  });

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("error") || query.get("error_description")) {
      setState({
        status: "error",
        message: "That confirmation link could not be used. Request a new one and try again.",
      });
      return;
    }

    const fragment = readFragment();
    if (!fragment) {
      setState({
        status: "error",
        message: "That confirmation link is missing its session. Sign in to continue.",
      });
      return;
    }

    window.history.replaceState(null, "", window.location.pathname);

    void (async () => {
      try {
        const response = await fetch("/api/developers/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(fragment),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          setState({
            status: "error",
            message: payload.error ?? "Could not confirm that link. Sign in instead.",
          });
          return;
        }

        setState({ status: "done", message: "You are confirmed. Opening the dashboard…" });
        window.location.replace("/developers");
      } catch {
        setState({
          status: "error",
          message: "Network error while confirming. Try signing in instead.",
        });
      }
    })();
  }, []);

  return (
    <Stack gap="sm">
      <Text className="m-0">{state.message}</Text>
      {state.status === "error" ? (
        <div className="flex flex-wrap gap-2">
          <Button href="/developers/login" variant="secondary" size="sm">
            Sign in
          </Button>
          <Button href="/developers/signup" variant="ghost" size="sm">
            Create an account
          </Button>
        </div>
      ) : null}
    </Stack>
  );
}
