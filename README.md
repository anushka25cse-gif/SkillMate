# SkillMate 🎓

> Find the skills you need. Meet the people who have them.

SkillMate is a student-focused platform designed to help students discover peers with complementary skills, find teammates for projects, collaborate on ideas, and exchange knowledge.

The platform connects students based on what they know and what they want to learn, making it easier to find the right people for the right projects.

This repository now ships with a complete **Node.js + Express REST API** and a **JSON-file database**, so every page stores and reads real data on the server instead of in the browser.

---

## ✨ Features

### 🔐 Student accounts & authentication
- Registration and login backed by the API (`POST /api/auth/register`, `POST /api/auth/login`)
- Passwords stored as **bcrypt hashes** (never plain text) with a legacy-hash upgrade path
- JWT access tokens with an `/api/auth/me` session check
- Rate limiting on the login and register endpoints
- Profiles, skills, interests and photos saved in `User.json`

### 🏠 Dashboard
A personalized dashboard where students can view:

- Recommended teammates with match percentages
- Project invitations and recent projects
- Connection requests (received / sent / accepted) with real accept & decline
- Saved people
- Messages (real conversations with unread counts)
- Profile completion percentage and current skills

### 🔎 Discover
Students can discover potential teammates based on their skills, interests, and learning goals.

- Live student profiles from `GET /api/profiles`
- Search by name/course/bio and filter by skill
- Compatibility percentage calculated by the server (the same number on every page)
- Send connection requests and save profiles

### 👥 Projects & Team Formation
- Browse, search and filter projects (by category, skill, status)
- Create, **edit and delete** your own projects (owner-only rules enforced by the API)
- Request to join a team; the creator accepts or rejects
- Membership and team-size tracking

### 🔄 Skill Swap
**I CAN TEACH** skills, **I WANT TO LEARN** skills — the server finds students whose teaching and learning goals are complementary, with a percentage match.

- Mutual skill matching (`GET /api/skill-exchange/matches`)
- Send, accept, decline and cancel exchange requests
- Learning goals are stored on your profile (`PUT /api/profiles/:id`)

### 💬 Messages, Feedback & Saved People
- Message connected students; messages persist in `Messages.json`
- Unread badges, conversation history, mark-as-read
- Submit feedback (rating 1–5 + category + comments) with validation
- Save and unsave student profiles

---

## 🚀 Getting started

Requirements: **Node.js 18+**.

```bash
git clone https://github.com/anushka25cse-gif/SkillMate.git
cd SkillMate/Backend
npm install

# optional: create the demo students, projects and requests
npm run seed

# start the API + the website on http://localhost:3000
npm start
```

Then open **<http://localhost:3000/Login.html>**.

| Command | Purpose |
|---|---|
| `npm start` | Full API + the existing frontend |
| `npm run dev` | Same, with auto-restart on file changes |
| `npm run start:legacy` | The original Part-1 `server.js` (auth only) |
| `npm run seed` | Write demo data (backs up previous JSON files) |
| `npm test` | Automated API + database test suite |

**Demo accounts** (created by `npm run seed`, password `skillmate123`):
`aarav@example.com`, `riya@example.com`, `mehak@example.com`,
`kabir@example.com`, `sana@example.com`, `dev@example.com`.

Full endpoint reference: **[Backend/docs/API_DOCUMENTATION.md](Backend/docs/API_DOCUMENTATION.md)**.
Configuration: [Backend/.env.example](Backend/.env.example).
Testing log: [TESTING.md](TESTING.md).

---

## 🎨 UI/UX Design

The SkillMate interface was designed and prototyped using **Figma** before being developed using HTML and CSS.

The design focuses on:

- Clean and intuitive navigation
- Student-friendly layouts
- Card-based interfaces
- Skill tags
- Match indicators
- Clear calls to action
- Consistent visual design
- Simple user flows

The existing design, layout, colour scheme and page navigation were preserved — only the data source behind each page changed.

### 🔗 Figma Design

[View the SkillMate UI/UX Design on Figma](https://www.figma.com/design/DJMIqswjzaev2FtjXUtCM8/SkillMate?node-id=0-1&t=RHS3dKQDWhlQa8QF-1))

---

## 🛠️ Technologies & Tools

### Frontend
- HTML5, CSS3, vanilla JavaScript
- Shared API client (`api.js`) — fetch + JWT session handling

### Backend
- Node.js 18+, Express 5
- JWT (jsonwebtoken) for access tokens
- bcryptjs for password hashing
- JSON files as the database (`Backend/Data/*.json`), with atomic writes and a per-file write lock

### UI/UX Design
- Figma

### Testing
- Node.js built-in test runner (`node --test`) + real HTTP requests (Supertest-style, zero extra dependencies)

### Version Control
- Git, GitHub, feature branch + pull request workflow

---

## 📱 Pages

| File | Description |
|---|---|
| `Login.html` | Marketing / welcome page |
| `StudentLogin.html` | Student sign-in → `POST /api/auth/login` |
| `ProfileDetails.html` | Create an account → `POST /api/auth/register` |
| `Skills.html` | Choose skills you know / can teach (registration step 2) |
| `CompleteProfile.html` | Finish your profile → `PUT /api/profiles/:id` |
| `Dashboard.html` | Personalized dashboard (overview, requests, saved, messages, profile) |
| `discover.html` | Discover and match with students |
| `Projects.html` | Explore, create, edit and delete projects |
| `SkillExchange.html` | Skill exchange and learning page |
| `Feedback.html` | Feedback form → `POST /api/feedback` |
| `Skillswap.html` | Early static mock — redirects to `SkillExchange.html` |
| `api.js` | Shared frontend API client |

---

## 📂 Project Structure

```
SkillMate/
├── Login.html, StudentLogin.html, ProfileDetails.html, Skills.html,
│   CompleteProfile.html, Dashboard.html, discover.html, Projects.html,
│   SkillExchange.html, Feedback.html, Skillswap.html
├── api.js                      # frontend API client (shared by every page)
├── Backend/
│   ├── app.js                  # Express app (npm start entry point)
│   ├── server.js               # original Part-1 server (untouched)
│   ├── config.js, db.js
│   ├── routes/
│   │   ├── authRoutes.js       # /api/auth/*
│   │   ├── profileRoutes.js    # /api/profiles/*
│   │   ├── connectionRoutes.js # /api/connections/*
│   │   ├── projectRoutes.js    # /api/projects/*
│   │   ├── skillExchangeRoutes.js
│   │   └── otherRoutes.js      # messages, feedback, saved people
│   ├── middleware/             # auth + error + rate limiting
│   ├── utils/                  # JSON database, validation, matching, users
│   ├── data (Data/)/           # User, Projects, Connections, SkillExchange,
│   │                            # Messages, Feedback, Savedpeople (.json)
│   ├── tests/                  # automated test suite
│   ├── scripts/seed.js         # demo data generator
│   ├── docs/                   # API_DOCUMENTATION.md, SERVER_INTEGRATION.md
│   └── .env.example
├── TESTING.md
└── README.md
```

---

## ⚠️ Storage note

The JSON files are perfect for a class project and a demo, but they are a
single-process store: no multi-instance deployment, no indexing and no
transactions across files. The limits are documented in
[Backend/docs/API_DOCUMENTATION.md](Backend/docs/API_DOCUMENTATION.md) §12.

---

## 👥 Team Members

| Name |
|------|
| Anushka |
| Akshita Setia |
| Shubhi Vajpayee |
| Taksh Yadav |
| Himalya Yadav |
