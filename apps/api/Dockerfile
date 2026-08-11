# Build context is the repository root, not apps/api — the API depends on the
# @cairn/shared workspace, so the whole monorepo has to be visible.
#
#   docker build -f apps/api/Dockerfile -t cairn-api .

# ---------------------------------------------------------------------------
# Dependencies — cached until a manifest or the lockfile changes
# ---------------------------------------------------------------------------
FROM node:20-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# --ignore-scripts is deliberate: the root postinstall compiles @cairn/shared,
# whose sources are not in the context yet, and mongodb-memory-server would
# download a ~100MB mongod binary that a production image has no use for.
RUN npm ci --ignore-scripts

# ---------------------------------------------------------------------------
# Build — compile shared, then the API
# ---------------------------------------------------------------------------
FROM deps AS build
WORKDIR /app

COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN npm run build:shared && npm run build:api

# ---------------------------------------------------------------------------
# Runtime — production dependencies and compiled output only
# ---------------------------------------------------------------------------
FROM node:20-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci --omit=dev --ignore-scripts \
  && npm cache clean --force

COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist

# node:20-slim ships an unprivileged `node` user; running as root in a container
# is one lost sandbox away from being a real problem.
USER node

EXPOSE 3002

# The server already handles SIGTERM for graceful shutdown, so run it as PID 1
# in exec form rather than wrapping it in a shell that would swallow signals.
CMD ["node", "apps/api/dist/index.js", "start"]
