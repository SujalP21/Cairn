# Cairn

A source-code hosting platform with version control implemented from scratch.

A cairn is a stack of stones that marks a trail — each stone a step, the stack the history of
the path. That is roughly what this project does with your code: `cairn commit` adds a stone,
and the pile is your project's history.

Sign up, create public or private repositories, browse them, and file and triage issues —
with a `cairn` CLI that snapshots your files and syncs them to S3. See
[Known gaps](#known-gaps) for what is not built yet.

**Docs:** [Architecture](docs/ARCHITECTURE.md) · [API reference](docs/API.md) · [Deployment](docs/DEPLOYMENT.md)

## Quick start

The fastest path needs Docker and nothing else — no Node, no MongoDB, no configuration:

```bash
docker compose up --build
```

Then open **http://localhost:8080**. The API is on `:3002` and MongoDB on `:27018`.

### Running it directly

Requires Node.js 20+ and a MongoDB instance.

```bash
npm install
```

```bash
npm run setup
```

`setup` creates `apps/api/.env` and `apps/web/.env` from the committed templates and generates
a real signing secret. It never overwrites an existing file, so it is safe to re-run. Edit
`MONGODB_URI` if your database is not on `localhost`.

Then, in separate terminals:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

## Repository layout

Cairn is an npm workspaces monorepo:

```
cairn/
├── package.json          workspace root
├── docker-compose.yml    database + api + web
├── apps/
│   ├── api/              Express REST API + the Cairn version control CLI
│   └── web/              React 18 + Vite client
├── packages/
│   └── shared/           Zod schemas shared by both sides
└── docs/                 architecture, API reference, deployment
```

| Workspace | Package | Stack |
| --- | --- | --- |
| `apps/api` | `@cairn/api` | TypeScript, Express 4, Mongoose, Pino, AWS S3, yargs |
| `apps/web` | `@cairn/web` | React 18, Vite 5, React Router 6, axios, socket.io-client |
| `packages/shared` | `@cairn/shared` | TypeScript, Zod |

`packages/shared` holds the validation schemas. Both the API's request middleware and the web
client's forms import the same schema objects, so the two cannot drift apart about what a valid
username or repository name is.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run setup` | Create `.env` files with a generated secret |
| `npm run dev:api` / `dev:web` | Development servers with reload |
| `npm run build` | Build shared → api → web, in dependency order |
| `npm run typecheck` | Type-check every workspace |
| `npm run lint` | ESLint across every workspace |
| `npm run format` | Prettier write; `format:check` to verify only |
| `npm test` | Run every workspace's tests |

## The web client

| Route | Page |
| --- | --- |
| `/` | Landing page when signed out, dashboard when signed in |
| `/new` | Create a repository, with public/private visibility |
| `/repo/:id` | Repository detail — committed files, issue list, open an issue |
| `/profile` | Your profile, repositories and contribution activity |
| `/auth`, `/signup` | Sign in and registration |

Forms validate with the same Zod schemas the API enforces, so a rule is written once. Field
errors the server alone can determine — a name already being taken — are merged back onto the
relevant field rather than shown as a generic alert. Every request renders explicit loading,
empty and error states, and errors offer a retry.

Repository owners receive a live toast when somebody opens an issue on one of their
repositories, over an authenticated socket connection.

## The version control CLI

`apps/api` is both the API server and a standalone CLI. Repository data lives in a `.cairn/`
directory, analogous to `.git/`.

```bash
cairn init                    # create a repository in the current directory
cairn add <path>              # stage a file or directory
cairn commit "<message>"      # record the staged files as a commit
cairn status                  # staged, unstaged and untracked changes
cairn log                     # history, newest first
cairn diff [--staged]         # what changed
cairn branch [name] [-d]      # list, create or delete branches
cairn checkout <target>       # switch to a branch or commit
cairn merge <branch>          # fast-forward the current branch
cairn revert <commitID>       # restore a commit's files, leaving HEAD alone
cairn push / cairn pull       # sync objects and refs with S3
```

The CLI needs no database and no server configuration — only `push` and `pull` require AWS
credentials. During development run it with
`npm run cli --workspace @cairn/api -- <command>`.

### How it stores things

Content-addressable, the same model git uses. Every file, directory and commit is an
immutable object named by the SHA-256 of its contents:

```
.cairn/
├── HEAD                    → ref: refs/heads/main
├── index                   staged paths → blob ids
├── refs/heads/main         → a commit id. That is all a branch is
└── objects/
    └── ab/cdef…            blobs (file content)
                            trees (directories)
                            commits (tree + parent + message)
```

Because an object's name *is* its content hash, identical content is stored exactly once.
Committing an unchanged file costs nothing, and a commit records only what actually changed.
Ten commits of a 659 KB file that never changes, alongside one small file edited each time:

| | Storage |
| --- | --- |
| A full copy per commit | ~6596 KB |
| Cairn's object store | **694 KB** |

Commits carry parent pointers, so history is a real graph rather than a directory listing —
that is what makes `log` and branching possible.

**Merging is fast-forward only.** When histories have genuinely diverged, `merge` refuses and
says so. A three-way content merge is a substantial algorithm, and getting it subtly wrong
corrupts files, which is worse than declining.

## Security

| Area | Approach |
| --- | --- |
| Access tokens | 15 minute JWT, held in memory by the client, never in `localStorage` |
| Refresh tokens | Opaque 384-bit random string in an httpOnly cookie; only its SHA-256 digest is stored |
| Rotation | Every refresh issues a new token; replaying a spent one revokes all of that user's sessions |
| CSRF | `/refresh` and `/logout` require a non-standard header, forcing a CORS preflight |
| Authorization | Ownership for writes; private repositories 404 rather than 403 for non-owners |
| Validation | Zod on body and params; unknown keys are stripped before reaching the database |
| Rate limiting | 5 signups/hour, 10 auth attempts/15min, 300 requests/15min overall |
| Secrets | Validated at startup; the server exits rather than run misconfigured |

Every route's auth and authorization policy is documented in a table at the top of its router
file in `apps/api/src/routes/`, and mirrored in the [API reference](docs/API.md).

## Testing

97 tests run on every push and pull request via [GitHub Actions](.github/workflows/ci.yml),
alongside formatting, lint, typecheck and build.

| Suite | Covers |
| --- | --- |
| `apps/api/tests/auth.test.ts` | Signup, login, refresh rotation, reuse detection, logout, CSRF guard |
| `apps/api/tests/authorization.test.ts` | Every row of the route auth table: ownership, visibility, issue permissions |
| `apps/api/tests/validation.test.ts` | Zod rules, key stripping, normalisation, error envelope |
| `apps/api/tests/rateLimit.test.ts` | Signup and login throttling |
| `apps/api/tests/vcs.test.ts` | `init` / `add` / `commit` / `revert` against a temp directory |
| `apps/web/src/**/*.test.{js,jsx}` | API client refresh logic, auth context, login flow, form validation |

API integration tests run against a real MongoDB via `mongodb-memory-server` — no Docker and
no local mongod required. The first run downloads a ~100 MB binary and caches it.

## Deploying

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Render, Railway and Fly.io walkthroughs with
tradeoffs. A [`render.yaml`](render.yaml) blueprint is included, so Render can create both
services from this repository directly. MongoDB Atlas covers the database on all three.

## Known gaps

- Rate limiting is in-memory, so it is per-process and will not hold across multiple replicas.
- Issues can only be edited by the repository owner, not by the person who opened them.
- The contribution heat map on the profile renders generated sample data; the API has no
  per-day contribution endpoint yet.
- The web client has no file upload, and does not yet display commit history — the version
  control layer is CLI-only for now.
- `merge` handles fast-forwards only; divergent histories need a three-way merge that is not
  implemented.
- There is no `clone`: `pull` fetches objects into an existing repository.
