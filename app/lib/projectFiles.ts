import { getSupabaseClient } from "./db";
import { savableFiles, shouldPersistPath } from "./sereInit";
import type { WorkspaceFile } from "./workspace";

const PROJECT_FILES_BUCKET = "project-files";
const PROJECT_FILES_TABLE = "project_files";
const DOTFILE_PREFIX = "_dot_";

let preferTable = false;

function encodePathSegment(segment: string): string {
  return segment.startsWith(".") ? `${DOTFILE_PREFIX}${segment.slice(1)}` : segment;
}

function decodePathSegment(segment: string): string {
  return segment.startsWith(DOTFILE_PREFIX)
    ? `.${segment.slice(DOTFILE_PREFIX.length)}`
    : segment;
}

function encodeRelativePath(path: string): string {
  return path.split("/").map(encodePathSegment).join("/");
}

function decodeRelativePath(path: string): string {
  return path.split("/").map(decodePathSegment).join("/");
}

function objectKey(userId: string, projectId: string, filePath: string): string {
  const normalized = filePath.replaceAll("\\", "/").replace(/^\/+/, "");
  return `${userId}/${projectId}/${encodeRelativePath(normalized)}`;
}

function filePathFromKey(userId: string, projectId: string, key: string): string {
  const prefix = `${userId}/${projectId}/`;
  const relative = key.startsWith(prefix) ? key.slice(prefix.length) : key;
  return decodeRelativePath(relative);
}

async function requireUserId(): Promise<string> {
  const supabaseClient = getSupabaseClient();
  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session?.user) {
    throw new Error("Sign in to manage project files.");
  }
  return data.session.user.id;
}

function isRlsError(message: string): boolean {
  return /row-level security|not found|does not exist|bucket/i.test(message);
}

async function listObjectKeys(prefix: string): Promise<string[]> {
  const supabaseClient = getSupabaseClient();
  const keys: string[] = [];

  async function walk(folder: string): Promise<void> {
    const { data, error } = await supabaseClient.storage
      .from(PROJECT_FILES_BUCKET)
      .list(folder, { limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } });

    if (error) {
      throw new Error(error.message);
    }

    for (const item of data ?? []) {
      if (item.name.startsWith(".")) {
        continue;
      }
      const next = folder ? `${folder}/${item.name}` : item.name;
      const isFolder = item.id === null;
      if (isFolder) {
        await walk(next);
      } else {
        keys.push(next);
      }
    }
  }

  await walk(prefix);
  return keys;
}

async function listFromTable(projectId: string): Promise<WorkspaceFile[]> {
  const supabaseClient = getSupabaseClient();
  const { data, error } = await supabaseClient
    .from(PROJECT_FILES_TABLE)
    .select("path, content")
    .eq("project_id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .filter((row) => shouldPersistPath(String(row.path)))
    .map((row) => ({ path: String(row.path), content: String(row.content ?? "") }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

async function saveToTable(projectId: string, files: WorkspaceFile[]): Promise<void> {
  const supabaseClient = getSupabaseClient();
  const persist = savableFiles(files);
  const keep = new Set(persist.map((file) => file.path));

  const { data: existing, error: listError } = await supabaseClient
    .from(PROJECT_FILES_TABLE)
    .select("path")
    .eq("project_id", projectId);
  if (listError) {
    throw new Error(listError.message);
  }

  const stale = (existing ?? [])
    .map((row) => String(row.path))
    .filter((path) => !keep.has(path));
  if (stale.length > 0) {
    const { error } = await supabaseClient
      .from(PROJECT_FILES_TABLE)
      .delete()
      .eq("project_id", projectId)
      .in("path", stale);
    if (error) {
      throw new Error(error.message);
    }
  }

  if (persist.length === 0) {
    return;
  }

  const { error } = await supabaseClient.from(PROJECT_FILES_TABLE).upsert(
    persist.map((file) => ({
      project_id: projectId,
      path: file.path,
      content: file.content,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "project_id,path" },
  );
  if (error) {
    throw new Error(error.message);
  }
}

async function deleteFromTable(projectId: string): Promise<void> {
  const supabaseClient = getSupabaseClient();
  const { error } = await supabaseClient
    .from(PROJECT_FILES_TABLE)
    .delete()
    .eq("project_id", projectId);
  if (error) {
    throw new Error(error.message);
  }
}

async function listFromStorage(projectId: string, userId: string): Promise<WorkspaceFile[]> {
  const supabaseClient = getSupabaseClient();
  const prefix = `${userId}/${projectId}`;
  const keys = await listObjectKeys(prefix);
  const files: WorkspaceFile[] = [];

  for (const key of keys) {
    const path = filePathFromKey(userId, projectId, key);
    if (!shouldPersistPath(path)) {
      continue;
    }

    const { data, error } = await supabaseClient.storage.from(PROJECT_FILES_BUCKET).download(key);
    if (error || !data) {
      throw new Error(error?.message ?? "Could not download a project file.");
    }

    files.push({ path, content: await data.text() });
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

async function saveToStorage(
  projectId: string,
  userId: string,
  files: WorkspaceFile[],
): Promise<void> {
  const supabaseClient = getSupabaseClient();
  const persist = savableFiles(files);
  const prefix = `${userId}/${projectId}`;
  const keep = new Set(persist.map((file) => objectKey(userId, projectId, file.path)));
  const existing = await listObjectKeys(prefix);
  const stale = existing.filter((key) => !keep.has(key));

  if (stale.length > 0) {
    const { error } = await supabaseClient.storage.from(PROJECT_FILES_BUCKET).remove(stale);
    if (error) {
      throw new Error(error.message);
    }
  }

  for (const file of persist) {
    const key = objectKey(userId, projectId, file.path);
    const body = new Blob([file.content], { type: "text/plain;charset=utf-8" });
    const { error } = await supabaseClient.storage.from(PROJECT_FILES_BUCKET).upload(key, body, {
      upsert: true,
      contentType: "text/plain;charset=utf-8",
    });
    if (error) {
      throw new Error(`${file.path}: ${error.message}`);
    }
  }
}

async function deleteFromStorage(projectId: string, userId: string): Promise<void> {
  const supabaseClient = getSupabaseClient();
  const keys = await listObjectKeys(`${userId}/${projectId}`);
  if (keys.length === 0) {
    return;
  }
  const { error } = await supabaseClient.storage.from(PROJECT_FILES_BUCKET).remove(keys);
  if (error) {
    throw new Error(error.message);
  }
}

export async function listProjectFiles(projectId: string): Promise<WorkspaceFile[]> {
  const userId = await requireUserId();
  if (preferTable) {
    return listFromTable(projectId);
  }
  try {
    return await listFromStorage(projectId, userId);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "";
    if (!isRlsError(message)) {
      throw new Error(formatStorageError(message));
    }
    preferTable = true;
    return listFromTable(projectId);
  }
}

export async function saveProjectFiles(
  projectId: string,
  files: WorkspaceFile[],
): Promise<void> {
  const userId = await requireUserId();
  if (preferTable) {
    await saveToTable(projectId, files);
    return;
  }
  try {
    await saveToStorage(projectId, userId, files);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "";
    if (!isRlsError(message)) {
      throw new Error(formatStorageError(message));
    }
    preferTable = true;
    await saveToTable(projectId, files);
  }
}

export async function deleteStoredProjectFiles(projectId: string): Promise<void> {
  const userId = await requireUserId();
  try {
    await deleteFromStorage(projectId, userId);
  } catch {
    // Storage may be unavailable; still clear the table copy.
  }
  try {
    await deleteFromTable(projectId);
  } catch {
    // Table may not exist yet.
  }
}

function formatStorageError(message: string): string {
  if (isRlsError(message)) {
    return `Could not use the project-files storage bucket (${message}). Run supabase/project_files_storage.sql in the Supabase SQL editor, then retry. Cloud will keep using the project_files table until storage RLS works.`;
  }
  return message;
}
