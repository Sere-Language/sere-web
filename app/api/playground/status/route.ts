import { NextResponse } from "next/server";
import { warmLsp } from "../../../lib/sereLsp.server";
import { sereEnvSnapshot, warmSereEnv } from "../../../lib/sereRunner.server";

/**
 * Reports whether the playground's Sere toolchain is installed and ready.
 *
 * When it is not ready, this endpoint kicks off the (long-running) install of
 * the latest release in the background and returns immediately, so the page
 * can keep polling with a loading screen instead of blocking on the download.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = sereEnvSnapshot();

  if (!snapshot.ready && !snapshot.installing) {
    // Fire-and-forget: the client will poll again until `ready` flips true.
    void warmSereEnv();
  } else if (snapshot.ready) {
    // Compiler is ready — start the language server now so the first
    // completion and hover are instant instead of paying spawn + initialize
    // on the first keystroke.
    void warmLsp();
  }

  return NextResponse.json(snapshot);
}
