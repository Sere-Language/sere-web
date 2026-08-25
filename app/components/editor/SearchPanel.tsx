"use client";

import { useMemo, useState } from "react";
import { persistableFiles } from "@/app/lib/sereInit";
import { searchWorkspaceFiles } from "@/app/lib/workbenchSearch";
import { useWorkspace } from "./WorkspaceContext";

export default function SearchPanel() {
  const { files, openFile } = useWorkspace();
  const [query, setQuery] = useState("");
  const hits = useMemo(
    () => searchWorkspaceFiles(persistableFiles(files), query),
    [files, query],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent">
      <div className="border-b border-white/8 px-3 py-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search in files"
          aria-label="Search in files"
          className="w-full rounded-md border border-white/8 bg-white/4 px-2.5 py-1.5 text-[12px] text-foreground outline-none"
        />
      </div>
      <ul className="m-0 min-h-0 flex-1 list-none overflow-auto p-1">
        {query.trim() && hits.length === 0 ? (
          <li className="px-3 py-2 text-[12px] text-muted">No matches</li>
        ) : null}
        {hits.map((hit) => (
          <li key={`${hit.path}:${hit.line}:${hit.text.slice(0, 24)}`}>
            <button
              type="button"
              className="flex w-full flex-col rounded-md px-2.5 py-1.5 text-left hover:bg-white/6"
              onClick={() => openFile(hit.path)}
            >
              <span className="text-[11px] text-muted">
                {hit.path}:{hit.line}
              </span>
              <span className="truncate text-[12px] text-foreground">{hit.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
