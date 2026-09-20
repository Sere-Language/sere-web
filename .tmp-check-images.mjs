const res = await fetch("http://localhost:3000/docs");
const html = await res.text();
console.log("status", res.status, "len", html.length);

const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1]);
console.log("h1 count:", h1s.length);
console.log("h1[0]:", JSON.stringify(h1s[0]?.slice(0, 200)));

const imgMatches = [...html.matchAll(/.{80}img.{160}/g)].map((m) => m[0]);
console.log("img-ish occurrences:", imgMatches.length);
for (const match of imgMatches.slice(0, 8)) console.log("---", JSON.stringify(match));

const escaped = [...html.matchAll(/&lt;\/?[a-z][^&]{0,120}/gi)].map((m) => m[0]);
console.log("escaped tags:", escaped.length);
for (const item of [...new Set(escaped)].slice(0, 12)) console.log("  ", item.slice(0, 140));
