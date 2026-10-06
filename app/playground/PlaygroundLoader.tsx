"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Button from "../components/Button";
import Playground from "./Playground";

type StatusPayload = {
  ready: boolean;
  installing: boolean;
  version: string | null;
  source: "local" | "github" | null;
  releaseTag: string | null;
};

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

/**
 * Shows a loading screen until the Sere toolchain is installed and ready,
 * then hands off to the editor. Polls `/api/playground/status`, which warms
 * the compiler in the background on the first request.
 */
export default function PlaygroundLoader() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const mountedRef = useRef(true);

  const poll = useCallback(async () => {
    try {
      const response = await fetch("/api/playground/status", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Status request failed (${response.status}).`);
      }
      const data = (await response.json()) as StatusPayload;
      if (!mountedRef.current) return;
      setError(null);
      if (data.ready) setReady(true);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Could not reach the playground.");
    }
  }, []);

  useEffect(() => {
    if (ready) return;
    mountedRef.current = true;
    void poll();
    const pollTimer = window.setInterval(() => void poll(), 1500);
    const elapsedTimer = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      mountedRef.current = false;
      window.clearInterval(pollTimer);
      window.clearInterval(elapsedTimer);
    };
  }, [poll, ready]);

  if (ready) {
    return <Playground />;
  }

  return (
    <div className="play-loader panel-raised" role="status" aria-live="polite">
      <div className="play-loader-inner">
        <span className="play-loader-ring" aria-hidden />
        <p className="play-loader-title">Preparing the Sere playground</p>
        <p className="play-loader-copy">
          {error
            ? "The latest release could not be reached. Retrying automatically…"
            : "Installing the latest Sere release in the background — the first load can take a minute."}
        </p>
        <div className="play-loader-meta">
          <span className="font-mono">{formatElapsed(elapsed)}</span>
          {error ? (
            <Button variant="ghost" size="sm" onClick={() => void poll()}>
              Retry now
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
