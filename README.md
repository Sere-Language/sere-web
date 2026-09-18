# sere-web

The website for the [Sere language](https://github.com/Sere-Language/sere) — a statically typed, indentation-significant language that compiles to native code through LLVM.

Built with Next.js 16 (App Router), React 19, and Tailwind CSS 4.

## Features

- **Landing page** with live release data pulled from GitHub Releases
- **Docs** — language documentation synced from the Sere repository (`content/docs`), rendered as Markdown with custom syntax highlighting
- **Install page** — release catalog, installer/zip/VSIX download links, and a build-from-source guide
- **Issues page** — live issue tracking from the Sere GitHub repository
- **Package registry** — searchable library index on `/libraries`, per-package pages, and a publish API with developer accounts and tokens on `/developers`

## Getting started

Prerequisites: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GITHUB_TOKEN` | No | Raises GitHub API rate limits for releases, issues, and docs syncing |
| `NEXT_PUBLIC_SUPABASE_URL` | For accounts and the registry | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | For accounts and the registry | Publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | For publishing | Server-only key used to verify tokens and write packages |
| `PACKAGE_PUBLISH_TOKEN` | No | Optional shared secret for CI, sent as `x-publish-token` |
| `DEVELOPER_AUTO_CONFIRM` | No | Activates accounts without email — see the note below |
| `IP_HASH_SALT` | No | Pepper for the hashed IPs in rate limits and audits |

Without a `GITHUB_TOKEN`, API-dependent pages fall back gracefully but may be rate-limited. Without Supabase, the libraries page renders an empty state and developer accounts are reported as unavailable.

Only the first two are build-time public values. The service role key and publish token are server-only and never reach the browser.

### Developer accounts

Developers never touch the database provider — `/developers` is the whole story.

| Route | Purpose |
| --- | --- |
| `/developers/signup` | Create an account with an email, password and handle |
| `/developers/login` | Start a session: two httpOnly cookies, nothing else |
| `/developers` | Dashboard: create and revoke publish tokens |
| `/auth/callback` | Where an email confirmation link lands |

Sessions live in httpOnly, SameSite=Lax cookies and are refreshed by `proxy.ts` before they expire. Publish tokens are shown once, stored only as SHA-256 hashes, and can be revoked one at a time.

Email confirmation is a deployment setting, and the flow supports both states:

- **Confirmation on** — sign-up sends a link and no session is issued until it is opened. This needs a real mail sender. A provider's built-in test sender is capped at a couple of messages per hour and will silently stop delivering, so configure custom SMTP before going live. Lost links can be re-sent from `/developers/signup` (`POST /api/developers/resend`, 3 per hour per network).
- **Confirmation off** — sign-up returns a session straight away and no email is involved. Nothing to configure.
- **Confirmation on, no mail sender** — set `DEVELOPER_AUTO_CONFIRM=true`. Sign-up and sign-in then activate the account once the provider has verified the password, so nobody is locked out while mail delivery is being fixed. This skips email verification, so turn it back off once mail works.

An address that already has a confirmed account is deliberately never re-emailed — that is the usual reason a "confirmation email never arrived". The audit trail records it as `developer.signup_existing` with `confirmationEmailSent: false`, and `developer.confirmation_resent` records resends.

### Package registry

Paste [`supabase/schema.sql`](supabase/schema.sql) into the database SQL editor once. It creates the developer, token, package, rate-limit and audit tables, the `packages` storage bucket, and the row level security policies.

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/packages` | GET | List or search — `?q=`, `?sort=downloads\|recent\|name\|relevance`, `?limit=` |
| `/api/packages` | POST | Publish a version (multipart: `tarball`, `name`, `version`, plus optional `manifest`, `readme`, `summary`, `license`, …) |
| `/api/packages/:name` | GET | One package with every published version |
| `/api/packages/:name/:version` | GET | Version metadata plus a download URL |
| `/api/packages/:name/:version` | POST | Count an install and return the download URL |
| `/api/packages/:name/download` | GET · HEAD | Download the latest release — `?version=1.2.3`, `?version=1.2`, `?stream=1` |
| `/api/packages/:name/:version/download` | GET · HEAD | Download one exact version |
| `/api/developers/signup` · `/login` · `/logout` | POST | Account lifecycle |
| `/api/developers/session` | GET · POST | Who is signed in; accept a confirmation hand-off |
| `/api/developers/resend` | POST | Re-send the confirmation email (answers generically either way) |
| `/api/developers/tokens` | GET · POST | List tokens; mint one (plaintext returned once) |
| `/api/developers/tokens/:id` | DELETE | Revoke a token |
| `/api/developers/tokens/verify` | POST | Check a publish token without publishing anything |
| `/api/registry/status` | GET | Deployment health check: config flags plus one probe per dependency |

Publish with a token from `/developers` as `Authorization: Bearer sere_…`, or from CI with `x-publish-token: $PACKAGE_PUBLISH_TOKEN`. Versions are immutable — republishing an existing version is rejected with `409` — and a package name belongs to one developer: publishing under a name you own adds a version and refreshes its metadata (`200`), claiming a free name creates it (`201`), and a name owned by someone else is refused with `403` before anything is written.

Two guides in the docs cover the developer side:

- [Installing packages](content/docs/installing-packages.md) — version selectors, the download API, checksum verification.
- [Publishing a package](content/docs/publishing.md) — accounts, tokens, manifests, CI, and every error the API returns.

### Security

- Tokens are stored only as SHA-256 hashes and compared in constant time; the plaintext is returned exactly once.
- Every write goes through a server route. The database key never reaches the browser, and there is no client-side SDK to leak it.
- Cookie-authenticated mutations reject cross-site requests via `Origin` and `Sec-Fetch-Site`.
- Fixed-window rate limits (Postgres-backed, with an in-process fallback) cover sign-up, sign-in, token creation, publishing and reads; over-limit requests get `429` with `Retry-After`.
- Uploads are capped at 25 MB, READMEs at 64 KB, manifests at 32 KB, and every text field is length-capped.
- Package names and versions are strictly validated before they become storage paths, so a crafted manifest cannot escape its prefix.
- Provider errors are mapped to generic messages, so responses cannot be used to enumerate accounts.
- Publishes, failed attempts and credential changes land in `audit_log` with hashed IPs.
- Production responses carry a CSP, HSTS, `X-Frame-Options: DENY` and a restrictive `Permissions-Policy`.

## Project structure

```
app/
  components/    Shared UI components (cards, layout, packages, typography)
  lib/           Data access (GitHub releases, docs, package registry)
  api/           Route handlers (docs sync, releases sync, package registry)
  docs/          Documentation pages
  install/       Install guide
  issues/        Issue tracker
  libraries/     Package registry index and per-package pages
content/
  docs/          Markdown documentation source
supabase/
  schema.sql     Registry tables, storage bucket, and RLS policies
```

## Deployment

Any Node.js host that supports Next.js 16 works — e.g. Vercel, Fly.io, or a self-hosted `npm run build && npm start`.

Developer accounts and the registry need three variables in the deployment environment:

| Variable | Needed for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Everything — reads, accounts, publishing |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Everything — reads, accounts, publishing |
| `SUPABASE_SERVICE_ROLE_KEY` | Publishing. Reads and accounts work without it; nothing can be written |

`SUPABASE_SERVICE_ROLE_KEY` must be the **secret** key (or the legacy `service_role` JWT), not the publishable one. A publishable key in that variable is refused up front, because otherwise every write would fail on row level security with a far less obvious error.

Environment changes only apply to a new deployment: after adding or editing these on Vercel, redeploy (`vercel --prod`), or the running deployment keeps its old environment.

To check a deployment without publishing anything:

```bash
curl -s https://sere-lang.com/api/registry/status \
  -H "x-publish-token: $PACKAGE_PUBLISH_TOKEN" | jq
```

The report is for whoever operates the deployment, so it requires a credential: the shared `PACKAGE_PUBLISH_TOKEN`, or any developer publish token as `Authorization: Bearer …`. Without one it answers `401` and says nothing about the deployment.

```json
{
  "config": {
    "supabase": true,
    "serviceRole": true,
    "sharedPublishToken": false,
    "autoConfirm": true,
    "publishProblem": null,
    "publishDiagnosis": null
  },
  "checks": [{ "name": "packages table, public read", "ok": true, "detail": null }],
  "diagnosis": "The registry is ready: reads, tokens, storage and the rate limiter all answered.",
  "ready": true
}
```

`publishDiagnosis` names the exact variable and fix when publishing is unavailable. `publishProblem` is the same problem phrased for the public, and it is what `POST /api/packages` returns as its `503` message — no deployment detail reaches an API caller or a page visitor.

## Related

- [Sere language repository](https://github.com/Sere-Language/sere)
- [Language documentation](https://github.com/Sere-Language/sere/tree/main/content/docs)

## License

See the license in the [Sere language repository](https://github.com/Sere-Language/sere).
