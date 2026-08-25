const STORAGE_KEY = "sere-cloud-last-opened";

function readMap(): Record<string, number> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed as Record<string, number>;
  } catch {
    return {};
  }
}

export function getLastOpenedMap(): Record<string, number> {
  return readMap();
}

export function markProjectOpened(slug: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const map = readMap();
  map[slug] = Date.now();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function lastOpenedIso(slug: string): string | null {
  const timestamp = readMap()[slug];
  if (!timestamp) {
    return null;
  }

  return new Date(timestamp).toISOString();
}
