# QuickNotes API Design

This is the REST API the backend team should build for QuickNotes. It is **not** the JSONPlaceholder practice API used by the front end in this repository.

- **Base URL:** `https://api.quicknotes.com/v1`
- **Format:** every request and response body is JSON, with the header `Content-Type: application/json`.
- **Authentication:** every endpoint except login needs the header `Authorization: Bearer <token>`. The server finds the user from the token, so a user can only see and change their own notes.
- **Naming:** resources are plural nouns (`/notes`, `/tags`) and the HTTP method says what to do.

## Endpoints

| # | Method | Path | Description | Success status |
|---|--------|------|-------------|----------------|
| 1 | POST | `/auth/login` | Log in with email and password and receive a token | 200 OK |
| 2 | GET | `/notes` | List the logged-in user's notes (supports query parameters) | 200 OK |
| 3 | GET | `/notes/{id}` | Get one note | 200 OK |
| 4 | POST | `/notes` | Create a note | 201 Created |
| 5 | PATCH | `/notes/{id}` | Update some fields of a note | 200 OK |
| 6 | DELETE | `/notes/{id}` | Delete a note | 204 No Content |
| 7 | GET | `/tags` | List all tags | 200 OK |
| 8 | POST | `/notes/{id}/tags` | Attach a tag to a note | 201 Created |

### Query parameters for `GET /notes`

- `category`: filter by `personal`, `work` or `study`.
- `search`: only notes whose text contains this word, ignoring case.
- `tag`: only notes with this tag name.
- `page` and `limit`: pagination, for example `page=2&limit=20`.

Example: `GET /notes?category=work&search=report&limit=20`

## Examples

### Create a note: `POST /notes`

Request body:

```json
{
  "text": "Finish the system design project",
  "category": "study"
}
```

Response: `201 Created`

```json
{
  "id": 42,
  "text": "Finish the system design project",
  "category": "study",
  "tags": [],
  "createdAt": "2026-09-22T09:15:00Z"
}
```

### List notes: `GET /notes`

Response: `200 OK`

```json
{
  "notes": [
    {
      "id": 42,
      "text": "Finish the system design project",
      "category": "study",
      "tags": ["urgent"],
      "createdAt": "2026-09-22T09:15:00Z"
    },
    {
      "id": 41,
      "text": "Buy milk",
      "category": "personal",
      "tags": [],
      "createdAt": "2026-09-21T18:30:00Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 2
}
```

### Update a note: `PATCH /notes/42`

Request body (only the fields that change):

```json
{
  "text": "Finish and present the system design project"
}
```

Response: `200 OK` with the full updated note.

### Log in: `POST /auth/login`

Request body:

```json
{
  "email": "amina@example.com",
  "password": "correct-horse-battery"
}
```

Response: `200 OK`

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600
}
```

## Error codes

Every error uses the same body shape:

```json
{
  "error": {
    "code": 400,
    "message": "Text must be between 1 and 200 characters."
  }
}
```

### 400 Bad Request

The request is invalid, so the server rejects it before doing any work.

- **When:** `POST /notes` with an empty `text`, text over 200 characters, or a `category` that is not `personal`, `work` or `study`. Also a body that is not valid JSON.
- **Example body:** `{ "error": { "code": 400, "message": "Text must be between 1 and 200 characters." } }`

### 401 Unauthorized

The user is not authenticated: the token is missing, expired or invalid, or the login password is wrong.

- **When:** `GET /notes` without an `Authorization` header, or `POST /auth/login` with the wrong password.
- **Example body:** `{ "error": { "code": 401, "message": "Missing or invalid token. Please log in." } }`

### 403 Forbidden

The user is logged in but not allowed to do this.

- **When:** `DELETE /notes/7` where note 7 belongs to another user.
- **Example body:** `{ "error": { "code": 403, "message": "You do not have permission to change this note." } }`

### 404 Not Found

The note, tag or URL does not exist.

- **When:** `GET /notes/9999` when no note has id 9999, or `DELETE /notes/42` after it was already deleted.
- **Example body:** `{ "error": { "code": 404, "message": "Note 9999 was not found." } }`

### 500 Internal Server Error

Something broke on the server, and it is not the client's fault.

- **When:** the database is unreachable or the server code has a bug.
- **Example body:** `{ "error": { "code": 500, "message": "Something went wrong on our side. Please try again later." } }`

### Also used

- **429 Too Many Requests:** the user sent too many requests too quickly (rate limiting).
