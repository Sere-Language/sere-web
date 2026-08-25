import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getReleaseCatalog } from "@/app/lib/release";
import { linuxZipHasCompiler, unzipLinuxRelease } from "@/app/lib/sereLinuxInstall";

export const runtime = "nodejs";
export const maxDuration = 120;

const CACHE_DIR = path.join(process.cwd(), ".sere-host", "linux");

export async function GET(): Promise<Response> {
  const catalog = await getReleaseCatalog();
  const candidates = catalog.all.filter((release) => release.linuxZip !== null);

  if (candidates.length === 0) {
    return Response.json(
      { error: "No linux.zip on GitHub releases yet." },
      { status: 404 },
    );
  }

  await mkdir(CACHE_DIR, { recursive: true });

  for (const release of candidates) {
    const asset = release.linuxZip;
    if (!asset) {
      continue;
    }
    const cached = path.join(CACHE_DIR, `${release.tag}-${asset.name}`);
    let bytes: Buffer | null = null;
    try {
      bytes = await readFile(cached);
    } catch {
      bytes = null;
    }

    if (!bytes) {
      const response = await fetch(asset.url, {
        headers: { "User-Agent": "sere-web", Accept: "application/octet-stream" },
        redirect: "follow",
      });
      if (!response.ok) {
        continue;
      }
      bytes = Buffer.from(await response.arrayBuffer());
    }

    const files = unzipLinuxRelease(new Uint8Array(bytes));
    if (!linuxZipHasCompiler(files)) {
      await unlink(cached).catch(() => undefined);
      continue;
    }

    await writeFile(cached, bytes);
    return new Response(Uint8Array.from(bytes), {
      headers: {
        "Content-Type": "application/zip",
        "Cache-Control": "private, max-age=3600",
        "X-Sere-Tag": release.tag,
        "X-Sere-Asset": asset.name,
      },
    });
  }

  return Response.json(
    {
      error:
        "linux.zip on GitHub is only install.sh (no bin/sere). Upload a full Linux tree, or Cloud will use the Windows compiler host.",
    },
    { status: 404 },
  );
}
