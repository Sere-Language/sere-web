const { spawn } = require("node:child_process");

const SERE = String.raw`C:\Users\jackw\OneDrive\Desktop\git-projects\sere-web\.sere-host\toolchains\0.2.0-win32\bin\sere.exe`;
const STDLIB = String.raw`C:\Users\jackw\OneDrive\Desktop\git-projects\sere-web\.sere-host\toolchains\0.2.0-win32\stdlib`;

const source = `def fib(n: i32) -> i32:
    return n

def main() -> i32:
    x = "hello"
    x.
    return 0
`;

function runCompletion({ line, character, sereLine, sereCharacter, includeEditorFields }) {
  return new Promise((resolve) => {
    const child = spawn(SERE, ["--lsp"], { stdio: ["pipe", "pipe", "pipe"] });
    let buffer = Buffer.alloc(0);
    let nextId = 1;
    const pending = new Map();

    child.stdout.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      for (;;) {
        const headerEnd = buffer.indexOf("\r\n\r\n");
        if (headerEnd < 0) return;
        const header = buffer.subarray(0, headerEnd).toString("utf8");
        const m = /Content-Length:\s*(\d+)/i.exec(header);
        if (!m) { buffer = buffer.subarray(headerEnd + 4); continue; }
        const len = Number(m[1]);
        const bodyStart = headerEnd + 4;
        if (buffer.length < bodyStart + len) return;
        const body = buffer.subarray(bodyStart, bodyStart + len).toString("utf8");
        buffer = buffer.subarray(bodyStart + len);
        const msg = JSON.parse(body);
        if (msg.id !== undefined && pending.has(msg.id)) {
          pending.get(msg.id)(msg);
          pending.delete(msg.id);
        }
      }
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    function send(payload) {
      const body = JSON.stringify(payload);
      child.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
    }

    function request(method, params) {
      const id = nextId++;
      return new Promise((res) => {
        pending.set(id, res);
        send({ jsonrpc: "2.0", id, method, params });
      });
    }

    (async () => {
      await request("initialize", {
        processId: process.pid,
        rootUri: null,
        initializationOptions: { stdlib: STDLIB, compiler: SERE, version: "0.2.0", llvmDir: "" },
        capabilities: { textDocument: { hover: { contentFormat: ["markdown"] }, completion: { completionItem: { snippetSupport: true } }, publishDiagnostics: { relatedInformation: false } } },
      });
      send({ jsonrpc: "2.0", method: "initialized", params: {} });
      send({ jsonrpc: "2.0", method: "textDocument/didOpen", params: { textDocument: { uri: "file:///t.sere", languageId: "sere", version: 1, text: source } } });

      const params = {
        textDocument: { uri: "file:///t.sere" },
        position: { line, character },
      };
      if (includeEditorFields) {
        params.sereLine = sereLine;
        params.sereCharacter = sereCharacter;
      }

      const result = await request("textDocument/completion", params);
      const items = result.result;
      const labels = (Array.isArray(items) ? items : (items?.items || [])).map((i) => `${i.label}${i.detail ? " — " + i.detail : ""}`);
      console.log(JSON.stringify({ labels }, null, 2));
      if (stderr.trim()) console.log("STDERR:", stderr.trim());
      child.kill();
      resolve();
    })().catch((e) => { console.error("ERR", e); if (stderr.trim()) console.error("STDERR:", stderr.trim()); child.kill(); resolve(); });
  });
}

(async () => {
  console.log("=== member 'x.' WITH editor fields ===");
  await runCompletion({ line: 6, character: 6, sereLine: "    x.", sereCharacter: 6, includeEditorFields: true });
  console.log("=== member 'x.' WITHOUT editor fields ===");
  await runCompletion({ line: 6, character: 6, includeEditorFields: false });
  process.exit(0);
})();
