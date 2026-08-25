import {
  bootCompilerHost,
  emitArtifact,
  execInWorkspace,
} from "@/app/lib/sereHost.server";
import type { WorkspaceFile } from "@/app/lib/workspace";

export const runtime = "nodejs";
export const maxDuration = 120;

type HostBody = {
  op?: string;
  projectId?: string;
  command?: string;
  files?: WorkspaceFile[];
  mode?: "llvm" | "asm";
  source?: string;
};

export async function POST(request: Request): Promise<Response> {
  let body: HostBody;
  try {
    body = (await request.json()) as HostBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (body.op === "boot") {
      const result = await bootCompilerHost();
      return Response.json(result);
    }

    if (!body.projectId) {
      return Response.json({ error: "projectId is required" }, { status: 400 });
    }

    const files = Array.isArray(body.files) ? body.files : [];

    if (body.op === "exec") {
      const result = await execInWorkspace({
        projectId: body.projectId,
        command: body.command ?? "",
        files,
      });
      return Response.json(result);
    }

    if (body.op === "emit") {
      const mode = body.mode === "asm" ? "asm" : "llvm";
      const result = await emitArtifact({
        projectId: body.projectId,
        files,
        mode,
        source: body.source ?? "src/main.sere",
      });
      return Response.json(result);
    }

    return Response.json({ error: "Unknown op" }, { status: 400 });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Compiler host failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
