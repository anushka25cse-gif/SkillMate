# server.js integration patch

`Backend/server.js` was **not modified**. It is the Part-1 server that shipped
with the original repository and it still runs exactly as before:

```bash
npm run start:legacy   # node server.js
```

The complete, modular API lives in `Backend/app.js` + `Backend/routes/*` and is
started with:

```bash
npm start              # node app.js
```

`app.js` builds a separate Express instance with the same middleware style as
`server.js` (CORS, JSON body parsing, one error handler at the end) and mounts
the six route modules under `/api`. Nothing is shared or monkey-patched, so the
two entry points cannot interfere with each other.

---

## Why the routes are not mounted in server.js

The project brief requires explicit approval before `server.js` changes, and
forbids putting every API in that file. So the integration is provided here as
an **optional patch** — apply it only if your team wants a single entry point.

## Optional patch (needs team approval)

1. Open `Backend/server.js`.
2. Add these lines directly **before** the `// Handle errors` block:

```diff
+ // ---------------------------------------------------------------
+ // Modular API routes (Phase 2). Feature modules live in routes/.
+ // ---------------------------------------------------------------
+ const apiRoutes = require("./routes");
+ app.use("/api", apiRoutes);
+
  // Handle errors
  app.use((err, req, res, next) => {
```

3. Start with `node server.js`.

After this change `server.js` serves the full API. **Restart required.** The
legacy `GET /api/users`, `POST /api/auth/register`,
`POST /api/auth/login` and `PUT /api/users/:email/complete` handlers already in
the file keep working, and `routes/index.js` additionally registers
`/api/profiles`, `/api/connections`, `/api/projects`, `/api/skill-exchange`,
`/api/messages`, `/api/feedback` and `/api/saved-people`.

> Route order note: `POST /api/auth/register` and `POST /api/auth/login` are
> declared before `app.use("/api", apiRoutes)` in that file, so Express reaches
> them first. There is no path overlap with the new modules (`/api/auth/me` and
> `/api/auth/logout` exist only in the new router), so both sets coexist.

If you would rather keep `server.js` untouched, keep using `npm start`.

## Files intentionally left alone

| File | Reason |
|---|---|
| `Backend/server.js` | Part-1 history; changes require explicit approval |
| `project.html` | Removed in your working tree (replaced by `Projects.html`) |
| `Backend/Data/*` | Seeded in the new schema by `npm run seed`; previous files were backed up to `Backend/Data/backups/<timestamp>/` |
