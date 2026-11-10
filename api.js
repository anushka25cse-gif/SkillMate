/**
 * SkillMate frontend API client.
 *
 * Loaded by every page before its own script. It owns:
 *   - the base URL of the REST API,
 *   - the JWT (localStorage) and the cached user object,
 *   - small fetch helpers with consistent error handling,
 *   - one method per backend endpoint,
 *   - a few view helpers shared by the pages (initials, escaping, dates).
 *
 * The pages keep their existing design; only their data source changes from
 * hardcoded demo arrays / localStorage to this client.
 */

(function () {
    "use strict";

    const TOKEN_KEY = "skillmateToken";
    const USER_KEY = "skillmateCurrentUser";

    /**
     * When the pages are served by the SkillMate server (default on port 3000)
     * the API is same-origin. A page opened from file:// or another dev server
     * falls back to the local API address.
     */
    function resolveBaseUrl() {
        if (typeof window.SKILLMATE_API_BASE === "string") {
            return window.SKILLMATE_API_BASE.replace(/\/$/, "");
        }

        if (window.location.protocol === "file:") {
            return "http://localhost:3000";
        }

        if (
            ["3000", "3001"].includes(window.location.port) ||
            window.location.port === ""
        ) {
            // Served by our Express app (or a reverse proxy) -> same origin.
            return "";
        }

        return "http://localhost:3000";
    }

    const BASE_URL = resolveBaseUrl();

    /** The API error shape is normalised into this Error subclass. */
    class ApiError extends Error {
        constructor(message, status, details) {
            super(message);
            this.name = "ApiError";
            this.status = status;
            this.details = details || null;
        }
    }

    // ---------------------------------------------------------------------
    // Session storage helpers
    // ---------------------------------------------------------------------

    function getToken() {
        try {
            return localStorage.getItem(TOKEN_KEY) || "";
        } catch (error) {
            return "";
        }
    }

    function setToken(token) {
        try {
            if (token) {
                localStorage.setItem(TOKEN_KEY, token);
            } else {
                localStorage.removeItem(TOKEN_KEY);
            }
        } catch (error) {
            console.warn("SkillMate: could not store the session token.");
        }
    }

    /**
     * The rest of the pages were written against a user object that uses
     * `fullName`, `knownSkills`, `teachSkills` and `profilePhoto`. The API uses
     * `name`, `skills`, `teachSkills` and `profileImage`. This adapter keeps
     * the older view code working without changing every template.
     */
    function adaptUser(user) {
        if (!user) return null;

        const skills = Array.isArray(user.skills) ? user.skills : [];
        const teachSkills = Array.isArray(user.teachSkills) ? user.teachSkills : [];

        return {
            ...user,
            fullName: user.name || user.fullName || "",
            name: user.name || user.fullName || "",
            knownSkills: Array.isArray(user.knownSkills) ? user.knownSkills : skills,
            teachSkills,
            learningSkills: Array.isArray(user.learningSkills) ? user.learningSkills : [],
            profilePhoto: user.profileImage || user.profilePhoto || "",
            profileImage: user.profileImage || user.profilePhoto || "",
            interests: Array.isArray(user.interests) ? user.interests : []
        };
    }

    function saveUser(user) {
        try {
            if (!user) {
                localStorage.removeItem(USER_KEY);
                sessionStorage.removeItem(USER_KEY);
                return null;
            }

            const adapted = adaptUser(user);
            const serialised = JSON.stringify(adapted);

            localStorage.setItem(USER_KEY, serialised);
            sessionStorage.setItem(USER_KEY, serialised);

            return adapted;
        } catch (error) {
            console.warn("SkillMate: could not cache the user profile.");
            return null;
        }
    }

    function getUser() {
        const sources = [localStorage, sessionStorage];

        for (const storage of sources) {
            try {
                const raw = storage.getItem(USER_KEY);

                if (raw) {
                    const parsed = JSON.parse(raw);

                    if (parsed && typeof parsed === "object") {
                        return adaptUser(parsed);
                    }
                }
            } catch (error) {
                // Ignore a corrupt cache and try the next storage.
            }
        }

        return null;
    }

    function clearSession() {
        setToken("");
        saveUser(null);
    }

    /** Redirect unauthenticated visitors to the login page. */
    function requireAuth() {
        const token = getToken();

        if (!token) {
            const next = encodeURIComponent(
                window.location.pathname.split("/").pop() + window.location.search
            );

            window.location.replace(`StudentLogin.html?next=${next}`);
            return false;
        }

        return true;
    }

    function initialsOf(name) {
        return String(name || "Student")
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(part => part[0].toUpperCase())
            .join("");
    }

    // ---------------------------------------------------------------------
    // HTTP
    // ---------------------------------------------------------------------

    async function request(path, options = {}) {
        const {
            method = "GET",
            body,
            auth = true,
            headers: extraHeaders,
            signal
        } = options;

        const headers = { Accept: "application/json", ...(extraHeaders || {}) };
        const token = getToken();

        if (body !== undefined) {
            headers["Content-Type"] = "application/json";
        }

        if (auth && token) {
            headers.Authorization = `Bearer ${token}`;
        }

        let response;

        try {
            response = await fetch(`${BASE_URL}${path}`, {
                method,
                headers,
                body: body === undefined ? undefined : JSON.stringify(body),
                signal
            });
        } catch (error) {
            if (error.name === "AbortError") throw error;

            throw new ApiError(
                "Cannot reach the SkillMate server. Make sure it is running (npm start in Backend).",
                0
            );
        }

        const text = await response.text();
        let payload = null;

        if (text) {
            try {
                payload = JSON.parse(text);
            } catch (error) {
                payload = null;
            }
        }

        if (!response.ok) {
            const message =
                (payload && payload.message) ||
                `Request failed with status ${response.status}.`;

            // An expired or revoked token should not leave a broken session
            // behind. Do not redirect here — the page decides what to show.
            if (response.status === 401 && auth && token) {
                setToken("");
            }

            throw new ApiError(message, response.status, payload && payload.details);
        }

        return payload || {};
    }

    function query(params) {
        const search = new URLSearchParams();

        Object.entries(params || {}).forEach(([key, value]) => {
            if (value === undefined || value === null || value === "") return;

            search.set(key, Array.isArray(value) ? value.join(",") : String(value));
        });

        const string = search.toString();

        return string ? `?${string}` : "";
    }

    // ---------------------------------------------------------------------
    // Endpoints
    // ---------------------------------------------------------------------

    const api = {
        baseUrl: BASE_URL,

        // Authentication ---------------------------------------------------
        async register(payload) {
            const result = await request("/api/auth/register", {
                method: "POST",
                body: payload,
                auth: false
            });

            if (result.token) setToken(result.token);
            if (result.user) saveUser(result.user);

            return result;
        },

        async login(email, password) {
            const result = await request("/api/auth/login", {
                method: "POST",
                body: { email, password },
                auth: false
            });

            if (result.token) setToken(result.token);
            if (result.user) saveUser(result.user);

            return result;
        },

        /** Refresh the cached user from the server. */
        async me() {
            const result = await request("/api/auth/me");

            if (result.user) saveUser(result.user);

            return result.user;
        },

        async logout() {
            try {
                if (getToken()) {
                    await request("/api/auth/logout", { method: "POST" });
                }
            } catch (error) {
                // The token is discarded regardless.
            }

            clearSession();
        },

        // Profiles ---------------------------------------------------------
        async listProfiles(filters) {
            return request(`/api/profiles${query(filters)}`);
        },

        async getProfile(id) {
            return request(`/api/profiles/${encodeURIComponent(id)}`);
        },

        async updateProfile(id, updates) {
            const result = await request(
                `/api/profiles/${encodeURIComponent(id)}`,
                { method: "PUT", body: updates }
            );

            if (result.user) saveUser(result.user);

            return result;
        },

        // Connections ------------------------------------------------------
        async listConnections(filters) {
            return request(`/api/connections${query(filters)}`);
        },

        async sendConnectionRequest(receiverId) {
            return request("/api/connections", {
                method: "POST",
                body: { receiverId }
            });
        },

        async acceptConnection(id) {
            return request(`/api/connections/${encodeURIComponent(id)}/accept`, {
                method: "PUT"
            });
        },

        async rejectConnection(id) {
            return request(`/api/connections/${encodeURIComponent(id)}/reject`, {
                method: "PUT"
            });
        },

        async removeConnection(id) {
            return request(`/api/connections/${encodeURIComponent(id)}`, {
                method: "DELETE"
            });
        },

        // Projects ---------------------------------------------------------
        async listProjects(filters) {
            return request(`/api/projects${query(filters)}`);
        },

        async getProject(id) {
            return request(`/api/projects/${encodeURIComponent(id)}`);
        },

        async createProject(project) {
            return request("/api/projects", { method: "POST", body: project });
        },

        async updateProject(id, updates) {
            return request(`/api/projects/${encodeURIComponent(id)}`, {
                method: "PUT",
                body: updates
            });
        },

        async deleteProject(id) {
            return request(`/api/projects/${encodeURIComponent(id)}`, {
                method: "DELETE"
            });
        },

        async joinProject(id, message) {
            return request(`/api/projects/${encodeURIComponent(id)}/join`, {
                method: "POST",
                body: { message: message || "" }
            });
        },

        async decideJoinRequest(projectId, userId, status) {
            return request(
                `/api/projects/${encodeURIComponent(projectId)}/join-requests/${encodeURIComponent(userId)}`,
                { method: "PUT", body: { status } }
            );
        },

        async leaveProject(projectId, userId) {
            return request(
                `/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
                { method: "DELETE" }
            );
        },

        // Skill exchange ---------------------------------------------------
        async listSkillExchanges(box) {
            return request(`/api/skill-exchange${query({ box })}`);
        },

        async skillMatches(mutualOnly = true) {
            return request(
                `/api/skill-exchange/matches${query({ mutualOnly })}`
            );
        },

        async createSkillExchange(payload) {
            return request("/api/skill-exchange", {
                method: "POST",
                body: payload
            });
        },

        async updateSkillExchange(id, updates) {
            return request(`/api/skill-exchange/${encodeURIComponent(id)}`, {
                method: "PUT",
                body: updates
            });
        },

        async deleteSkillExchange(id) {
            return request(`/api/skill-exchange/${encodeURIComponent(id)}`, {
                method: "DELETE"
            });
        },

        // Messages ---------------------------------------------------------
        async messageThreads() {
            return request("/api/messages/threads");
        },

        async conversation(userId) {
            return request(`/api/messages/${encodeURIComponent(userId)}`);
        },

        async sendMessage(receiverId, content) {
            return request("/api/messages", {
                method: "POST",
                body: { receiverId, content }
            });
        },

        async markMessageRead(id) {
            return request(`/api/messages/${encodeURIComponent(id)}/read`, {
                method: "PUT"
            });
        },

        // Feedback ---------------------------------------------------------
        async submitFeedback(payload) {
            return request("/api/feedback", { method: "POST", body: payload });
        },

        async myFeedback() {
            return request("/api/feedback");
        },

        async feedbackStats() {
            return request("/api/feedback/stats");
        },

        // Saved people -----------------------------------------------------
        async listSavedPeople() {
            return request("/api/saved-people");
        },

        async savePerson(savedStudentId) {
            return request("/api/saved-people", {
                method: "POST",
                body: { savedStudentId }
            });
        },

        async removeSavedPerson(id) {
            return request(`/api/saved-people/${encodeURIComponent(id)}`, {
                method: "DELETE"
            });
        },

        // Utility ----------------------------------------------------------
        async health() {
            return request("/api/health", { auth: false });
        }
    };

    // ---------------------------------------------------------------------
    // Small view helpers used by several pages
    // ---------------------------------------------------------------------

    function escapeHtml(value) {
        return String(value === undefined || value === null ? "" : value).replace(
            /[&<>"']/g,
            character =>
                ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;"
                })[character]
        );
    }

    function formatDate(value, options) {
        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "";

        return date.toLocaleDateString([], options || {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }

    function courseLabel(person) {
        const parts = [person.course, person.year].filter(Boolean);

        return parts.join(" · ") || "SkillMate student";
    }

    window.SkillMate = {
        api,
        ApiError,
        adaptUser,
        saveUser,
        getUser,
        getToken,
        setToken,
        clearSession,
        requireAuth,
        initials: initialsOf,
        escapeHtml,
        formatDate,
        courseLabel
    };
})();
