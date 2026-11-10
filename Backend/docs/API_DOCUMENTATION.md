# SkillMate API Documentation

Version 2.0.0 · Node.js + Express 5 · JSON-file database

This document covers every REST endpoint, the JSON storage format, how to run
the project and how the existing HTML pages talk to the API.

---

## 1. Quick start

```bash
# from the repository root
cd Backend
npm install

# (optional) seed the demo students / projects / requests
npm run seed

# start the API + the existing frontend on http://localhost:3000
npm start
```

Open <http://localhost:3000/Login.html>.

Demo accounts created by `npm run seed` (password for all of them:
`skillmate123`):

| Email | Name | Course |
|---|---|---|
| aarav@example.com | Aarav Sharma | B.Tech, 2nd Year |
| riya@example.com | Riya Kapoor | B.Tech, 2nd Year |
| mehak@example.com | Mehak Verma | B.Des, 2nd Year |
| kabir@example.com | Kabir Malhotra | B.Tech, 1st Year |
| sana@example.com | Sana Ali | B.Tech, 2nd Year |
| dev@example.com | Dev Mehta | B.Tech, 1st Year |

> These accounts exist for demonstration and marking only. Delete
> `Backend/Data/*.json` (or run `npm run seed -- --reset`) before using the
> project with real students.

### npm scripts

| Command | What it does |
|---|---|
| `npm start` | Starts `app.js` — full API + static frontend on port 3000 |
| `npm run dev` | Same, with `node --watch` auto-restart |
| `npm run start:legacy` | Starts the original Part-1 `server.js` (auth endpoints only) |
| `npm run seed` | Seeds demo data, backing up the previous JSON files |
| `npm test` | Runs the automated API + database test suite (Node test runner) |

### Environment variables

Copy `.env.example` to `.env` (the server reads real environment variables —
there is no dotenv dependency, so export them or use your shell/IDE runner).

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | `production` hides stack traces and forbids a missing `JWT_SECRET` |
| `SKILLMATE_DATA_DIR` | `Backend/Data` | Folder holding the seven JSON files |
| `JWT_SECRET` | dev fallback | HMAC secret for access tokens. **Required in production.** |
| `JWT_EXPIRES_IN` | `12h` | Token lifetime |
| `BCRYPT_ROUNDS` | `10` | bcrypt cost factor |
| `AUTH_RATE_LIMIT_ENABLED` | `true` | Enables login/register rate limiting |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `900000` | Rate-limit window (15 min) |
| `AUTH_RATE_LIMIT_MAX` | `20` | Max auth attempts per IP + route per window |
| `CORS_ORIGINS` | *(empty)* | Comma-separated extra origins allowed to call the API |
| `SERVE_FRONTEND` | `true` | Serve the existing HTML pages from the repository root |

---

## 2. Conventions

### Base URL

```
http://localhost:3000/api
```

### Authentication

Every protected endpoint expects a bearer token:

```
Authorization: Bearer <token>
```

Tokens are returned by `POST /api/auth/register` and `POST /api/auth/login`.
They are JWTs signed with HS256, valid for `JWT_EXPIRES_IN`, and carry only
`sub` (user id), `email` and `name`. The user record is re-read from
`User.json` on every request, so a deleted account is rejected immediately.

### Response envelope

Success:

```json
{ "success": true, "...": "endpoint specific fields" }
```

Failure:

```json
{ "success": false, "message": "Human readable explanation", "details": { "field": "email" } }
```

`details` is optional and is used mainly for form-field validation.

### Status codes used

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 400 | Validation error / malformed JSON / bad request |
| 401 | Missing, invalid or expired token; wrong credentials |
| 403 | Authenticated but not allowed (not the owner / not connected) |
| 404 | Unknown route, student, project, message, … |
| 409 | Conflict — duplicate email, duplicate request, already accepted |
| 413 | Request body too large (JSON limit is 6 MB) |
| 429 | Too many authentication attempts |
| 500 | Server error (data file missing/corrupt, disk problem) |

### Timestamps

All timestamps are ISO 8601 UTC strings, e.g. `"2026-11-09T18:57:02.080Z"`.

### Ids

New records receive a UUID-based id with a readable prefix
(`user_…`, `project_…`, `connection_…`, `swap_…`, `message_…`, `feedback_…`,
`saved_…`). The seeded demo records keep short ids (`U001`, `P001`, `C001`, …).

---

## 3. Authentication

### POST /api/auth/register

Create a student account. Rate limited.

**Auth:** none

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` or `fullName` | string | yes | 1–120 chars |
| `email` | string | yes | unique, case-insensitive |
| `password` | string | yes | 6–128 chars, stored as a bcrypt hash |
| `course`, `year`, `college`, `registration`, `graduation` | string | no | profile details |
| `skills`, `teachSkills`, `learningSkills`, `interests` | string[] or comma string | no | |
| `bio` | string | no | ≤ 1200 chars |
| `profileImage` | string | no | `data:image/...` or `http(s)://` |

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Ananya Rao",
    "email": "ananya@example.com",
    "password": "secret123",
    "course": "B.Tech",
    "year": "2nd Year",
    "college": "BML Munjal University"
  }'
```

`201 Created`

```json
{
  "success": true,
  "message": "Account created successfully.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_5f0c...",
    "name": "Ananya Rao",
    "email": "ananya@example.com",
    "course": "B.Tech",
    "year": "2nd Year",
    "college": "BML Munjal University",
    "skills": [],
    "teachSkills": [],
    "learningSkills": [],
    "interests": [],
    "bio": "",
    "profileImage": "",
    "profileCompleted": false,
    "createdAt": "2026-11-09T18:57:02.080Z",
    "updatedAt": "2026-11-09T18:57:02.080Z"
  }
}
```

**Errors:** `400` validation, `409` email already registered, `429` too many attempts.

---

### POST /api/auth/login

**Auth:** none (rate limited)

**Body:** `{ "email": "...", "password": "..." }`

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"aarav@example.com","password":"skillmate123"}'
```

`200 OK`

```json
{
  "success": true,
  "message": "Login successful.",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "U001", "name": "Aarav Sharma", "email": "aarav@example.com", "...": "..." }
}
```

**Errors:** `400` missing field, `401` wrong email **or** password (identical
message on purpose — no account enumeration), `429` too many attempts.

---

### GET /api/auth/me

**Auth:** required

```bash
curl http://localhost:3000/api/auth/me -H "Authorization: Bearer $TOKEN"
```

`200 OK` → `{ "success": true, "user": { ...same shape as above... } }`

**Errors:** `401` missing/expired token.

---

### POST /api/auth/logout

**Auth:** required

Stateless JWT: the server confirms the token was valid and the client deletes
it. `200 OK` → `{ "success": true, "message": "Signed out. ..." }`

---

## 4. Student profiles

### GET /api/profiles

Discoverable students, enriched with compatibility and relationship data.

**Auth:** required

| Query | Type | Default | Notes |
|---|---|---|---|
| `search` / `q` | string | — | name, course, college, bio, skills, interests |
| `course` | string | — | exact, case-insensitive |
| `year` | string | — | exact (`"2nd Year"`) |
| `skill` | string | — | exact skill name |
| `sort` | `match` \| `name` \| `recent` | `match` | |
| `excludeSelf` | boolean | `true` | |
| `includeIncomplete` | boolean | `false` | include profiles that never completed setup |
| `limit` | 1–100 | `50` | |
| `offset` | ≥ 0 | `0` | |

```bash
curl "http://localhost:3000/api/profiles?skill=Python&sort=match" \
  -H "Authorization: Bearer $TOKEN"
```

`200 OK`

```json
{
  "success": true,
  "count": 1,
  "total": 1,
  "profiles": [
    {
      "id": "U002",
      "name": "Riya Kapoor",
      "course": "B.Tech",
      "year": "2nd Year",
      "college": "BML Munjal University",
      "skills": ["UI/UX Design", "Figma", "Web Development"],
      "teachSkills": ["Figma", "UI/UX Design", "Graphic Design"],
      "learningSkills": ["Python", "Machine Learning", "SQL"],
      "interests": ["Product Design", "Hackathons"],
      "bio": "Building thoughtful digital experiences through design and code.",
      "profileImage": "",
      "availability": "Evenings",
      "collaboration": "Hybrid",
      "matchScore": 85,
      "match": {
        "theyCanTeachYou": ["Figma", "UI/UX Design"],
        "youCanTeachThem": [],
        "sharedSkills": [],
        "isMutual": false
      },
      "relationship": { "status": "none", "connectionId": null, "direction": null },
      "saved": false,
      "savedRecordId": null
    }
  ]
}
```

**Note:** email addresses and password material are never included here.

**Errors:** `400` bad boolean/number query, `401` no token.

---

### GET /api/profiles/:id

One student's profile. Your own record returns `isSelf: true` **and** your
email; anybody else's record never includes an email.

**Auth:** required

`200 OK` → `{ "success": true, "profile": { ... } }`

**Errors:** `400` malformed id, `401`, `404` unknown student.

---

### PUT /api/profiles/:id

Update your own profile. Partial updates are allowed; only supplied fields
change.

**Auth:** required · **Authorisation:** `:id` must be your own id.

**Body (all optional):** `name`, `course`, `year`, `college`, `registration`,
`graduation`, `skills` (alias `knownSkills`), `teachSkills`, `learningSkills`,
`interests` (array or comma string), `bio`, `profileImage`,
`proficiency`, `availability`, `collaboration`, `profileCompleted`.

```bash
curl -X PUT http://localhost:3000/api/profiles/U001 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"skills":"Python, SQL","teachSkills":["Python"],"bio":"Data + AI.","profileCompleted":true}'
```

`200 OK` → `{ "success": true, "message": "Profile updated successfully.", "user": {...} }`

**Errors:** `400` invalid field, `401`, `403` not your profile, `404`.

---

## 5. Connections

### GET /api/connections

**Auth:** required

| Query | Values | Default |
|---|---|---|
| `status` | `all`, `pending`, `accepted`, `rejected`, `cancelled` | `all` |
| `box` | `all`, `received`, `sent` | `all` |

`200 OK`

```json
{
  "success": true,
  "received": [
    {
      "id": "C001",
      "senderId": "U002",
      "receiverId": "U001",
      "status": "pending",
      "direction": "incoming",
      "personId": "U002",
      "person": { "id": "U002", "name": "Riya Kapoor", "initials": "RK", "course": "B.Tech", "...": "..." },
      "createdAt": "2026-11-06T18:57:02.080Z",
      "updatedAt": "2026-11-06T18:57:02.080Z"
    }
  ],
  "sent": [],
  "accepted": [],
  "counts": { "receivedPending": 1, "sentPending": 0, "accepted": 0 }
}
```

---

### POST /api/connections

**Auth:** required · **Body:** `{ "receiverId": "U002" }`

```bash
curl -X POST http://localhost:3000/api/connections \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"receiverId":"U002"}'
```

`201 Created`

```json
{
  "success": true,
  "message": "Connection request sent.",
  "connection": {
    "id": "connection_...",
    "status": "pending",
    "person": { "id": "U002", "name": "Riya Kapoor", "initials": "RK", "...": "..." },
    "personId": "U002",
    "direction": "outgoing",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Errors:** `400` self-connection, `401`, `404` unknown student, `409` already
pending/accepted (in either direction).

A previously **rejected** or **cancelled** request is revived instead of
duplicated.

---

### PUT /api/connections/:id/accept

**Auth:** required · **Authorisation:** receiver only · **Body:** none

`200 OK` → `{ "success": true, "message": "Connection accepted.", "connection": { ..., "status": "accepted" } }`

**Errors:** `401`, `403` not the receiver, `404`, `409` already accepted / not pending.

### PUT /api/connections/:id/reject

**Auth:** required · **Authorisation:** receiver only

`200 OK` → status `rejected`. Errors as above.

### DELETE /api/connections/:id

Cancel a pending request (sender) or remove an accepted connection (either
side).

`200 OK` → `{ "success": true, "message": "Connection removed." }`

**Errors:** `401`, `403`, `404`.

---

## 6. Projects

### GET /api/projects

**Auth:** required

| Query | Notes |
|---|---|
| `search` / `q` | title, description, category, required skills |
| `category` | exact, case-insensitive |
| `skill` | exact required skill |
| `status` | exact status |
| `creatorId`, `memberId` | filter by owner/member |
| `mine` | `true` = only projects you created |
| `sort` | `recent` (default) or `title` |

`200 OK`

```json
{
  "success": true,
  "count": 1,
  "projects": [
    {
      "id": "P001",
      "title": "Campus Connect",
      "description": "A student platform to discover campus events, clubs and people with shared interests.",
      "category": "Web Development",
      "requiredSkills": ["HTML & CSS", "JavaScript", "UI/UX Design"],
      "creatorId": "U004",
      "creator": { "id": "U004", "name": "Kabir Malhotra", "initials": "KM", "...": "..." },
      "teamMembers": ["U004", "U003"],
      "members": [ { "id": "U004", "name": "Kabir Malhotra", "...": "..." } ],
      "teamSize": 4,
      "status": "Looking for teammates",
      "emoji": "✦",
      "joinRequests": [],
      "isCreator": false,
      "isMember": false,
      "hasPendingRequest": false,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

### GET /api/projects/:id

**Auth:** required · `200` → `{ "success": true, "project": { ... } }` · `404` unknown.

### POST /api/projects

**Auth:** required

**Body**

| Field | Required | Notes |
|---|---|---|
| `title` | yes | ≤ 160 chars |
| `description` | yes | ≤ 2000 chars |
| `category` | yes | free text, e.g. `Web Development` |
| `requiredSkills` (alias `skills`) | no | array or comma string |
| `teamSize` | no | 1–50, default 2 |
| `status` | no | one of the allowed statuses (default `Open`) |
| `emoji` | no | ≤ 8 chars |

Allowed statuses: `Open`, `Looking for teammates`, `Idea stage`,
`New project idea`, `In progress`, `Completed`, `Closed`.

`201 Created` → the project, with `creatorId` = you and `teamMembers: [you]`.

**Errors:** `400` missing/invalid fields, `401`.

### PUT /api/projects/:id

**Auth:** required · **Authorisation:** creator only · any of the create fields.

`200 OK` → updated project. **Errors:** `400`, `401`, `403`, `404`.

### DELETE /api/projects/:id

**Auth:** required · **Authorisation:** creator only

`200 OK` → `{ "success": true, "message": "Project deleted successfully." }`

### POST /api/projects/:id/join

Request to join a team. **Body:** `{ "message": "optional note" }`

`201 Created` → project with `hasPendingRequest: true`.
**Errors:** `400`, `401`, `404`, `409` already a member / already requested / you own it.

### PUT /api/projects/:id/join-requests/:userId

Creator accepts or rejects a join request.

**Body:** `{ "status": "accepted" }` or `{ "status": "rejected" }`

`200 OK` → project; on `accepted` the student is appended to `teamMembers`.
**Errors:** `400`, `401`, `403`, `404`, `409` team already full.

### DELETE /api/projects/:id/members/:userId

Leave a project (yourself) or remove a member (creator).

`200 OK` → project. **Errors:** `401`, `403`, `404`, `409` (creator cannot leave).

---

## 7. Skill exchange

### GET /api/skill-exchange

**Auth:** required · `?box=all|sent|received` (default `all`)

```json
{
  "success": true,
  "sent": [
    {
      "id": "S001",
      "studentId": "U001",
      "student": { "id": "U001", "name": "Aarav Sharma", "...": "..." },
      "matchedStudentId": "U002",
      "matchedStudent": { "id": "U002", "name": "Riya Kapoor", "...": "..." },
      "skillsToTeach": ["Python", "Machine Learning"],
      "skillsToLearn": ["Figma", "UI/UX Design"],
      "message": "I can help with the ML model if you can review our UI.",
      "status": "pending",
      "direction": "sent",
      "isOwner": true,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "received": [],
  "counts": { "sent": 1, "received": 0, "pending": 1, "accepted": 0 }
}
```

Statuses: `pending`, `accepted`, `declined`, `cancelled`.

### GET /api/skill-exchange/matches

Students with complementary skills, best first.

**Auth:** required · `?mutualOnly=true|false` (default `true`)

```json
{
  "success": true,
  "count": 1,
  "myTeachingSkills": ["Python", "Machine Learning"],
  "myLearningSkills": ["Figma", "UI/UX Design", "JavaScript", "Artificial Intelligence", "Research"],
  "matches": [
    {
      "student": { "id": "U002", "name": "Riya Kapoor", "initials": "RK", "...": "..." },
      "teaches": ["Figma", "UI/UX Design", "Graphic Design"],
      "wants": ["Python", "Machine Learning", "SQL"],
      "score": 90,
      "isMutual": true,
      "theyCanTeachYou": ["Figma", "UI/UX Design"],
      "youCanTeachThem": ["Python", "Machine Learning"],
      "sharedSkills": [],
      "alreadyRequested": false
    }
  ]
}
```

### Compatibility formula

```
score = 40
      + 15 × min(2, skills they teach that I want to learn)
      + 10 × min(2, skills I teach that they want to learn)
      +  2 × min(4, skills we both already know)
      → clamped to 25…99
```

"I want to learn" = the student's `learningSkills` plus `interests`.
"I can teach" = `teachSkills`, falling back to `skills` when empty.

### POST /api/skill-exchange

**Auth:** required

**Body:** `{ "matchedStudentId": "U002", "skillsToTeach": ["Python"], "skillsToLearn": ["Figma"], "message": "optional" }`

`skillsToTeach` / `skillsToLearn` default to the computed overlap.

`201 Created` → `{ "success": true, "message": "Skill exchange request sent.", "request": {...} }`

**Errors:** `400` self / no overlap, `401`, `404` unknown student,
`409` pending or accepted exchange already exists.

### PUT /api/skill-exchange/:id

**Auth:** required, participant.

| Body | Who | Effect |
|---|---|---|
| `status: "accepted"` / `"declined"` | recipient | answer a `pending` request |
| `status: "cancelled"` | owner | cancel a `pending` request |
| `skillsToTeach`, `skillsToLearn`, `message` | owner | edit a request |

`200 OK` → updated request.
**Errors:** `400` nothing to update, `403` wrong participant, `404`, `409` invalid transition.

### DELETE /api/skill-exchange/:id

**Auth:** required, owner. Deletes a request that is not `accepted`.

`200 OK` → `{ "success": true, "message": "Skill exchange request deleted." }`

---

## 8. Messages

Messaging is restricted to **accepted connections**.

### POST /api/messages

**Auth:** required · **Body:** `{ "receiverId": "U002", "content": "Hello!" }`

`201 Created`

```json
{
  "success": true,
  "message": "Message sent.",
  "data": {
    "id": "message_...",
    "senderId": "U001",
    "receiverId": "U002",
    "content": "Hello!",
    "timestamp": "2026-11-09T18:57:02.080Z",
    "read": false,
    "person": { "id": "U002", "name": "Riya Kapoor", "...": "..." },
    "mine": true
  }
}
```

**Errors:** `400` empty/self, `401`, `403` not connected, `404` unknown student.

### GET /api/messages/threads

Conversation list with unread counts, newest activity first.

```json
{
  "success": true,
  "count": 1,
  "threads": [
    {
      "person": { "id": "U002", "name": "Riya Kapoor", "...": "..." },
      "lastMessage": { "content": "See you tomorrow", "timestamp": "...", "senderId": "U002", "mine": false },
      "unreadCount": 1,
      "messageCount": 7
    }
  ]
}
```

### GET /api/messages/:userId

Full conversation with one connected student, oldest first.

```json
{
  "success": true,
  "person": { "id": "U002", "name": "Riya Kapoor", "...": "..." },
  "count": 2,
  "messages": [
    { "id": "M001", "senderId": "U001", "receiverId": "U002", "content": "Hello!", "timestamp": "...", "read": true, "mine": true },
    { "id": "M002", "senderId": "U002", "receiverId": "U001", "content": "Hi!", "timestamp": "...", "read": false, "mine": false }
  ]
}
```

**Errors:** `400` your own id, `401`, `403` not connected, `404` unknown student.

### PUT /api/messages/:id/read

**Auth:** required · **Authorisation:** receiver only

`200 OK` → `{ "success": true, "message": "Message marked as read.", "data": {...} }`
**Errors:** `401`, `403`, `404`.

---

## 9. Feedback

### POST /api/feedback

**Auth:** required

| Field | Required | Notes |
|---|---|---|
| `rating` | yes | integer 1–5 |
| `category` | yes | ≤ 60 chars (e.g. `Platform`, `Skill Exchange`, `Projects`) |
| `comments` or `feedback` | yes | 1–1500 chars; the dashboard's `liked` / `improve` / `suggestions` boxes are joined automatically |

`201 Created` → `{ "success": true, "message": "Thank you! ...", "feedback": {...} }`

**Errors:** `400` invalid rating / missing comments, `401`.

### GET /api/feedback

Your own feedback only, newest first.
`200 OK` → `{ "success": true, "count": 1, "feedback": [...] }`

### GET /api/feedback/stats

Aggregate statistics for everyone, **without** comment text.

```json
{
  "success": true,
  "stats": {
    "total": 2,
    "average": 4.5,
    "categories": [
      { "category": "Platform", "count": 1, "average": 5 },
      { "category": "Skill Exchange", "count": 1, "average": 4 }
    ]
  }
}
```

---

## 10. Saved people

### POST /api/saved-people

**Auth:** required · **Body:** `{ "savedStudentId": "U004" }`

`201 Created` → `{ "success": true, "message": "Student saved.", "saved": { "id": "saved_...", "savedStudentId": "U004", "person": {...}, "createdAt": "..." } }`

**Errors:** `400` yourself, `401`, `404` unknown student, `409` already saved.

### GET /api/saved-people

`200 OK` → `{ "success": true, "count": 2, "saved": [ ... ] }`

### DELETE /api/saved-people/:id

**Auth:** required · **Authorisation:** owner of the saved record.

`200 OK` → `{ "success": true, "message": "Student removed from your saved people." }`
**Errors:** `401`, `403`, `404`.

---

## 11. Health & API index

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /api/health` | none | `{ success, status: "ok", uptimeSeconds }` |
| `GET /api` | none | List of all endpoints |

---

## 12. JSON database

Location: `Backend/Data` (configurable with `SKILLMATE_DATA_DIR`). Every file
contains a JSON **array** — the only exceptions are harmless legacy shapes that
are migrated by `npm run seed`.

| File | Collection | Fields |
|---|---|---|
| `User.json` | `users` | `id`, `name`, `email`, `passwordHash`, `course`, `year`, `college`, `registration`, `graduation`, `skills[]`, `teachSkills[]`, `learningSkills[]`, `interests[]`, `bio`, `profileImage`, `proficiency`, `availability`, `collaboration`, `profileCompleted`, `createdAt`, `updatedAt` |
| `Projects.json` | `projects` | `id`, `title`, `description`, `category`, `requiredSkills[]`, `creatorId`, `teamMembers[]`, `teamSize`, `status`, `emoji`, `joinRequests[]`, `createdAt`, `updatedAt` |
| `Connections.json` | `connections` | `id`, `senderId`, `receiverId`, `status`, `createdAt`, `updatedAt` |
| `SkillExchange.json` | `skillExchange` | `id`, `studentId`, `skillsToTeach[]`, `skillsToLearn[]`, `matchedStudentId`, `message`, `status`, `createdAt`, `updatedAt` |
| `Messages.json` | `messages` | `id`, `senderId`, `receiverId`, `content`, `timestamp`, `read` |
| `Feedback.json` | `feedback` | `id`, `studentId`, `rating`, `category`, `comments`, `createdAt` |
| `Savedpeople.json` | `savedPeople` | `id`, `userId`, `savedStudentId`, `createdAt` |

### How the data layer protects itself

* `utils/jsonDatabase.js` performs **atomic writes**: data goes to
  `<file>.<pid>.<ts>.tmp` and is then renamed over the original, so a crash
  cannot leave half a JSON file.
* Reads and writes per collection are **serialised** through an in-process
  lock, so two simultaneous requests cannot overwrite each other.
* A missing file is treated as an empty collection and created on the next
  write. A corrupt file raises a clear `500` instead of being overwritten.
* Only the seven whitelisted collection names are accepted — no path traversal.

### Limitations (important)

This is a **demonstration-grade** store:

* Single Node process only. Multiple server instances or cluster workers would
  need a real database (PostgreSQL, MongoDB, SQLite with WAL).
* Every write rewrites the whole file; fine for hundreds of records, not for
  tens of thousands.
* No transactions across collections, no indexes, no backup automation.
* Millions of small concurrent writes will degrade performance long before
  they corrupt data (the lock serialises them).

For production, replace `utils/jsonDatabase.js` with a database adapter — the
route modules only use `readAll / findById / insert / update / remove / mutate`.

---

## 13. How the frontend talks to the API

All pages are plain HTML/CSS/JS and are served by the same Express server
(`SERVE_FRONTEND=true`), so every call is same-origin:

```js
const response = await fetch("/api/projects", {
  headers: { Authorization: `Bearer ${token}` }
});
```

* `api.js` (repository root) is the shared frontend client. It stores the JWT
  in `localStorage` under `skillmateToken`, the user under
  `skillmateCurrentUser`, and exposes `SkillMate.api.*` helpers plus
  `SkillMate.requireAuth()`.
* `StudentLogin.js` → `POST /api/auth/login`, then redirects to
  `Dashboard.html`.
* `ProfileDetails.js` → `POST /api/auth/register`; `Skills.js` stores the
  chosen skills in `sessionStorage`; `CompleteProfile.js` →
  `PUT /api/profiles/:id`.
* `Dashboard.js` → `/api/auth/me`, `/api/profiles`, `/api/projects`,
  `/api/connections`, `/api/messages/*`, `/api/saved-people`, `/api/feedback`.
* `Discover.js` → `/api/profiles` (search + filters + match scores),
  `/api/connections`, `/api/saved-people`.
* `Projects.js` → `/api/projects` CRUD + `/join`.
* `SkillExchange.js` → `/api/skill-exchange/matches`, `/api/skill-exchange`,
  `PUT /api/profiles/:id` for learning goals.
* `Messages.js` → `/api/messages/threads`, `/api/messages/:userId`,
  `POST /api/messages`, `PUT /api/messages/:id/read`.
* `Feedback.js` → `POST /api/feedback`.

`localStorage` is used only for the token, the cached user object and UI state
(which conversation was open). Persistence always happens on the server.

If you ever host the frontend separately, set `CORS_ORIGINS` to its origin and
change `API_BASE` in `api.js`.

---

## 14. Testing

```bash
cd Backend
npm test
```

The suite uses Node's built-in test runner and real HTTP requests against an
ephemeral server, with a temporary data directory per test file (your real
`Backend/Data` is never touched).

Covered: registration, duplicate email, invalid input, login success/failure,
token protection, profile listing/search/filtering/updating, authorisation
rules, connection requests/accept/reject/cancel, project CRUD + join flow,
skill matching + request lifecycle, messaging permissions, feedback validation
and statistics, saved people, JSON persistence, atomic writes, corrupt-file
handling and concurrent writes.

See `TESTING.md` for the latest recorded results.
