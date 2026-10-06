import { NextResponse } from "next/server";
import { runSere } from "../../../lib/sereRunner.server";

/**
 * Compiles and runs a Sere snippet.
 *
 * The first request can be slow: `runSere` auto-installs the latest Sere
 * release from GitHub (the portable zip on Windows, the Linux zip elsewhere)
 * when no fresh cached toolchain is present.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_SOURCE_LENGTH = 500_000;

export async function POST(request: Request) {
  let source = "";
  let stdin = "";
  try {
    const body = (await request.json()) as { source?: unknown; stdin?: unknown };
    if (typeof body?.source === "string") source = body.source;
    if (typeof body?.stdin === "string") stdin = body.stdin;
  } catch {
    return NextResponse.json(
      { error: "Expected a JSON body with a `source` string." },
      { status: 400 },
    );
  }

  if (!source.trim()) {
    return NextResponse.json(
      { error: "Paste some Sere code first." },
      { status: 400 },
    );
  }

  if (source.length > MAX_SOURCE_LENGTH) {
    return NextResponse.json(
      { error: "That snippet is too large to run." },
      { status: 413 },
    );
  }

  try {
    return NextResponse.json(await runSere(source, stdin));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The playground failed unexpectedly.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
