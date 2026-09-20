const paths = ["docs/README.md", "docs/language.md", "docs/reference/macros.md", "docs/projects.md"];
for (const path of paths) {
  const source = await (await fetch("https://raw.githubusercontent.com/Sere-Language/sere/main/" + path)).text();
  console.log("=".repeat(20), path);
  const lines = source.split("\n");
  for (const [index, line] of lines.entries()) {
    if (/img|icon\.png|<div|&lt;/i.test(line)) {
      console.log(index + 1, JSON.stringify(line.slice(0, 220)));
    }
  }
  console.log("first 6 lines:");
  for (const line of lines.slice(0, 6)) console.log("   ", JSON.stringify(line.slice(0, 160)));
}
