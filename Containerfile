# syntax=docker/dockerfile:1

# --- Build stage ---
FROM node:24-slim AS builder
WORKDIR /app

# Install pnpm via corepack
RUN corepack enable

# Install dependencies (cache-friendly: lockfile first)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# Build the SvelteKit app (adapter-node -> build/)
COPY . .
ENV DATABASE_URL=postgres://placeholder:5432/placeholder
RUN pnpm build

# Prune to production dependencies only
RUN pnpm prune --prod

# --- Runtime stage ---
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000
# Apply migrations, then start the server.
CMD ["sh", "-c", "node scripts/migrate.mjs && node build"]
