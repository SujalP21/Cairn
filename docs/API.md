# Cairn API

Base URL is whatever `PORT` the server binds — `http://localhost:3002` in
development.

## Authentication

Two tokens, with different jobs.

**Access token** — a 15-minute JWT sent as `Authorization: Bearer <token>`.
The client keeps it in memory only, never in `localStorage`, so an XSS payload
cannot read it from storage.

**Refresh token** — an opaque 384-bit random string in an httpOnly cookie
(`cairn_refresh`). Only its SHA-256 digest is stored server-side, so a database
leak yields no usable sessions. Every call to `/refresh` rotates it.

Replaying an already-spent refresh token is treated as theft: **every session
for that user is revoked**, not just the request rejected.

`/refresh` and `/logout` authenticate with the cookie alone, so both require an
`X-Cairn-Client: web` header. Being non-standard, it forces a CORS preflight
that untrusted origins cannot pass — without it an attacker's page could force
a rotation and log the victim out everywhere.

```
POST /signup ──▶ { accessToken, userId } + Set-Cookie: cairn_refresh
                 access token expires after 15m
POST /refresh ─▶ { accessToken, userId } + a new cookie, old one dead
POST /logout ──▶ cookie revoked server-side and cleared
```

## Error format

Every failure uses one shape:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Validation failed",
    "details": [{ "field": "body.email", "message": "must be a valid email address" }]
  },
  "requestId": "ea47d5a6-0f15-49df-868c-f981f7d5e809"
}
```

`details` appears only for validation failures. `requestId` matches the
`x-request-id` response header and the server log line, so a user-reported
failure is greppable.

| Code | Status | Meaning |
| --- | --- | --- |
| `VALIDATION_FAILED` | 400 | Body or path parameters rejected |
| `INVALID_ID` | 400 | Malformed ObjectId |
| `UNAUTHORIZED` | 401 | Missing or invalid access token |
| `TOKEN_EXPIRED` | 401 | Access token expired — refresh and retry |
| `FORBIDDEN` | 403 | Authenticated but not allowed |
| `NOT_FOUND` | 404 | Does not exist, **or** is private and not yours |
| `CONFLICT` | 409 | Unique constraint, e.g. repository name taken |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected — details are logged, never returned |

## Authorization model

- **Writes** require ownership. Only a repository's owner may update, delete or
  toggle it, or edit and delete its issues.
- **Private repositories return 404, not 403**, to non-owners. A 403 would
  confirm the repository exists.
- **Any signed-in user may open an issue** on a repository they can read.
- **Ownership is taken from the token**, never the request body. Posting
  `owner` to `/repo/create` has no effect.

## Rate limits

| Scope | Limit |
| --- | --- |
| `POST /signup` | 5 per hour |
| `POST /login`, `POST /refresh` | 10 per 15 min; successful logins do not count |
| Everything else | 300 per 15 min |

## Endpoints

Auth column: **required** rejects anonymous callers, *optional* permits them but
uses identity to decide visibility.

### Users

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `POST` | `/signup` | public | `{ username, email, password }` → `{ accessToken, userId }` |
| `POST` | `/login` | public | `{ email, password }` → `{ accessToken, userId }` |
| `POST` | `/refresh` | cookie | Requires `X-Cairn-Client: web` |
| `POST` | `/logout` | cookie | Requires `X-Cairn-Client: web` |
| `GET` | `/allUsers` | **required** | Returns `_id`, `username`, `createdAt` only |
| `GET` | `/userProfile/:id` | *optional* | Email disclosed only to the account holder |
| `PUT` | `/updateProfile/:id` | **required** | Self only. `{ email?, password? }` |
| `DELETE` | `/deleteProfile/:id` | **required** | Self only |

Password digests are never returned by any endpoint.

### Repositories

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `POST` | `/repo/create` | **required** | `{ name, description?, visibility? }`. Owner from token |
| `GET` | `/repo/all` | *optional* | Public repositories, plus your own private ones |
| `GET` | `/repo/:id` | *optional* | Private → 404 for non-owners |
| `GET` | `/repo/name/:name` | *optional* | Visibility-filtered lookup |
| `GET` | `/repo/user/:userID` | *optional* | All if it is you, public only otherwise |
| `PUT` | `/repo/update/:id` | **required** | Owner only. `content` appends a file entry |
| `PATCH` | `/repo/toggle/:id` | **required** | Owner only. Flips visibility |
| `DELETE` | `/repo/delete/:id` | **required** | Owner only |

`visibility` is a boolean: `true` public, `false` private. Defaults to `true`.

### Issues

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `POST` | `/issue/create/:repoId` | **required** | Repo must be readable. `{ title, description }` |
| `GET` | `/issue/all/:repoId` | *optional* | Repo must be readable |
| `GET` | `/issue/:id` | *optional* | Parent repo must be readable |
| `PUT` | `/issue/update/:id` | **required** | Parent repo owner only. Partial updates supported |
| `DELETE` | `/issue/delete/:id` | **required** | Parent repo owner only |

`status` is `open` or `closed`.

### Operations

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `GET` | `/healthz` | public | Liveness — process is up |
| `GET` | `/readyz` | public | Readiness — 503 when the database is disconnected |

Load balancers should gate on `/readyz`.

## Real-time

Socket.IO on the same origin. The handshake carries the access token:

```js
io(API_BASE_URL, { auth: { token: accessToken }, withCredentials: true });
```

Room membership is derived from the verified token — a client cannot request a
room, so it can never subscribe to another user's events.

| Event | Sent to | Payload |
| --- | --- | --- |
| `issue:created` | Repository owner | `{ issueId, repositoryId, repositoryName, title }` |

Not emitted when the owner opens the issue themselves.

## Validation rules

Defined once in `packages/shared` and imported by both the API and the web
client, so the two cannot disagree.

| Field | Rule |
| --- | --- |
| `username` | 3–39 chars, alphanumerics and single hyphens, no leading or trailing hyphen |
| `email` | Valid address; trimmed and lowercased before validation |
| `password` | 8–200 characters |
| `name` (repo) | 1–100 chars, letters, numbers, dots, underscores, hyphens |
| `description` | Up to 350 chars (repo), 10,000 (issue) |
| `title` (issue) | 1–200 characters |

Unknown keys are stripped before anything reaches the database — posting
`{"isAdmin": true}` to `/signup` does nothing.
