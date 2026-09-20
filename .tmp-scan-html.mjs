const treeResponse = await fetch(
  "https://api.github.com/repos/Sere-Language/sere/git/trees/main?recursive=1",
  { headers: { "User-Agent": "sere-web-scan" } },
);
const tree = await treeResponse.json();
const paths = tree.tree
  .filter((entry) => entry.type === "blob" && entry.path.startsWith("docs/") && entry.path.endsWith(".md"))
  .map((entry) => entry.path);

const tags = new Map();
for (const path of paths) {
  const source = await (await fetch("https://raw.githubusercontent.com/Sere-Language/sere/main/" + path)).text();
  for (const match of source.matchAll(/<[a-zA-Z][^>]*>/g)) {
    const tag = match[0].replace(/\s+/g, " ").slice(0, 160);
    if (!tags.has(tag)) tags.set(tag, new Set());
    tags.get(tag).add(path);
  }
}

console.log("docs files scanned:", paths.length);
console.log("distinct raw html tags:", tags.size);
for (const [tag, files] of tags) {
  console.log("-", tag, "  [", [...files].join(", "), "]");
}
