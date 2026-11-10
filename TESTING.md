# Testing — SkillMate

Date of last run: **10 November 2026** · Node.js v26.8.1 · Express 5.3.0

Nothing below is claimed without having been executed. Every automated test was
run with `npm test` in `Backend/`, and every browser check was performed
against a live server started with `npm start`.

---

## 1. Automated API + database suite

```
cd Backend
npm test          # node --test tests/
```

Final run:

```
▶ Authentication                                  13 passed
▶ Connections                                     13 passed
▶ JSON database                                    7 passed
▶ Messages, feedback and saved people             20 passed
▶ Student profiles                                11 passed
▶ Projects                                        13 passed
▶ Skill exchange                                  12 passed

ℹ tests 89
ℹ suites 7
ℹ pass 89
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 781.5744
```

**89 / 89 passing, 0 failing.**

Each test file boots the real Express app on an ephemeral port and drives it
with HTTP requests, using its own temporary data directory
(`SKILLMATE_DATA_DIR`), so `Backend/Data` is never modified by tests.

### What is covered

| Area | Assertions exercised |
|---|---|
| **Registration** | success + token, duplicate email (case-insensitive) → 409, invalid email → 400, short password → 400, missing name → 400, malformed JSON body → 400, no `passwordHash`/`passwordSalt` in the response |
| **Login** | valid credentials → token, wrong password → 401, unknown email → 401 with an identical message, no token → 401, tampered token → 401, `/api/auth/me` → 200, logout → 200 |
| **Profiles** | list requires auth, own profile excluded, secrets/emails absent, match scores sorted, mutual match computed (they teach / I teach / shared), `search`, `skill`, `course` filters, single profile, own-profile email included, 404 unknown id, 400 bad id characters, update with comma-separated skills, 403 updating someone else, 400 invalid profile image |
| **Connections** | create → 201, duplicate → 409, reverse duplicate → 409, self → 400, unknown receiver → 404, receiver inbox, accept by sender → 403, accept by receiver → 200, both sides see the connection, reject → 200, re-request after rejection → 201, cancel → 200, sender-only cancellation → 403 |
| **Projects** | create with creator as first member, missing title → 400, list + category/skill/search filters, single project with people, edit by non-creator → 403, edit by creator → 200, unknown status → 400, join → 201, duplicate join → 409, creator self-join → 409, accept join by non-creator → 403, accept → team member added, member leaves → 200, creator cannot leave → 409, delete by non-creator → 403, delete → 200, deleted project → 404 |
| **Skill exchange** | mutual match list (with breakdown), self → 400, unknown student → 404, no overlap → 400, create → 201 with computed skill lists, duplicate → 409, sent/received boxes, accept by owner → 403, accept by recipient → 200, skills edit by recipient → 403, accepted cannot be cancelled or deleted → 409, pending can be deleted → 200 |
| **Messages** | messaging an unconnected student → 403, connect + accept, send → 201, empty → 400, self-message → 400, conversation in order, third-party read → 403, threads with unread counts, mark-read by receiver only (sender → 403), unread count drops to 0 |
| **Feedback** | rating 0 / 6 / non-numeric → 400, missing comments → 400, submit → 201 with `studentId`, per-student list (own records only), aggregate stats total + average **without** comment text |
| **Saved people** | save → 201, duplicate → 409, self → 400, unknown → 404, list, delete by non-owner → 403, delete → 200, list → 0 |
| **JSON database** | missing file → `[]`, atomic write with no `.tmp` leftovers, corrupt JSON → 500, unknown collection rejected, 40 concurrent read-modify-write cycles all applied (no lost updates), insert/update/remove, `removeWhere` precision |

---

## 2. Manual end-to-end browser verification

Server: `npm start` → `http://localhost:3000`. Driven through a real Chromium
browser (full page loads, real clicks, real form submissions).

| # | Check | Result |
|---|---|---|
| 1 | `GET /api/health` | `{"status":"ok"}` |
| 2 | Static pages served (`StudentLogin.html`, `Login.html`, `api.js`) | 200 |
| 3 | `GET /` | 302 → `/Login.html` |
| 4 | `/Backend/Data/User.json` over HTTP | **404** (database never exposed) |
| 5 | `/api/profiles` without a token | 401 |
| 6 | Sign in as `aarav@example.com` through the real login form | token stored, redirected to `Dashboard.html` |
| 7 | Dashboard renders live data | welcome "Aarav", 3 skills, saved **2**, received **2**, sent 0, accepted **1**, 3 recommendation cards, 3 project cards — all matching the seeded JSON exactly |
| 8 | Accept a connection request in the UI | received 2 → **1**, accepted 1 → **2**, toast shown, persisted to `Connections.json` |
| 9 | Discover page | 5 profiles (own excluded), best match **Riya Kapoor 90%**, tags rendered |
| 10 | Discover search "Dev" / "zzzz" / clear | 3 results / 0 results (card hidden) / 5 results |
| 11 | Connect button on an already-accepted student | disabled ✓ (correct) |
| 12 | Projects page | 3 projects, category/skill filters, "my projects" = 0 for this user |
| 13 | Create project through the modal | 4 projects, my projects 1, toast, persisted |
| 14 | Edit project (owner) | modal pre-filled with the project's values, title updated and persisted |
| 15 | Ask to join another student's project | "Interest sent ✓", join request stored on the project |
| 16 | Delete project (owner, with confirmation) | back to 3 projects, gone from the list and from `Projects.json` |
| 17 | Skill Exchange page | 2 mutual matches (90% / …), 3 learning skills, 2 teaching skills, 2 requests listed |
| 18 | Add a learning goal and save | 3 → **4**, toast, persisted to the profile on the server |
| 19 | Messages view in the Dashboard | 2 conversations, conversation loaded, unread message auto-marked read |
| 20 | Send a message | 2 bubbles, sent bubble rendered, input cleared, stored in `Messages.json` |
| 21 | Saved People view | 2 saved students with names + cards |
| 22 | My Profile view | name, course, email, 91% completion, skills rendered |
| 23 | Feedback form (client validation then submit) | rejected while the category was empty, then **"Thank you! Your feedback has been submitted successfully."** with a real `POST /api/feedback` |
| 24 | Full registration flow: `ProfileDetails` → `Skills` → `CompleteProfile` → `Dashboard` | new account created (UUID id), skills carried between pages, profile completed, dashboard rendered for the new student |
| 25 | Authorization from the browser | `PUT /api/profiles/U001` with another student's token → **403** |
| 26 | **Console errors on all pages** (`Dashboard`, `Discover`, `Projects`, `SkillExchange`, `Feedback`, `Dashboard?view=messages`, `StudentLogin`, `Login`, `CompleteProfile`) | **0 errors, 0 unhandled rejections** |
| 27 | Demo data restored after testing | `npm run seed` → 6/3/4/4/2/2/2 records; test account gone |

---

## 3. Known limitations / not covered

* **No test runner configuration for a CI pipeline** — `npm test` is
  deliberately plain `node --test` so it works offline; there is no GitHub
  Actions workflow in this repository.
* **No automated browser tests** — section 2 is a manual (recorded) run. A
  Playwright suite would be the natural next step.
* **Concurrency is proven only within one Node process** (the 40-writer test).
  Two server processes writing the same JSON file are *not* safe — by design of
  the storage layer, which is documented as demonstration-grade.
* **Rate limiting** is enabled by default but is turned off inside the test
  suite (`AUTH_RATE_LIMIT_ENABLED=false`) so the 13 auth tests can run without
  tripping the limiter.
* `Skillswap.html` now redirects to `SkillExchange.html`; it is not exercised
  by tests.
