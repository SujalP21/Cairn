# Architecture

## The shape of it

```
                    ┌──────────────────────────────┐
   browser ────────▶│  @cairn/web                  │
                    │  React 18 · Vite · nginx     │
                    └───────────┬──────────────────┘
                                │  REST + WebSocket
                                │  Bearer access token in memory
                                │  refresh token in httpOnly cookie
                                ▼
                    ┌──────────────────────────────┐        ┌─────────────┐
                    │  @cairn/api                  │───────▶│  MongoDB    │
                    │  Express 4 · TypeScript      │        │  (Atlas)    │
                    │  Socket.IO · Pino            │        └─────────────┘
                    └───────────┬──────────────────┘
                                │
   terminal ──▶ cairn CLI ──────┤                           ┌─────────────┐
   (same package as the API)    └──────────────────────────▶│  AWS S3     │
                                                            │  commits/   │
                                                            └─────────────┘

                    ┌──────────────────────────────┐
                    │  @cairn/shared               │
                    │  Zod schemas — imported by   │
                    │  BOTH the API and the client │
                    └──────────────────────────────┘
```

`@cairn/shared` is the load-bearing idea. Validation rules live in exactly one
place and are imported by the Express middleware and the React forms alike, so
the client cannot drift from the server about what a valid username is.

## Request lifecycle

A request passes through the same ordered pipeline every time:

```
pino-http        assign request id, start timing
  ↓
cors             reject origins outside the allowlist
  ↓
express.json     parse body, 1 MB cap
  ↓
cookie-parser    make the refresh cookie readable
  ↓
apiLimiter       broad rate limit
  ↓
route middleware
  ├─ rate limiter      tighter, on auth routes
  ├─ validate()        Zod on body and params; unknown keys stripped
  ├─ authenticate      verify access token → req.user
  ├─ requireRepoAccess load the target, check ownership/visibility → req.repository
  └─ controller        the handler, wrapped in asyncHandler
  ↓
errorHandler     the single place an error becomes a response
```

Two consequences worth knowing:

**Validation runs before authorization.** A malformed ObjectId gets 400 rather
than reaching a database query.

**Controllers never load their own targets.** `requireRepoAccess` has already
fetched and access-checked the repository and attached it to the request, so a
handler physically cannot forget the check.

## Error handling

Handlers throw typed errors (`NotFoundError`, `ForbiddenError`, `ConflictError`)
and one middleware turns them into responses. `asyncHandler` forwards rejected
promises — Express 4 does not catch them, and an unhandled one hangs the request
until it times out.

Anything that is not an `AppError` is treated as a bug: logged in full, returned
as a bare 500 with no internal detail. Mongoose's own failures (`ValidationError`,
`CastError`, duplicate key) are translated into the same envelope.

## Data model

```
User ──1:N──▶ Repository ──1:N──▶ Issue
  │                                 │
  └──────────── author ─────────────┘

RefreshToken ──N:1──▶ User     (sha256 digest, TTL-indexed)
```

| Collection | Notes |
| --- | --- |
| `users` | `password` is `select: false` — excluded unless explicitly requested |
| `repositories` | `visibility: false` means private; `content` is a list of filenames |
| `issues` | Denormalised both ways: holds `repository`, and the repo holds `issues` |
| `refreshtokens` | Stores digests only; MongoDB TTL index reaps expired rows |

The issue link is maintained in both directions, so `.populate("issues")`
resolves. Creating an issue pushes its id onto the repository; deleting one
`$pull`s it.

## Authentication

```
  sign in
     │
     ├─▶ access token   15 min   in memory       Bearer header
     └─▶ refresh token   7 days  httpOnly cookie  sha256 digest stored
                │
          on 401 TOKEN_EXPIRED
                │
                ▼
         POST /refresh ──▶ new access token + rotated refresh token
                              old digest marked revoked
                │
        if a revoked digest is presented again
                ▼
         every session for that user is revoked
```

The access token is deliberately not persisted. It is lost on reload, and the
client trades the refresh cookie for a new one at startup — which is why a page
reload keeps you signed in without any token being readable by JavaScript.

Concurrent 401s share a single in-flight refresh. Without that, two parallel
requests would each rotate, and the loser's token would look like a replay and
revoke the session.

## Version control

The `cairn` CLI ships in the same package as the API but shares no runtime with
it — no database, no config beyond AWS credentials.

```
.cairn/
├── HEAD                 → "ref: refs/heads/main", or a raw commit id when detached
├── index                staged paths → blob ids, as JSON
├── config.json          bucket name
├── refs/heads/<name>    → a commit id
└── objects/<ab>/<cdef…> immutable, named by SHA-256 of their own contents
```

Three object types, exactly as in git:

| Type | Contains |
| --- | --- |
| **blob** | A file's bytes |
| **tree** | A directory: sorted `<type> <hash> <name>` lines pointing at blobs and subtrees |
| **commit** | A tree id, zero or more parent ids, author, timestamp, message |

Each object is hashed over `<type> <length>\0<content>`. The type is inside the
digest deliberately — without it a blob and a tree with identical bytes would
collide.

### Why content addressing matters here

An object's name is a function of its content, so identical content cannot be
stored twice. Committing a file that has not changed writes nothing; a commit
records only what actually differs. Measured over ten commits of a 659 KB
unchanging file, the object store holds **694 KB** where a copy-per-commit
design would hold roughly **6.6 MB**.

Tree entries are sorted before serialisation for the same reason: unsorted
entries would give the same directory two different hashes depending on
insertion order, and the deduplication would silently stop working.

### Refs are one line long

A branch is a file containing a commit id. HEAD is a file containing either
`ref: refs/heads/<name>` or a raw commit id. Committing moves whatever HEAD
names. That is the whole mechanism, and it is why creating a branch is instant
no matter how large the repository is.

### The three-way comparison

`status` and `diff` both rest on the same relationship:

```
HEAD commit  ──▶  index (staged)  ──▶  working tree
             staged            not staged
```

`diff` compares content with a longest-common-subsequence line diff, grouped
into unified hunks with surrounding context.

### What is deliberately missing

`merge` fast-forwards only. When histories have diverged it refuses and says so.
A three-way content merge is a substantial algorithm whose subtle failures
corrupt files silently — worse than declining to try. There is also no `clone`,
no packfiles, and no rebase.

## Frontend

```
main.jsx
 └─ AuthProvider          session bootstrap, current user
     └─ ToastProvider     notification surface
         └─ Router
             └─ ProjectRoutes   redirects, "/" is landing or dashboard
```

Data fetching goes through `useQuery`, which owns loading, error and refetch for
every screen, with a request-sequence guard so a slow earlier response cannot
overwrite a newer one. Forms go through `useForm`, which validates with the
shared Zod schema and merges server-side field errors back onto the field they
belong to.

## Testing

| Layer | Approach |
| --- | --- |
| API integration | Supertest against the real Express app, real MongoDB via `mongodb-memory-server` |
| VCS | Real filesystem operations in a temp directory |
| Frontend | Testing Library, queried by role and label rather than class |

`createApp()` builds the Express app without binding a port, which is what lets
integration tests drive it directly.

Coverage is deliberately weighted toward security: authentication, the full
authorization matrix, and validation. Plain getters are not covered.

## Deliberate decisions

| Decision | Why |
| --- | --- |
| Access token in memory, not `localStorage` | An XSS payload can read storage; it cannot read a closure |
| Opaque refresh tokens, not JWTs | Revocable, and a database leak yields nothing usable |
| Private repos 404 rather than 403 | A 403 confirms the resource exists |
| Ownership from the token, never the body | Removes a whole class of forgery |
| Zod schemas in a shared package | Client and server cannot disagree about validity |
| `select: false` on the password | A forgotten projection cannot leak it |
| TypeScript on the API only | The data-integrity bugs were all server-side |
| Dual CJS/ESM build for shared | The API is CommonJS, the bundler needs ESM |
