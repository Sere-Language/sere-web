import { getSupabaseClient } from "./db";
import { deleteStoredProjectFiles } from "./projectFiles";

export type ProjectKind = "app" | "lib";

export interface CloudProject {
  id: string;
  name: string;
  slug: string;
  kind: ProjectKind;
  createdAt: string;
}

const MAX_SLUG_LENGTH = 64;

interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  kind: string;
  created_at: string;
}

export function slugifyProjectName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH);
}

export function projectPath(slug: string): string {
  return `/cloud/projects/${encodeURIComponent(slug)}`;
}

export function projectKindLabel(kind: ProjectKind): string {
  return kind === "lib" ? "Library" : "App";
}

export function parseProjectKind(value: string | null | undefined): ProjectKind {
  return value === "lib" || value === "library" ? "lib" : "app";
}

export function formatProjectCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  const deltaMs = Date.now() - date.getTime();
  const minuteMs = 60_000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const minutes = Math.round(deltaMs / minuteMs);

  if (Math.abs(minutes) < 1) {
    return "just now";
  }
  if (Math.abs(deltaMs) < hourMs) {
    return `${minutes}m ago`;
  }
  if (Math.abs(deltaMs) < dayMs) {
    return `${Math.round(deltaMs / hourMs)}h ago`;
  }
  if (Math.abs(deltaMs) < 14 * dayMs) {
    return `${Math.round(deltaMs / dayMs)}d ago`;
  }

  return formatProjectCreatedAt(iso);
}

function mapRow(row: ProjectRow): CloudProject | null {
  if (!row.id || !row.slug) {
    return null;
  }

  const kind: ProjectKind =
    row.kind === "lib" || row.kind === "library" ? "lib" : "app";

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    kind,
    createdAt: row.created_at,
  };
}

async function requireUserId(): Promise<string> {
  const supabaseClient = getSupabaseClient();
  const { data, error } = await supabaseClient.auth.getUser();

  if (error || !data.user) {
    throw new Error("Sign in to manage projects.");
  }

  return data.user.id;
}

export async function listProjects(): Promise<CloudProject[]> {
  const supabaseClient = getSupabaseClient();
  await requireUserId();

  const { data, error } = await supabaseClient
    .from("projects")
    .select("id, name, slug, kind, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).flatMap((row) => {
    const project = mapRow(row as ProjectRow);
    return project ? [project] : [];
  });
}

export async function createProject(input: {
  name: string;
  slug: string;
  kind: ProjectKind;
}): Promise<CloudProject> {
  const supabaseClient = getSupabaseClient();
  const userId = await requireUserId();

  const { data, error } = await supabaseClient
    .from("projects")
    .insert({
      user_id: userId,
      name: input.name,
      slug: input.slug,
      kind: input.kind,
    })
    .select("id, name, slug, kind, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("You already have a project with that name.");
    }

    throw new Error(error.message);
  }

  const project = mapRow(data as ProjectRow);
  if (!project) {
    throw new Error("Project was created, but the response was invalid.");
  }

  return project;
}

export async function getProjectBySlug(slug: string): Promise<CloudProject | null> {
  const supabaseClient = getSupabaseClient();
  await requireUserId();

  const { data, error } = await supabaseClient
    .from("projects")
    .select("id, name, slug, kind, created_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return mapRow(data as ProjectRow);
}

export async function deleteProject(slug: string): Promise<void> {
  const supabaseClient = getSupabaseClient();
  await requireUserId();
  const project = await getProjectBySlug(slug);
  if (project) {
    await deleteStoredProjectFiles(project.id);
  }

  const { error } = await supabaseClient.from("projects").delete().eq("slug", slug);

  if (error) {
    throw new Error(error.message);
  }
}

export function countProjectsByKind(projects: CloudProject[]): {
  total: number;
  apps: number;
  libraries: number;
} {
  return {
    total: projects.length,
    apps: projects.filter((project) => project.kind === "app").length,
    libraries: projects.filter((project) => project.kind === "lib").length,
  };
}
