import type { WorkspaceFile } from "./workspace";

export type SearchHit = {
  path: string;
  line: number;
  text: string;
};

export function searchWorkspaceFiles(
  files: WorkspaceFile[],
  query: string,
  limit = 200,
): SearchHit[] {
  const needle = query.trim();
  if (!needle) {
    return [];
  }
  const hits: SearchHit[] = [];
  const lower = needle.toLowerCase();
  for (const file of files) {
    if (!file.content) {
      continue;
    }
    const lines = file.content.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const text = lines[index] ?? "";
      if (!text.toLowerCase().includes(lower)) {
        continue;
      }
      hits.push({ path: file.path, line: index + 1, text: text.trim() });
      if (hits.length >= limit) {
        return hits;
      }
    }
  }
  return hits;
}
