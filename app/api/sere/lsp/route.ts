import {
  closeLspSession,
  lspSessionInfo,
  openLspSession,
  sendLspMessage,
  subscribeLsp,
  type LspJson,
} from "@/app/lib/sereLsp.server";
import type { WorkspaceFile } from "@/app/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type LspBody = {
  op?: string;
  projectId?: string;
  files?: WorkspaceFile[];
  message?: LspJson;
};

export async function POST(request: Request): Promise<Response> {
  let body: LspBody;
  try {
    body = (await request.json()) as LspBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.projectId) {
    return Response.json({ error: "projectId is required" }, { status: 400 });
  }

  try {
    if (body.op === "open") {
      const info = await openLspSession(
        body.projectId,
        Array.isArray(body.files) ? body.files : [],
      );
      return Response.json(info);
    }
    if (body.op === "rpc") {
      if (!body.message || typeof body.message !== "object") {
        return Response.json({ error: "message is required" }, { status: 400 });
      }
      sendLspMessage(body.projectId, body.message);
      return Response.json({ ok: true });
    }
    if (body.op === "close") {
      await closeLspSession(body.projectId);
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Unknown op" }, { status: 400 });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Language server failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request): Promise<Response> {
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) {
    return Response.json({ error: "projectId is required" }, { status: 400 });
  }
  if (!lspSessionInfo(projectId)) {
    return Response.json({ error: "Sere language server is not running." }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown): void => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      unsubscribe = subscribeLsp(projectId, (message) => send("rpc", message));
      send("ready", lspSessionInfo(projectId));
      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15000);
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) {
        clearInterval(heartbeat);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
    },
  });
}
