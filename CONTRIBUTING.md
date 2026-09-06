# Contributing to sere-web

Thanks for your interest in contributing! This guide covers setting up the project locally and the conventions we follow.

## Getting set up

1. Fork the repository and clone your fork:

   ```bash
   git clone https://github.com/<your-username>/sere-web.git
   cd sere-web
   ```

2. Install dependencies (Node.js 20+):

   ```bash
   npm install
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

   Then open [http://localhost:3000](http://localhost:3000).

## Before you open a pull request

- **Run the linter**: `npm run lint`. Fix or justify any new warnings — the codebase has some pre-existing ones, but don't add new ones.
- **Check the build**: `npm run build` should succeed.
- **Keep changes focused**: one logical change per pull request.
- **Match the existing style**: Tailwind utility classes in JSX, TypeScript strict types, no `any` unless unavoidable.

## Project layout

| Path | What lives there |
| --- | --- |
| `app/` | Next.js App Router pages, layouts, and route handlers |
| `app/components/` | Shared UI components; `app/components/editor/` holds the cloud workbench |
| `app/lib/` | Server-side data access (GitHub releases, docs, projects) |
| `app/api/` | API routes, e.g. `POST /api/docs/sync` and `POST /api/releases/sync` |
| `content/docs/` | Markdown source for the language documentation |

## Conventions

- **Pages** that fetch GitHub data use `fetch` with Next.js `revalidate` windows; failures must degrade gracefully (render a fallback card, never crash).
- **Components** are default exports, one component per file, in `app/components/`.
- **Styling** is Tailwind 4 with CSS variables defined in `app/globals.css` — use the theme tokens (`bg-card`, `text-muted`, `border-border`, …) rather than hard-coded colors.
- **Commits**: short imperative subject lines, e.g. `Fix releases sync retry logic`.

## Docs changes

The documentation pages under `/docs` are synced from the language repository's `content/docs`. Fix language documentation in the [Sere repo](https://github.com/Sere-Language/sere), not here — but bugs in rendering, highlighting, or navigation are welcome here.

## Reporting issues

Open an issue on this repository with:

- What you did and what you expected to happen
- The page URL and steps to reproduce
- Browser/OS if it's a UI issue, and any console errors

## License

By contributing, you agree that your contributions are licensed under the project's license — see the [Sere language repository](https://github.com/Sere-Language/sere).
