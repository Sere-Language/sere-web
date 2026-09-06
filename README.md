# sere-web

The website for the [Sere language](https://github.com/Sere-Language/sere) — a statically typed, indentation-significant language that compiles to native code through LLVM.

Built with Next.js 16 (App Router), React 19, and Tailwind CSS 4.

## Features

- **Landing page** with live release data pulled from GitHub Releases
- **Docs** — language documentation synced from the Sere repository (`content/docs`), rendered as Markdown with custom syntax highlighting
- **Install page** — release catalog, installer/zip/VSIX download links, and a build-from-source guide
- **Issues page** — live issue tracking from the Sere GitHub repository
- **Cloud workbench** — browser-based editor (Monaco + xterm + Dockview) for writing and running Sere in the browser, with Supabase auth

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
| `SUPABASE_*` | For cloud features | Auth and storage for the cloud workbench |

Without a `GITHUB_TOKEN`, API-dependent pages fall back gracefully but may be rate-limited.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |

## Project structure

```
app/
  components/    Shared UI components (cards, layout, editor workbench)
  lib/           Data access (GitHub releases, docs, projects)
  api/           Route handlers (docs sync, releases sync)
  docs/          Documentation pages
  install/       Install guide
  issues/        Issue tracker
  cloud/         Cloud workbench and auth
content/
  docs/          Markdown documentation source
```

## Deployment

Any Node.js host that supports Next.js 16 works — e.g. Vercel, Fly.io, or a self-hosted `npm run build && npm start`.

## Related

- [Sere language repository](https://github.com/Sere-Language/sere)
- [Language documentation](https://github.com/Sere-Language/sere/tree/main/content/docs)

## License

See the license in the [Sere language repository](https://github.com/Sere-Language/sere).
