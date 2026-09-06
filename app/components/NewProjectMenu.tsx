"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getLastOpenedMap } from "@/app/lib/projectActivity";
import {
  listProjects,
  parseProjectKind,
  type CloudProject,
  type ProjectKind,
} from "@/app/lib/projects";
import Button from "./Button";
import Card from "./Card";
import CreateProjectDialog from "./CreateProjectDialog";
import DeleteProjectDialog from "./DeleteProjectDialog";
import Heading from "./Heading";
import ProjectTile from "./ProjectTile";
import Stack from "./Stack";
import Text from "./Text";

type KindFilter = "all" | ProjectKind;

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? "bg-secondary text-foreground"
          : "text-muted hover:bg-secondary hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

export default function NewProjectMenu() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [createKind, setCreateKind] = useState<ProjectKind | null>(null);
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [lastOpened, setLastOpened] = useState<Record<string, number>>({});
  const [deleting, setDeleting] = useState<CloudProject | null>(null);
  const [listError, setListError] = useState("");
  const [loaded, setLoaded] = useState(false);

  async function refreshProjects() {
    try {
      setProjects(await listProjects());
      setLastOpened(getLastOpenedMap());
      setListError("");
    } catch (caught) {
      setListError(caught instanceof Error ? caught.message : "Could not load projects.");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    void refreshProjects();
  }, []);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setCreateKind(parseProjectKind(searchParams.get("kind")));
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...projects]
      .filter((project) => (kindFilter === "all" ? true : project.kind === kindFilter))
      .filter((project) => {
        if (!needle) {
          return true;
        }
        return (
          project.name.toLowerCase().includes(needle) ||
          project.slug.toLowerCase().includes(needle)
        );
      })
      .sort((left, right) => {
        const leftTime = lastOpened[left.slug] ?? Date.parse(left.createdAt);
        const rightTime = lastOpened[right.slug] ?? Date.parse(right.createdAt);
        return rightTime - leftTime;
      });
  }, [kindFilter, lastOpened, projects, query]);

  return (
    <Stack gap="md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="m-0 text-xs uppercase tracking-[0.18em] text-primary">Cloud</p>
          <Heading level={2} className="mt-2">
            Projects
          </Heading>
          <Text muted className="mt-2 text-sm">
            {loaded
              ? `${projects.length} ${projects.length === 1 ? "workspace" : "workspaces"}`
              : "Loading workspaces…"}
          </Text>
        </div>
        <Button onClick={() => setCreateKind("app")}>New project</Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or slug"
          className="w-full px-3 py-2 text-sm sm:max-w-xs"
          aria-label="Search projects"
        />
        <div className="flex items-center gap-1">
          <FilterChip
            label="All"
            active={kindFilter === "all"}
            onClick={() => setKindFilter("all")}
          />
          <FilterChip
            label="Apps"
            active={kindFilter === "app"}
            onClick={() => setKindFilter("app")}
          />
          <FilterChip
            label="Libraries"
            active={kindFilter === "lib"}
            onClick={() => setKindFilter("lib")}
          />
        </div>
      </div>

      {listError ? <p role="alert" className="m-0 text-sm text-danger">{listError}</p> : null}

      {!loaded ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="h-36 rounded-lg border border-border bg-card" />
          <div className="h-36 rounded-lg border border-border bg-card" />
          <div className="h-36 rounded-lg border border-border bg-card" />
        </div>
      ) : null}

      {loaded && projects.length === 0 ? (
        <Card>
          <Stack gap="sm">
            <Heading level={3}>Start a workspace</Heading>
            <Text muted className="text-sm leading-6">
              An app gets a binary entrypoint. A library gets a packable layout.
              Either one opens in the cloud editor.
            </Text>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setCreateKind("app")}>New app</Button>
              <Button variant="ghost" onClick={() => setCreateKind("lib")}>
                New library
              </Button>
            </div>
          </Stack>
        </Card>
      ) : null}

      {loaded && projects.length > 0 && filtered.length === 0 ? (
        <Card>
          <Text muted className="text-sm leading-6">
            No projects match that search.
          </Text>
        </Card>
      ) : null}

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <ProjectTile
              key={project.id}
              project={project}
              lastOpened={
                lastOpened[project.slug]
                  ? new Date(lastOpened[project.slug]).toISOString()
                  : null
              }
              onDelete={setDeleting}
            />
          ))}
        </div>
      ) : null}

      <CreateProjectDialog
        open={createKind !== null}
        initialKind={createKind ?? "app"}
        onClose={() => setCreateKind(null)}
      />
      {deleting ? (
        <DeleteProjectDialog
          project={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            void refreshProjects();
            setDeleting(null);
          }}
        />
      ) : null}
    </Stack>
  );
}
