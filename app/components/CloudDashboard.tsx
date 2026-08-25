"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthSession } from "@/app/hooks/useAuthSession";
import { getLastOpenedMap } from "@/app/lib/projectActivity";
import {
  countProjectsByKind,
  formatRelativeTime,
  listProjects,
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

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return "Good morning";
  }
  if (hour < 18) {
    return "Good afternoon";
  }
  return "Good evening";
}

function displayName(email: string | null): string {
  if (!email) {
    return "there";
  }
  return email.split("@")[0] ?? email;
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-card/80 px-4 py-4 backdrop-blur-sm">
      <p className="m-0 text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p className="m-0 mt-2 truncate text-2xl font-semibold tracking-tight" title={value}>
        {value}
      </p>
      <p className="m-0 mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

function sortByActivity(
  projects: CloudProject[],
  lastOpened: Record<string, number>,
): CloudProject[] {
  return [...projects].sort((left, right) => {
    const leftTime = lastOpened[left.slug] ?? Date.parse(left.createdAt);
    const rightTime = lastOpened[right.slug] ?? Date.parse(right.createdAt);
    return rightTime - leftTime;
  });
}

export default function CloudDashboard() {
  const { email } = useAuthSession();
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [lastOpened, setLastOpened] = useState<Record<string, number>>({});
  const [deleting, setDeleting] = useState<CloudProject | null>(null);
  const [createKind, setCreateKind] = useState<ProjectKind | null>(null);
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

  const counts = countProjectsByKind(projects);
  const recent = useMemo(
    () => sortByActivity(projects, lastOpened).slice(0, 6),
    [lastOpened, projects],
  );
  const newest = projects[0];

  return (
    <Stack gap="lg">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="m-0 text-xs uppercase tracking-[0.18em] text-primary">Workspace</p>
          <Heading level={2} className="mt-2">
            {greeting()}, {displayName(email)}
          </Heading>
          <Text muted className="mt-2 max-w-xl text-sm leading-6">
            {email
              ? `Signed in as ${email}. Pick up a project or start a new one.`
              : "Create an app or a library, then open it in the workspace."}
          </Text>
        </div>
        <Button onClick={() => setCreateKind("app")}>New project</Button>
      </div>

      {listError ? <Text className="text-sm text-danger">{listError}</Text> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Projects"
          value={loaded ? String(counts.total) : "—"}
          hint={counts.total === 1 ? "One workspace" : "Saved in your account"}
        />
        <Stat
          label="Apps"
          value={loaded ? String(counts.apps) : "—"}
          hint="Binaries · sere run"
        />
        <Stat
          label="Libraries"
          value={loaded ? String(counts.libraries) : "—"}
          hint="Packable · sere pack"
        />
        <Stat
          label="Latest"
          value={loaded && newest ? newest.name : "—"}
          hint={
            newest
              ? `Created ${formatRelativeTime(newest.createdAt)}`
              : "Nothing created yet"
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
        <Stack gap="md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Heading level={3}>Continue</Heading>
            <Button href="/cloud/projects" variant="ghost">
              All projects
            </Button>
          </div>
          {!loaded ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="h-36 rounded-lg border border-border bg-card/50" />
              <div className="h-36 rounded-lg border border-border bg-card/50" />
            </div>
          ) : recent.length === 0 ? (
            <Card>
              <Stack gap="sm">
                <Heading level={3}>No projects yet</Heading>
                <Text muted className="text-sm leading-6">
                  Create an app to get <code>src/main.sere</code>, or a library
                  for <code>src/lib.sere</code>. The workspace opens as soon as
                  it exists.
                </Text>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setCreateKind("app")}>New app</Button>
                  <Button variant="ghost" onClick={() => setCreateKind("lib")}>
                    New library
                  </Button>
                </div>
              </Stack>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {recent.map((project) => (
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
          )}
        </Stack>

        <Stack gap="md">
          <Heading level={3}>Create</Heading>
          <div className="overflow-hidden rounded-2xl border border-white/8 bg-card/80">
            <button
              type="button"
              className="flex w-full flex-col gap-1 border-b border-border px-4 py-3.5 text-left transition-colors hover:bg-primary/10"
              onClick={() => setCreateKind("app")}
            >
              <span className="text-sm font-medium text-foreground">App</span>
              <span className="text-xs leading-5 text-muted">
                Binary workspace. Build with Ctrl+B, run with Ctrl+Enter.
              </span>
            </button>
            <button
              type="button"
              className="flex w-full flex-col gap-1 px-4 py-3.5 text-left transition-colors hover:bg-primary/10"
              onClick={() => setCreateKind("lib")}
            >
              <span className="text-sm font-medium text-foreground">Library</span>
              <span className="text-xs leading-5 text-muted">
                Packable module. Same cloud editor, library layout.
              </span>
            </button>
          </div>

          <Heading level={3}>Shortcuts</Heading>
          <div className="rounded-2xl border border-white/8 bg-card/80 px-4 py-3">
            <dl className="m-0 grid gap-2.5 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Save</dt>
                <dd className="m-0">
                  <kbd className="kbd">Ctrl</kbd>
                  <kbd className="kbd">S</kbd>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Build</dt>
                <dd className="m-0">
                  <kbd className="kbd">Ctrl</kbd>
                  <kbd className="kbd">B</kbd>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Run</dt>
                <dd className="m-0">
                  <kbd className="kbd">Ctrl</kbd>
                  <kbd className="kbd">Enter</kbd>
                </dd>
              </div>
            </dl>
          </div>

          <Heading level={3}>Reference</Heading>
          <div className="flex flex-col gap-1 text-sm">
            <a href="/docs" className="text-muted no-underline hover:text-primary">
              Language docs
            </a>
            <a href="/install" className="text-muted no-underline hover:text-primary">
              Local toolchain
            </a>
            <a href="/libraries" className="text-muted no-underline hover:text-primary">
              Package index
            </a>
          </div>
        </Stack>
      </div>

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
