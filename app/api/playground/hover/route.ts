import { NextResponse } from "next/server";
import { hoverLsp } from "../../../lib/sereLsp.server";

/**
 * Hover information for the playground editor, backed by `sere --lsp`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  if (source.length > MAX_SOURCE_LENGTH) {
    return NextResponse.json({ text: null });
  }

  try {
    const text = await hoverLsp(source, line, character);
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ text: null });
  }
}
