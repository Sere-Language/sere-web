"use client";

import { useState } from "react";
import Button from "../Button";
import Heading from "../Heading";
import Stack from "../Stack";
import Text from "../Text";

export interface TokenRecord {
  id: string;
  label: string;
  prefix: string;
  scope: string;
  createdAt: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

interface TokenManagerProps {
  initialTokens: TokenRecord[];
  /** Absolute URL of the publish endpoint, for the copy-paste example. */
  publishUrl: string;
}

const EXPIRY_OPTIONS = [
  { value: "", label: "No expiry" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
] as const;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(time));
}

function isExpired(iso: string | null): boolean {
  if (!iso) return false;
  const time = Date.parse(iso);
  return Number.isFinite(time) && time <= Date.now();
}

export default function TokenManager({ initialTokens, publishUrl }: TokenManagerProps) {
  const [tokens, setTokens] = useState<TokenRecord[]>(initialTokens);
  const [label, setLabel] = useState("publish");
  const [expiryDays, setExpiryDays] = useState("");
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"token" | "curl" | null>(null);

  const copy = async (value: string, which: "token" | "curl") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      // Clipboard access can be denied; the value stays selectable.
    }
  };

  const createToken = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/developers/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label,
          expiresInDays: expiryDays ? Number(expiryDays) : null,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        token?: string;
        record?: TokenRecord;
      };

      if (!response.ok || !payload.token || !payload.record) {
        setError(payload.error ?? "Could not create that token.");
        return;
      }

      setFreshToken(payload.token);
      setTokens((current) => [payload.record as TokenRecord, ...current]);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const revokeToken = async (id: string) => {
    setError(null);

    try {
      const response = await fetch(`/api/developers/tokens/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? "Could not revoke that token.");
        return;
      }

      const revokedAt = new Date().toISOString();
      setTokens((current) =>
        current.map((token) => (token.id === id ? { ...token, revokedAt } : token)),
      );
    } catch {
      setError("Network error. Try again.");
    }
  };

  const curlExample = freshToken
    ? `curl -X POST ${publishUrl} \\
  -H "Authorization: Bearer ${freshToken}" \\
  -F "name=hello-utils" \\
  -F "version=0.1.0" \\
  -F tarball=@dist/hello-utils-0.1.0.tar.gz`
    : "";

  return (
    <Stack gap="lg">
      <Stack gap="sm">
        <Heading level={2}>Publish tokens</Heading>
        <Text muted className="max-w-2xl text-sm leading-6">
          A token is a password for your tooling. It is shown once, stored only as
          a hash, and can be revoked at any time. Send it as{" "}
          <code>Authorization: Bearer &lt;token&gt;</code> when you publish.
        </Text>
      </Stack>

      <div className="panel flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
            <label htmlFor="token-label" className="text-xs tracking-[0.14em] text-muted uppercase">
              Label
            </label>
            <input
              id="token-label"
              value={label}
              maxLength={60}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="ci-release"
              spellCheck={false}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="token-expiry" className="text-xs tracking-[0.14em] text-muted uppercase">
              Expires
            </label>
            <select
              id="token-expiry"
              value={expiryDays}
              onChange={(event) => setExpiryDays(event.target.value)}
            >
              {EXPIRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <Button onClick={createToken} disabled={busy}>
            {busy ? "Creating…" : "Create token"}
          </Button>
        </div>

        {error ? (
          <p role="alert" className="m-0 text-sm text-red-400">
            {error}
          </p>
        ) : null}

        {freshToken ? (
          <div className="well flex flex-col gap-3 p-4">
            <p className="m-0 text-xs tracking-[0.14em] text-primary uppercase">
              Copy this now — it will not be shown again
            </p>
            <div className="flex items-center gap-3">
              <code className="min-w-0 flex-1 truncate font-mono text-[13px] select-all">
                {freshToken}
              </code>
              <button
                type="button"
                onClick={() => copy(freshToken, "token")}
                className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium tracking-[0.12em] text-muted uppercase transition-colors hover:border-border-strong hover:text-foreground"
              >
                {copied === "token" ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="flex items-start gap-3">
              <pre className="m-0 min-w-0 flex-1 overflow-x-auto text-xs leading-6">
                <code>{curlExample}</code>
              </pre>
              <button
                type="button"
                onClick={() => copy(curlExample, "curl")}
                className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium tracking-[0.12em] text-muted uppercase transition-colors hover:border-border-strong hover:text-foreground"
              >
                {copied === "curl" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <Stack gap="sm">
        <Heading level={3}>Your tokens</Heading>
        {tokens.length === 0 ? (
          <Text muted className="text-sm">
            No tokens yet. Create one to publish your first package.
          </Text>
        ) : (
          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] tracking-[0.14em] text-muted uppercase">
                    <th className="px-4 py-3 font-medium">Token</th>
                    <th className="px-4 py-3 font-medium">Label</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium">Last used</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token) => {
                    const revoked = Boolean(token.revokedAt);
                    const expired = isExpired(token.expiresAt);
                    const status = revoked ? "Revoked" : expired ? "Expired" : "Active";

                    return (
                      <tr key={token.id} className="border-b border-border-muted last:border-b-0">
                        <td className="px-4 py-3 font-mono text-[12px] whitespace-nowrap text-foreground">
                          {token.prefix}…
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{token.label}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted">
                          {formatDate(token.createdAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted">
                          {token.lastUsedAt ? formatDate(token.lastUsedAt) : "never"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`chip ${revoked || expired ? "" : "text-emerald-300"}`}
                          >
                            {status}
                          </span>
                          {token.expiresAt && !revoked ? (
                            <span className="ml-2 text-xs text-muted">
                              {formatDate(token.expiresAt)}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {revoked ? null : (
                            <button
                              type="button"
                              onClick={() => revokeToken(token.id)}
                              className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium tracking-[0.12em] text-muted uppercase transition-colors hover:border-red-500/60 hover:text-red-300"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Stack>
    </Stack>
  );
}
