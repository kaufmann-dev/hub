# Hub

A personal startpage served at `hub.kaufmann.dev`. It gives an instant overview of personal
and third-party websites and GitHub projects, with a top filter bar that searches them as you
type, live clocks and current weather for configurable cities, and a password-protected admin
area for editing everything.

| Category     | Tools                                                     |
| ------------ | --------------------------------------------------------- |
| Framework    | SvelteKit, @sveltejs/adapter-node                         |
| UI & Styling | Tailwind CSS, shadcn-svelte, @lucide/svelte, mode-watcher |
| Data         | PostgreSQL, Drizzle ORM                                   |
| Forms        | Superforms, Zod                                           |
| Weather      | Open-Meteo (no API key)                                   |
| Local prod   | podman, podman compose                                    |

## Features

- **Filter bar** (top, sticky) — instantly filters websites + GitHub projects client-side as
  you type. Press `/` to focus it.
- **Clocks & weather** — one card per city with a live clock (its IANA timezone) and current
  weather from Open-Meteo. Cities are editable in the database.
- **Websites** — personal/third-party links with derived favicons and, when configured, an
  imprint link to `legal.kaufmann.dev/imprint?site=<domain>`.
- **GitHub projects** — auto-synced from the configured GitHub account, cached in the DB, with
  per-project overrides (hide, custom description, sort order).
- **Admin** (`/admin`) — gated by a single password; CRUD for websites and cities, project
  overrides, and a "Sync now" button.

## Environment

Copy `.env.example` to `.env` and fill it in:

| Variable               | Purpose                                                               |
| ---------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`         | PostgreSQL connection string                                          |
| `ORIGIN`               | Public origin (required by adapter-node for form POST/CSRF in prod)   |
| `ADMIN_PASSWORD`       | Password for `/admin`                                                 |
| `ADMIN_SESSION_SECRET` | Secret used to sign the admin session cookie (`openssl rand -hex 32`) |
| `GITHUB_USERNAME`      | GitHub account whose public repos are synced (default `kaufmann-dev`) |
| `GITHUB_TOKEN`         | Optional; raises the GitHub API rate limit                            |

## Development

```bash
pnpm install
pnpm db:push      # apply the schema to the dev database
pnpm db:seed      # seed the personal websites + Vienna/New York (idempotent)
pnpm dev
```

GitHub projects populate on first load (background sync) or via "Sync now" in `/admin`.

### Development database (podman)

```bash
podman run --name postgres-sveltekit \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=hub \
  -p 5432:5432 -v postgres-sveltekit-data:/var/lib/postgresql/data \
  -d postgres:18-alpine
```

Set `DATABASE_URL="postgres://postgres:postgres@localhost:5432/hub"`.

### Commands

```bash
pnpm dev          # dev server
pnpm check        # svelte-check + types
pnpm lint         # prettier + eslint
pnpm build        # production build (adapter-node -> build/)
pnpm db:push      # push schema (dev)
pnpm db:generate  # generate SQL migrations (drizzle/)
pnpm db:seed      # seed websites + cities
pnpm db:studio    # Drizzle Studio
```

## Local production (podman compose)

```bash
podman compose up --build
```

This starts PostgreSQL and the app (on `:3000`). The app applies Drizzle migrations on start.
To seed the compose DB (exposed on host port `5433`) once:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5433/hub pnpm db:seed
```

Set `ORIGIN`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, and optionally `GITHUB_TOKEN` in your
environment (or `.env`) before bringing the stack up.

## Coolify Deployment

Deployed via Coolify's **Nixpacks** build pack. Build command, start command, and the Node
version live in `nixpacks.toml` and `package.json`; the settings below must be set in the
Coolify UI.

| Setting        | Value    |
| -------------- | -------- |
| Build Pack     | Nixpacks |
| Base Directory | `/`      |

Migrations run automatically on container start (`scripts/migrate.mjs`), so no pre/post
deployment command is needed. The adapter-node server binds to the `PORT` Coolify injects.

### Environment Variables

Required:

- `DATABASE_URL` — PostgreSQL connection string
- `ORIGIN` — public origin required by adapter-node for form POST/CSRF; set to `https://hub.kaufmann.dev`
- `ADMIN_PASSWORD` — password for `/admin`
- `ADMIN_SESSION_SECRET` — secret signing the admin session cookie (`openssl rand -hex 32`)

Optional:

- `GITHUB_USERNAME` — GitHub account to sync (default `kaufmann-dev`)
- `GITHUB_TOKEN` — raises the GitHub API rate limit; sync works without it
