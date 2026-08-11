# Build context is the repository root — the client imports the @cairn/shared
# workspace for its validation schemas.
#
#   docker build -f apps/web/Dockerfile \
#     --build-arg VITE_API_BASE_URL=https://api.example.com -t cairn-web .

# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------
FROM node:20-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci --ignore-scripts

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
FROM deps AS build
WORKDIR /app

# Vite inlines env vars at build time, so this is baked into the bundle rather
# than read at runtime. Pointing the image at a different API means rebuilding.
ARG VITE_API_BASE_URL=http://localhost:3002
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN npm run build:shared && npm run build:web

# ---------------------------------------------------------------------------
# Runtime — static files behind nginx
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/security-headers.inc /etc/nginx/conf.d/security-headers.inc
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

# Port 8080 rather than 80 so nginx does not need to bind a privileged port.
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
