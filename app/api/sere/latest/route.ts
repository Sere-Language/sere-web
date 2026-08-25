import { getReleaseCatalog, linuxToolchainRelease, recommendedRelease } from "@/app/lib/release";

export async function GET(): Promise<Response> {
  const catalog = await getReleaseCatalog();
  const release = recommendedRelease(catalog);
  const linux = linuxToolchainRelease(catalog);

  return Response.json({
    tag: release?.tag ?? linux?.tag ?? "dev",
    name: release?.name ?? "latest",
    pageUrl: release?.pageUrl ?? "https://github.com/Sere-Language/sere/releases",
    zipUrl: release?.zip?.url ?? null,
    linuxZipUrl: linux?.linuxZip?.url ?? null,
    linuxTag: linux?.tag ?? null,
    linuxZipName: linux?.linuxZip?.name ?? null,
  });
}
