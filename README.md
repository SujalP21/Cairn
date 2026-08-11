# Cairn

A source-code hosting platform with version control implemented from scratch.

A cairn is a stack of stones that marks a trail — each stone a step, the stack the history of
the path. That is roughly what this project does with your code: `cairn commit` adds a stone,
and the pile is your project's history.

Sign up, create public or private repositories, browse them, and file and triage issues —
with a `cairn` CLI that snapshots your files and syncs them to S3. See
[Known gaps](#known-gaps) for what is not built yet.

## Repository layout

Cairn is an npm workspaces monorepo:

```
cairn/
├── package.json          workspace root
├── apps/
│   ├── api/              Express REST API + the Cairn version control CLI
│   └── web/              React 18 + Vite client
└── packages/
    └── shared/           Zod schemas shared by both sides
```

| Workspace | Package | Stack |
| --- | --- | --- |
| `apps/api` | `@cairn/api` | TypeScript, Express 4, Mongoose, Pino, AWS S3, yargs |
| `apps/web` | `@cairn/web` | React 18, Vite 5, React Router 6, axios, socket.io-client |
| `packages/shared` | `@cairn/shared` | TypeScript, Zod |

`packages/shared` holds the validation schemas. Both the API's request middleware and the web
client's forms import the same schema objects, so the two cannot drift apart about what a valid
username or repository name is.

## Getting started

Requires Node.js 20+ and a MongoDB instance.

```bash
npm install
```

One install at the root covers all three workspaces and builds `@cairn/shared`, which the
other two import.

Then copy the environment templates and fill them in — every variable is documented there,
and the API validates all of them at startup and refuses to boot with a readable error if
anything is missing or malformed:

```bash
cp apps/api/.env.example apps/api/.env && cp apps/web/.env.example apps/web/.env
```

At minimum set `MONGODB_URI` and generate a `JWT_ACCESS_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Then, in separate terminals:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

### Workspace scripts

| Command | What it does |
| --- | --- |
| `npm run build` | Builds shared → api → web, in dependency order |
| `npm run typecheck` | Type-checks every workspace |
| `npm run lint` | ESLint across every workspace |
| `npm run format` | Prettier write; `format:check` to verify only |
| `npm test` | Runs each workspace's tests |

### Testing

90 tests run on every push and pull request via [GitHub Actions](.github/workflows/ci.yml),
alongside formatting, lint, typecheck and build.

| Suite | Covers |
| --- | --- |
| `apps/api/tests/auth.test.ts` | Signup, login, refresh rotation, reuse detection, logout, CSRF guard |
| `apps/api/tests/authorization.test.ts` | Every row of the route auth table: ownership, visibility, issue permissions |
| `apps/api/tests/validation.test.ts` | Zod rules, key stripping, normalisation, error envelope |
| `apps/api/tests/rateLimit.test.ts` | Signup and login throttling |
| `apps/api/tests/vcs.test.ts` | `init` / `add` / `commit` / `revert` against a temp directory |
| `apps/web/src/**/*.test.{js,jsx}` | API client refresh logic, auth context, login flow, error decoding |

API integration tests run against a real MongoDB via `mongodb-memory-server` — no Docker and
no local mongod required. The first run downloads a ~100 MB binary and caches it.

## The web client

| Route | Page |
| --- | --- |
| `/` | Dashboard — your repositories, search, and repositories to explore |
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
cairn init                    # create .cairn/ in the current directory
cairn add <file>              # copy a file into the staging area
cairn commit "<message>"      # snapshot staged files under a new commit id
cairn push                    # upload commits to S3
cairn pull                    # download commits from S3
cairn revert <commitID>       # restore a commit's files into the working directory
```

The CLI does not need a database or any server configuration — only `push` and `pull` require
AWS credentials. During development run it with `npm run cli --workspace @cairn/api -- <command>`.

The current implementation snapshots files by copying them. There is no content hashing, no
parent-pointer commit graph, and no branching — see [Roadmap](#roadmap).

## Security model

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
file in `apps/api/src/routes/`.

## Known gaps

- Rate limiting is in-memory, so it is per-process and will not hold across multiple replicas.
- Issues can only be edited by the repository owner, not by the person who opened them.
- The contribution heat map on the profile renders generated sample data; the API has no
  per-day contribution endpoint yet.
- No Docker or deployment configuration.
- The version control layer copies files rather than hashing content: no commit graph, no
  branching, no diffs.
