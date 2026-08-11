# Deploying Cairn

Cairn is three moving parts: a static web client, a Node API, and MongoDB. The
web client is a folder of files, the API is a container, and the database is
managed for you. Everything below assumes that split.

- [Before you start](#before-you-start)
- [Render](#render-recommended) — recommended
- [Railway](#railway)
- [Fly.io](#flyio)
- [Comparison](#comparison)
- [Environment variables](#environment-variables)
- [Going live checklist](#going-live-checklist)

## Before you start

### 1. A MongoDB you did not have to build

Render, Railway and Fly do not offer managed MongoDB. Use
[MongoDB Atlas](https://www.mongodb.com/atlas) — the M0 tier is free
indefinitely and enough for this.

1. Create a free M0 cluster.
2. **Database Access** → add a user with a generated password.
3. **Network Access** → allow `0.0.0.0/0`. Platform egress IPs are not static
   on free tiers, so an allowlist is not workable there. The database is still
   protected by credentials and TLS.
4. Copy the connection string and **append the database name**:

   ```
   mongodb+srv://user:pass@cluster.mongodb.net/cairn?retryWrites=true&w=majority
   ```

   Without `/cairn` the driver silently uses a database called `test`. This has
   already bitten this codebase once.

### 2. A signing secret

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Never reuse the development value from `docker-compose.yml`.

### 3. Know the ordering problem

The API needs `CORS_ORIGINS` set to the web client's URL, and the web client
needs `VITE_API_BASE_URL` set to the API's URL. Neither URL exists until its
service is created, so:

1. Deploy the API with a placeholder `CORS_ORIGINS`.
2. Deploy the web client using the API's real URL.
3. Go back and set `CORS_ORIGINS` to the web client's real URL.

Step 3 is the one everyone forgets. Symptom: the site loads, but every request
fails with a CORS error in the console and the network tab shows no
`Access-Control-Allow-Origin` header.

## Render (recommended)

This repository ships a [`render.yaml`](../render.yaml) blueprint, so both
services are created together.

### Blueprint

1. Push to GitHub (already done).
2. Render dashboard → **New** → **Blueprint** → pick the repository.
3. Render reads `render.yaml` and prompts for the `sync: false` values:
   - `MONGODB_URI` — the Atlas string from above
   - `CORS_ORIGINS` — a placeholder for now, e.g. `https://example.com`
   - `VITE_API_BASE_URL` — a placeholder for now
   - `AWS_REGION` / `S3_BUCKET` — leave blank unless using `cairn push`
4. Apply. `JWT_ACCESS_SECRET` is generated automatically and persists.
5. When both services are live, note their URLs and fix the two placeholders:
   - `cairn-api` → `CORS_ORIGINS` = `https://cairn-web.onrender.com`
   - `cairn-web` → `VITE_API_BASE_URL` = `https://cairn-api.onrender.com`
6. Redeploy the web service. Vite inlines `VITE_API_BASE_URL` at **build**
   time, so changing it does nothing until the bundle is rebuilt.

### What Render does with each service

| Service | How it runs |
| --- | --- |
| `cairn-api` | Builds `apps/api/Dockerfile` with the repo root as context. Health-checked on `/readyz`, so a deploy that cannot reach the database is not promoted. |
| `cairn-web` | Runs `npm ci && npm run build:web` and serves `apps/web/dist` from a CDN. No container. |

### Free tier caveat

Free web services sleep after 15 minutes idle and take 30–60 seconds to wake.
The first request after a nap will look broken. The static site does not sleep,
so the symptom is a loaded page whose API calls hang — worth knowing before you
send anyone a link. The paid Starter tier removes this.

## Railway

No blueprint file; configured through the dashboard.

1. **New Project** → **Deploy from GitHub repo**.
2. Add a service for the API:
   - Root directory: `/` (the build needs the whole monorepo)
   - Dockerfile path: `apps/api/Dockerfile`
   - Add the environment variables from the table below
3. Add a second service for the web client:
   - Build command: `npm ci && npm run build:web`
   - Start command: `npx serve apps/web/dist -s -l $PORT`
     (`-s` is what makes client-side routing work)
4. Generate public domains for both, then fix the two cross-referencing URLs as
   described above.

Railway bills by usage against a monthly credit rather than sleeping idle
services, which makes it a better demo target than Render's free tier — the app
is always warm. The trade is that it can cost money once the credit runs out.

## Fly.io

Worth it if you want production to run the exact images you run locally.

```bash
fly launch --dockerfile apps/api/Dockerfile --no-deploy
fly secrets set MONGODB_URI="mongodb+srv://..." JWT_ACCESS_SECRET="..." CORS_ORIGINS="https://cairn-web.fly.dev"
fly deploy
```

Deploy the web client as a second app using `apps/web/Dockerfile`, passing the
API URL as a build argument:

```bash
fly deploy --build-arg VITE_API_BASE_URL=https://cairn-api.fly.dev
```

Set `internal_port = 8080` in the web app's `fly.toml` to match the nginx
config, and `3002` for the API.

## Comparison

| | Render | Railway | Fly.io |
| --- | --- | --- | --- |
| Setup effort | Lowest — blueprint in repo | Low, dashboard-driven | Moderate, CLI-driven |
| Free tier | Yes, sleeps when idle | Usage credit, no sleeping | Allowance, no sleeping |
| Deploys | Push to `main` | Push to `main` | `fly deploy` |
| Runs your Dockerfile | API yes, web static | Yes | Yes, both |
| PR previews | Yes | Yes | Manual |
| Best for | Getting a link to share fastest | A demo that is always warm | Production-realistic parity |

All three need MongoDB Atlas separately.

## Environment variables

### API

| Variable | Required | Notes |
| --- | --- | --- |
| `MONGODB_URI` | **yes** | Must include the database name in the path |
| `JWT_ACCESS_SECRET` | **yes** | Minimum 32 characters; startup fails otherwise |
| `CORS_ORIGINS` | **yes** in production | Comma-separated exact origins. No wildcard — credentials are sent |
| `NODE_ENV` | | `production` sets `Secure` and `SameSite=None` on the refresh cookie |
| `PORT` | | Defaults to 3002; most platforms inject this |
| `ACCESS_TOKEN_TTL` | | Default `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | | Default `7` |
| `LOG_LEVEL` | | Default `info` in production |
| `AWS_REGION`, `S3_BUCKET` | | Only for `cairn push` / `cairn pull` |

Every one of these is validated at startup: a missing or malformed value exits
the process with a readable message rather than failing on the first request.

### Web

| Variable | Required | Notes |
| --- | --- | --- |
| `VITE_API_BASE_URL` | **yes** | Inlined at **build** time — changing it requires a rebuild |

Anything prefixed `VITE_` ships to the browser. Never put a secret there.

## Going live checklist

- [ ] `JWT_ACCESS_SECRET` is freshly generated, not the compose default
- [ ] `MONGODB_URI` ends with `/cairn`, not just the host
- [ ] `NODE_ENV=production`, so the refresh cookie is `Secure`
- [ ] `CORS_ORIGINS` is the exact web origin — `https`, no trailing slash
- [ ] `VITE_API_BASE_URL` is set and the web client was **rebuilt** after
- [ ] Both services are on HTTPS. A `SameSite=None` cookie is rejected over
      plain HTTP, so sign-in silently fails
- [ ] Sign up, sign in, reload the page. Surviving a reload proves the refresh
      cookie round trip works across origins
- [ ] `/readyz` returns `{"status":"ok","database":"connected"}`

### Known production gaps

Both are fine for a demo and would matter under real load:

- **Rate limiting is in-memory.** Correct for one instance, ineffective across
  replicas. Needs a shared store to hold up when scaled out.
- **S3 credentials come from the default AWS provider chain.** On these
  platforms that means environment variables; a role would be better.
