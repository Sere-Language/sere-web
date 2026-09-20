const base = "http://localhost:3000";

async function check(path) {
  const res = await fetch(base + path);
  return { status: res.status, type: res.headers.get("content-type"), body: await res.text() };
}

function heading(body) {
  const match = body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  return match ? match[1].replace(/<[^>]+>/g, "").trim().slice(0, 80) : "(no h1)";
}

const docs = await check("/docs");
console.log("DOCS", docs.status, "| H1:", heading(docs.body));

const options = [...docs.body.matchAll(/<(option|optgroup)\b[^>]*>/g)].map((match) => {
  if (match[1] === "optgroup") return "SECTION " + (/label="([^"]*)"/.exec(match[0])?.[1] ?? "?");
  return "  page " + (/value="([^"]*)"/.exec(match[0])?.[1] ?? "?");
});
console.log("SIDEBAR (" + options.length + "):\n" + options.join("\n"));

for (const path of ["/docs/reference", "/docs/reference/strings", "/docs/reference/readme", "/docs/language", "/docs/architecture", "/docs/installing-packages", "/docs/nope"]) {
  const page = await check(path);
  console.log(path, "->", page.status, "|", heading(page.body));
}

const og = await fetch(base + "/docs/og-image?slug=reference/strings");
console.log("/docs/og-image ->", og.status, og.headers.get("content-type"));

const llms = await check("/llms.txt");
const refLines = llms.body.split("\n").filter((line) => line.includes("/docs/reference/"));
console.log("llms.txt reference entries:", refLines.length);
