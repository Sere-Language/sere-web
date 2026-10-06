import { NextResponse } from "next/server";
import { completeLsp } from "../../../lib/sereLsp.server";

/**
 * Autocomplete for the playground editor, backed by `sere --lsp`.
 *
 * The first request is slow: it auto-installs the latest Sere release (the
 * same cached toolchain the runner uses) before the language server starts.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_SOURCE_LENGTH = 500_000;

export async function POST(request: Request) {
  let source = "";
  let line = 0;
  let character = 0;

  try {
    const body = (await request.json()) as {
      source?: unknown;
      line?: unknown;
      character?: unknown;
    };
    if (typeof body?.source === "string") source = body.source;
    if (typeof body?.line === "number") line = body.line;
    if (typeof body?.character === "number") character = body.character;
  } catch {
    return NextResponse.json(
      { error: "Expected a JSON body with `source`, `line`, and `character`." },
      { status: 400 },
    );
  }

  if (!source.trim()) {
    return NextResponse.json({ items: [] });
  }

  if (source.length > MAX_SOURCE_LENGTH) {
    return NextResponse.json({ items: [], error: "That snippet is too large." }, { status: 413 });
  }

  try {
    const items = await completeLsp(source, line, character);
    return NextResponse.json({ items });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Completion failed unexpectedly.";
    return NextResponse.json({ items: [], error: message }, { status: 500 });
  }
}
