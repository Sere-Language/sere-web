# Installing packages

Find a package, install it into `libs/`, and verify the archive you got. Downloads are public — no account and no token needed.

The standard library is not installed: it ships inside the compiler. Only packages you opt into live in the registry, and this page covers putting one in your project.

## Find a package

Browse [Libraries](/libraries), where packages can be searched by name, keyword or summary and sorted by popularity, recency or name. Each package has its own page at `/libraries/<name>` listing every published version.

The same data is available to tooling:

```bash
curl -s "https://sere-lang.com/api/packages?q=math&sort=downloads&limit=5"
```

`q` matches names, keywords and summaries. `sort` accepts:

| Value | Order |
| --- | --- |
| `downloads` | Most downloaded first — the default |
| `recent` | Most recently published first |
| `name` | Alphabetical |
| `relevance` | Name matches ranked above keyword and summary matches |

## Install the latest version

```bash
sere add mathlib
```

If your toolchain does not have `sere add` yet, download the archive and drop it into `libs/` yourself:

```bash
mkdir -p libs/mathlib
curl -Lo mathlib-0.1.0.tar.gz \
  "https://sere-lang.com/api/packages/mathlib/0.1.0/download?stream=1"
tar -xzf mathlib-0.1.0.tar.gz -C libs/mathlib
```

A packed `.slib` needs no extraction — copy the file straight into `libs/`. Then import it like any other library:

```sere
import mathlib

def main() -> i32:
    return mathlib.add(2, 3)
```

## Install a specific version

```bash
sere add mathlib@0.1.0
```

Pinning an exact version is safe: a published version is immutable, so `0.1.0` always resolves to the same bytes and the same checksum. `latest` is the one that moves.

## Where packages live

| Path | What it is |
| --- | --- |
| `libs/mathlib/lib.sere` | A folder library — the entry file |
| `libs/mathlib.sere` | A single-file library |
| `libs/mathlib.slib` | A packed library |
| `libs/mathlib/native/` | Optional C sources, compiled with the library |

Anything in `libs/` is importable, whether it came from the registry or not. Removing a package means deleting it from `libs/`.

## The download API

The registry serves downloads itself, so a client never needs to know where the files are stored.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/packages/mathlib/download` | The latest release |
| `GET /api/packages/mathlib/download?version=0.1.0` | Exactly that version |
| `GET /api/packages/mathlib/download?version=0.1` | The newest release starting with `0.1` |
| `GET /api/packages/mathlib/0.1.0/download` | The same thing, with the version in the path |
| `HEAD /api/packages/mathlib/0.1.0/download` | Size and checksum, without the archive |

The `version` selector accepts:

| Selector | Resolves to |
| --- | --- |
| omitted, `latest`, `*` | The highest release without a prerelease tag |
| `0.1.0` | Exactly that version |
| `0.1` or `0` | The highest release matching that prefix |

Prereleases are deliberately skipped by `latest` and by partial selectors. To install one, name it exactly: `?version=0.2.0-rc.1`.

## Redirects, or the bytes themselves

By default a download answers `302` and sends you to the stored object, which keeps archives off the application server:

```bash
curl -LO https://sere-lang.com/api/packages/mathlib/download
```

Add `stream=1` to have the archive proxied through the API instead — useful when you want the file name and the checksum headers in the same response:

```bash
curl -Lo mathlib-0.1.0.tar.gz \
  "https://sere-lang.com/api/packages/mathlib/0.1.0/download?stream=1"
```

Either way the response carries what you need to verify it:

| Header | Meaning |
| --- | --- |
| `X-Package-Name` | Package name |
| `X-Package-Version` | The version that was resolved |
| `X-Checksum-Sha256` | SHA-256 of the archive, also sent as the `ETag` |
| `X-Package-Bytes` | Archive size in bytes |

`HEAD` answers with the same headers without transferring the archive, and without counting a download. `GET` counts one.

## Read metadata without downloading

```bash
curl -s https://sere-lang.com/api/packages/mathlib
curl -s https://sere-lang.com/api/packages/mathlib/0.1.0
```

The first returns every published version with a `download` path for each, plus `latestVersion` and `latestDownload`. The second returns one version:

```json
{
  "name": "mathlib",
  "version": "0.1.0",
  "summary": "Small numeric helpers.",
  "license": "MIT",
  "entry": "lib.sere",
  "bytes": 18421,
  "checksumSha256": "9f2c4d…e1",
  "publishedAt": "2026-09-18T10:12:04.512Z",
  "download": "/api/packages/mathlib/0.1.0/download",
  "downloadUrl": "https://…/packages/mathlib/0.1.0/mathlib-0.1.0.tar.gz",
  "install": "sere add mathlib@0.1.0"
}
```

`download` is the endpoint to use; `downloadUrl` is the underlying stored object, handy if you would rather fetch from the CDN directly.

## Verify what you downloaded

Compare the SHA-256 of the file against the `checksumSha256` the registry reports:

```bash
sha256sum mathlib-0.1.0.tar.gz                    # Linux
shasum -a 256 mathlib-0.1.0.tar.gz                # macOS
Get-FileHash mathlib-0.1.0.tar.gz -Algorithm SHA256   # PowerShell
```

A mismatch means a truncated or altered download — delete it and fetch it again. Because a version can never change, a matched checksum is worth caching.

## Updates

Ask for the current release without downloading anything:

```bash
curl -s https://sere-lang.com/api/packages/mathlib/download \
  -o /dev/null -D - | grep -i x-package-version
```

Then pin whichever version you settle on. Resolving `latest` gives you the newest release; naming an exact version gives you a reproducible build, since the bytes behind it are fixed.

## Troubleshooting

| Response | Meaning | What to do |
| --- | --- | --- |
| `404 No package named "x"` | The name is wrong, or nothing is published under it. | Search [Libraries](/libraries). |
| `404 … has no version matching "x"` | The package exists but no version matched the selector. The response lists the versions that do exist. | Pick one from the list. |
| `404 … has no published versions yet` | The package row exists with no release. | Ask the publisher to push a version. |
| `429` | More than 120 downloads in a minute from your network. | Wait for the `Retry-After` header, then retry. |
| `503` | The deployment cannot reach package storage. | This one is for the site's operator, not you. |
| Checksum mismatch | The archive was truncated or altered in transit. | Delete it and download again. |

## Limits and caching

| Limit | Value |
| --- | --- |
| Downloads and metadata reads | 120 per minute per network |
| Archive size | 25 MB per version |
| Response caching | One year, `immutable` — versions cannot change |
| Versions | Immutable; a published version is never rebuilt |

## Next steps

- [Libraries](/libraries) — search the registry.
- [Publishing a package](/docs/publishing) — put your own library in the registry.
- [Developer accounts](/developers) — tokens and publishing from CI.
