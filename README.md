# Hub

A personal startpage served at `hub.kaufmann.dev`. It gives an instant overview of personal
and third-party websites and GitHub projects, with a top filter bar that searches them as you
type, live clocks and current weather for configurable cities, and a password-protected admin
area for editing everything. It also shows stock-market status cards for curated exchanges.

| Category     | Tools                                                     |
| ------------ | --------------------------------------------------------- |
| Framework    | SvelteKit, @sveltejs/adapter-node                         |
| UI & Styling | Tailwind CSS, shadcn-svelte, @lucide/svelte, mode-watcher |
| Data         | PostgreSQL, Drizzle ORM                                   |
| Forms        | Superforms, Zod                                           |
| Weather      | Open-Meteo (no API key)                                   |
| Markets      | Alpha Vantage market status API                           |
| Local prod   | podman, podman compose                                    |

## Features

- **Filter bar** (top, sticky) — instantly filters websites + GitHub projects client-side as
  you type. Press `/` to focus it.
- **Clocks & weather** — one card per city with a live clock (its IANA timezone) and current
  weather from Open-Meteo. Cities are editable in the database.
- **Market status** — curated equity markets with Alpha Vantage-backed open/closed status,
  locally cached to stay within the free API tier.
- **Websites** — personal/third-party links with automatically discovered, locally cached,
  theme-aware favicons.
- **GitHub projects** — auto-synced from the configured GitHub account, cached in the DB, with
  per-project overrides (hide, custom description) and admin drag ordering.
- **Admin** (`/admin`) — gated by a single password; CRUD for websites, cities, and markets,
  project overrides, market import from Alpha Vantage, bulk icon refresh, and a "Sync now"
  button.

## Environment

Copy `.env.example` to `.env` and fill it in:

| Variable                | Purpose                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`          | PostgreSQL connection string                                          |
| `ORIGIN`                | Public origin (required by adapter-node for form POST/CSRF in prod)   |
| `ADMIN_PASSWORD`        | Password for `/admin`                                                 |
| `ADMIN_SESSION_SECRET`  | Secret used to sign the admin session cookie (`openssl rand -hex 32`) |
| `GITHUB_USERNAME`       | GitHub account whose public repos are synced (default `kaufmann-dev`) |
| `GITHUB_TOKEN`          | Optional; enables private owned repos when the token has access       |
| `ALPHA_VANTAGE_API_KEY` | Optional; enables stock-market open/closed status cards               |

## Development

```bash
pnpm install
pnpm db:push      # apply the schema to the dev database
pnpm db:seed      # seed personal websites, city clocks, and markets (idempotent)
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
pnpm db:seed      # seed websites, cities, and markets
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
- `GITHUB_TOKEN` — enables private owned repos and raises the GitHub API rate limit when
  the token has access to those repositories; sync falls back to public repos without it
- `ALPHA_VANTAGE_API_KEY` — enables stock-market status cards; responses are cached
  server-side and never fetched from the browser
