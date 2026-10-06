import { NextResponse } from "next/server";
import { emitSere, type SereEmitMode } from "../../../lib/sereRunner.server";

/**
 * Emits Sere's intermediate representations (`--emit-serem`, `--emit-llvm`,
 * `--emit-asm`) for the playground's IR viewer, at a chosen optimization level.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_SOURCE_LENGTH = 500_000;
const EMIT_MODES: SereEmitMode[] = ["serem", "llvm", "asm"];
const OPT_LEVELS = ["0", "1", "2", "3"] as const;

export async function POST(request: Request) {
  let source = "";
  let emit: SereEmitMode = "llvm";
  let opt: (typeof OPT_LEVELS)[number] = "0";

  try {
    const body = (await request.json()) as {
      source?: unknown;
      emit?: unknown;
      opt?: unknown;
    };
    if (typeof body?.source === "string") source = body.source;
    if (typeof body?.emit === "string" && (EMIT_MODES as string[]).includes(body.emit)) {
      emit = body.emit as SereEmitMode;
    }
    if (typeof body?.opt === "string" && (OPT_LEVELS as readonly string[]).includes(body.opt)) {
      opt = body.opt as (typeof OPT_LEVELS)[number];
    }
  } catch {
    return NextResponse.json(
      { error: "Expected a JSON body with `source`, `emit`, and `opt`." },
      { status: 400 },
    );
  }

  if (!source.trim()) {
    return NextResponse.json({ ok: false, output: "", stderr: "Paste some Sere code first.", durationMs: 0 });
  }

  if (source.length > MAX_SOURCE_LENGTH) {
    return NextResponse.json({ error: "That snippet is too large to emit." }, { status: 413 });
  }

  try {
    return NextResponse.json(await emitSere(source, emit, opt));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Emit failed unexpectedly.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
