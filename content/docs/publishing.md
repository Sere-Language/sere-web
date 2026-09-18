# Publishing a package

Create an account, mint a publish token, then push a versioned package to the Sere registry with one HTTP request.

The registry is part of this site. You do not need a database account, a third-party login, or a key copied out of a console — you sign up here, create a token, and start uploading.

## 1. Create a developer account

Open [sere-lang.com/developers/signup](/developers/signup) and fill in three fields:

| Field | Rules |
| --- | --- |
| Email | Any address you can receive mail at. Used for sign-in and confirmation. |
| Handle | 3–40 characters. Lowercase letters, digits and dashes; must start and end with a letter or digit. Unique across the registry, and shown next to the packages you publish. |
| Password | At least 10 characters, at most 128. It must not contain the part of your email before the `@`. |

Submit the form and one of two things happens:

- **Instant access.** You land on your dashboard. Nothing else to do.
- **Confirm your email first.** We send a confirmation link. Open it and the account activates; the link returns you to the dashboard already signed in.

If it does not arrive within a couple of minutes, check the spam folder first. Sign-ups are rate limited to 5 per hour per network, and resends to 3 per hour.

### If the confirmation email never arrives

Press **Didn't get the confirmation email? Resend it** on the sign-up form. That is rate limited, and the answer is the same whether or not the address is registered.

If resending does not help, it is almost always one of these:

| Cause | How to tell | What to do |
| --- | --- | --- |
| Sign-in keeps saying the password is wrong, and no email arrives | The account exists but was never confirmed, and the deployment cannot send email. | The site's operator should set `DEVELOPER_AUTO_CONFIRM=true`, after which signing in again activates the account; or configure a mail sender. |
| The address already has a confirmed account | The form says a new link is on the way, but nothing is ever sent. The audit trail records `developer.signup_existing` with `confirmationEmailSent: false`. | Sign in instead, or sign up with a different address. |
| The deployment has no working mail sender | Every sign-up fails with "we could not send the confirmation email". | The site's operator needs to add mail credentials and check the sender's logs. |
| The provider's shared test sender is throttled | Mail works sometimes, then stops. | The site's operator needs a real mail sender: test senders are capped at a couple of messages per hour. |
| The deployment restricts which addresses may sign up | Sign-up fails with an address error. | Use an address the deployment allows. |

Email confirmation is a deployment setting. Where it is switched off, a new account is signed in immediately and no email is involved at all — both settings work with this flow.

Already have an account? [Sign in](/developers/login). Sessions last as long as you keep using the site: the access cookie is refreshed in the background, and the refresh cookie lasts 30 days.

## 2. Create a publish token

A token is a password for your tooling. It is how the API knows a request is really you, without sharing your account password.

1. Go to [sere-lang.com/developers](/developers).
2. Under **Publish tokens**, give the token a label that says where it lives — `laptop`, `github-actions`, `release-bot`. Labels are for you; they have no effect on permissions.
3. Choose an expiry: no expiry, 30 days, 90 days or 1 year. Per-machine tokens with an expiry are the safer default.
4. Press **Create token** and copy the value immediately.

```text
sere_4f0c9a21_9tK3xQpR7vLm2YbW8sN6dH1jC5zA0eU4rT7iG3oP
└──┬──┘ └──┬───┘ └─────────────────┬──────────────────┘
   │       │                       └── secret: shown once, stored only as a hash
   │       └── public prefix: what you see in the dashboard afterwards
   └── scheme
```

**The full token is shown exactly once.** The server keeps only a SHA-256 hash and the public prefix, so nobody — including an operator reading the database — can recover it. If you lose it, revoke that token and create another.

Store it as an environment variable rather than pasting it into a file you might commit:

```bash
export SERE_TOKEN="sere_4f0c9a21_9tK3xQpR7vLm2YbW8sN6dH1jC5zA0eU4rT7iG3oP"
```

Revoke a token from the same dashboard at any time. Revoking takes effect on the next request, and leaves your other tokens alone.

## 3. Describe the package

The registry reads a manifest: `sere.toml` (or `sere.json`) in the root of your library. Only the keys below are used; anything else is ignored, so you can keep your own tooling metadata in the same file.

```toml
[package]
name = "hello-utils"
version = "0.1.0"
summary = "Small helpers for Sere projects."
description = """
A longer explanation, shown on the package page.
"""
license = "MIT"
repository = "https://github.com/you/hello-utils"
homepage = "https://example.com/hello-utils"
author = "Your Name"
keywords = ["utilities", "strings"]
entry = "lib.sere"
```

| Key | Required | Notes |
| --- | --- | --- |
| `name` | Yes | Lowercase letters, digits, dots, dashes and underscores. Max 64 characters. Must start with a letter or digit. |
| `version` | Yes | Semantic version: `MAJOR.MINOR.PATCH`, optionally `-prerelease`. A leading `v` is stripped, so `v1.2.0` is stored as `1.2.0`. |
| `summary` | No | One line, up to 280 characters. Defaults to the first line of `description`. |
| `description` | No | Up to 4000 characters. |
| `license` | No | Shown as a badge on the package page, e.g. `MIT`, `Apache-2.0`. |
| `repository` / `homepage` | No | URLs, up to 300 characters each. Linked from the package page. |
| `author` | No | Up to 120 characters. |
| `keywords` | No | Up to 12 entries, lowercased and de-duplicated. They feed registry search. |
| `entry` | No | Path to the library entry file. Defaults to `lib.sere` if omitted. |

Add a `README.md` next to the manifest. It is rendered on your package page under **README**, so it is the best place to explain the API you are publishing.

## 4. Publish

Pack the library:

```bash
sere pack hello-utils
```

Upload it. The archive can be the `.slib` that `sere pack` produces, or a `.tar.gz` / `.zip` of the library folder:

```bash
curl -X POST https://sere-lang.com/api/packages \
  -H "Authorization: Bearer $SERE_TOKEN" \
  -F "name=hello-utils" \
  -F "version=0.1.0" \
  -F "manifest=@sere.toml" \
  -F "readme=@README.md" \
  -F tarball=@dist/hello-utils-0.1.0.tar.gz
```

Every field except the archive is optional if you send `manifest`, and any field you do send overrides the manifest — handy when CI stamps the version:

```bash
  -F "manifest=@sere.toml" \
  -F "version=$RELEASE_VERSION" \
```

A successful publish answers `201`:

```json
{
  "published": {
    "name": "hello-utils",
    "version": "0.1.0",
    "summary": "Small helpers for Sere projects.",
    "latestVersion": "0.1.0",
    "versionsCount": 1,
    "created": true,
    "bytes": 18421,
    "checksumSha256": "9f2c4d...e1",
    "tarballPath": "hello-utils/0.1.0/hello-utils-0.1.0.tar.gz",
    "downloadUrl": "https://…/storage/v1/object/public/packages/hello-utils/0.1.0/hello-utils-0.1.0.tar.gz",
    "url": "/api/packages/hello-utils",
    "install": "sere add hello-utils@0.1.0"
  }
}
```

Your package appears on [Libraries](/libraries) immediately, and at `/libraries/hello-utils`.

### Versions are immutable

Publishing a version that already exists is rejected with `409` — a version always resolves to the same bytes and the same checksum. To ship a change, bump the version. `latest` follows the highest semantic version in the registry, not the most recently uploaded one, so publishing `0.9.9` after `1.0.0` will not drag `latest` backwards.

### A name belongs to one developer

The first publisher to claim a name owns it, and that never changes behind your back:

| Situation | Result |
| --- | --- |
| You publish a version under a name you already own | `200` — the version is added and the package's summary, description, links, author and keywords are refreshed from the new manifest. This is how you update a package. |
| You publish under a free name | `201` — the package is created and you own it. |
| You publish under a name another developer owns | `403` — refused, and nothing is written. Not even the tarball is kept. |
| A name first released with the deployment's own CI token | `403` — those names are reserved, so nobody can claim one just by asking first. |

Names are never renamed or transferred. If you need a different name, publish under it; if you think a name has been abandoned, ask its owner to hand it over.

## 5. Install a published package

Once a version is on the registry, anyone can install it — downloads are public, so no account or token is involved. The short version:

```bash
sere add hello-utils
sere add hello-utils@0.1.0
```

Or fetch the archive and drop it into `libs/`, where the compiler treats a folder or a `.slib` as an importable library:

```bash
mkdir -p libs/hello-utils
curl -Lo hello-utils-0.1.0.tar.gz \
  "https://sere-lang.com/api/packages/hello-utils/0.1.0/download?stream=1"
tar -xzf hello-utils-0.1.0.tar.gz -C libs/hello-utils
```

[Installing packages](/docs/installing-packages) covers version selectors, checksum verification and the rest of the download API.

## 6. Publish from CI

A token plus one `curl` is the whole integration. Guard the token with a secret, and publish on tag pushes:

```yaml
name: publish
on:
  push:
    tags: ["v*"]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Pack
        run: sere pack hello-utils

      - name: Publish to the Sere registry
        env:
          SERE_TOKEN: ${{ secrets.SERE_TOKEN }}
        run: |
          curl --fail-with-body -X POST https://sere-lang.com/api/packages \
            -H "Authorization: Bearer $SERE_TOKEN" \
            -F "manifest=@sere.toml" \
            -F "version=${GITHUB_REF_NAME#v}" \
            -F "readme=@README.md" \
            -F tarball=@dist/hello-utils-0.1.0.tar.gz
```

Use `--fail-with-body` so a rejected publish fails the job and prints the reason.

## 7. What the API checks

| Status | Meaning | What to do |
| --- | --- | --- |
| `400` | The manifest, name or version is invalid, or a field is missing. | The response names the field. Names are lowercase; versions need three numeric parts. |
| `401` | No token, or the token is malformed, revoked or expired. | Create a new token on the dashboard. |
| `403` | Either the token cannot publish, or the package name belongs to someone else. | Use a `publish`-scoped token; if the name is taken, publish under a different one. |
| `409` | That version already exists. | Bump the version. |
| `413` | The archive is over 25 MB, or the README is over 64 KB. | Trim the payload — the registry is for libraries, not build output. |
| `415` | The request was not `multipart/form-data`. | Send the fields shown above; `-F` does this for you. |
| `429` | Rate limited. | The response carries `Retry-After` and `ratelimit-reset`. Back off and retry. |
| `503` | Publishing or token checking is unavailable on the deployment. | Nothing to fix in your request. Retry later — if you run the deployment, `GET /api/registry/status` with a publish token reports the cause. |

### If the token is refused

Publishing answers with a specific reason, so start by reading it:

| Message | Meaning |
| --- | --- |
| "That is a token's public prefix, not the token" | You copied the value from the token table. The table lists `sere_xxxxxxxx…`, which is only the public half. Create a new token and copy the whole value the moment it is shown. |
| "That does not look like a registry token" | The stored value is not a token at all — often a Supabase key or an old credential. Run `sere login` again with a token from `/developers`. |
| "That publish token is not valid" | The token is well-formed but the registry has no match for it. It may belong to a different deployment, or it was created before the registry schema existed. Create a new one on the deployment you are publishing to. |
| "That token has been revoked" / "has expired" | Expected: the credential was retired. Create a replacement. |
| `503` with "could not check that token" | The deployment cannot reach its token table. The message names the cause — missing tables, a rejected key, or an unreachable database. `GET /api/registry/status` probes each dependency separately. |

To check a token without publishing anything:

```bash
curl -s -X POST https://sere-lang.com/api/developers/tokens/verify \
  -H "Authorization: Bearer $SERE_TOKEN"
```

```powershell
Invoke-RestMethod -Method Post `
  -Uri https://sere-lang.com/api/developers/tokens/verify `
  -Headers @{ Authorization = "Bearer $env:SERE_TOKEN" }
```

A valid token answers `200` with `"valid": true`, its scope and the deployment status. Anything else tells you exactly which of the cases above you are in.

### Limits

| Limit | Value |
| --- | --- |
| Archive size | 25 MB per version |
| README | 64 KB |
| Manifest | 32 KB |
| Summary | 280 characters |
| Description | 4000 characters |
| Keywords | 12 per package |
| Account creations | 5 per hour per network |
| Sign-in attempts | 10 per 15 minutes per network |
| Token creation | 20 per hour per account |
| Publishes | 30 per hour per token, 120 per hour per network |
| Registry list and search | 240 per minute per network |
| Version metadata and downloads | 120 per minute per network |

## 8. How your credentials are protected

- Tokens are stored as SHA-256 hashes and compared in constant time. The plaintext exists only in the response that created it.
- Every publish goes through this site's server. The database key never reaches a browser, and there is no client-side SDK in the page to copy it from.
- Sessions use httpOnly cookies that script cannot read, and cookie-authenticated actions reject cross-site requests.
- Publishes, failed attempts, sign-ups, sign-ins and credential changes are written to an audit trail with hashed IP addresses.
- Browsers get a strict content security policy, HSTS and framing protection in production.

### If a token leaks

Revoke it on the [dashboard](/developers) — that takes effect immediately — then create a replacement and update wherever it was stored. Revoked tokens stay in the list, marked `Revoked`, so you can tell them apart from tokens that are still live.

## 9. Next steps

- [Libraries](/libraries) — search the registry, or browse what other people have published.
- [Developer dashboard](/developers) — create and revoke tokens, and see your account.
- [Package API reference](/api/packages) — the same endpoints a client uses, with no token required for reads.
