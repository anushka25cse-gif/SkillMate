"use strict";

/**
 * Shared helpers for the automated API tests.
 *
 * `prepareEnvironment()` must run BEFORE `require("../app")` so that the
 * application reads the temporary data directory and test configuration.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { once } = require("events");

const EMPTY_COLLECTIONS = [
    "User.json",
    "Projects.json",
    "Connections.json",
    "SkillExchange.json",
    "Messages.json",
    "Feedback.json",
    "Savedpeople.json"
];

function prepareEnvironment() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "skillmate-test-"));

    for (const file of EMPTY_COLLECTIONS) {
        fs.writeFileSync(path.join(dataDir, file), "[]\n", "utf8");
    }

    process.env.SKILLMATE_DATA_DIR = dataDir;
    process.env.NODE_ENV = "test";
    process.env.AUTH_RATE_LIMIT_ENABLED = "false";
    process.env.SERVE_FRONTEND = "false";
    process.env.JWT_SECRET = "test-secret-not-used-in-production";
    process.env.BCRYPT_ROUNDS = "4"; // keep the tests fast

    return dataDir;
}

async function startTestServer(app) {
    const server = app.listen(0, "127.0.0.1");

    await once(server, "listening");

    const { port } = server.address();

    return {
        server,
        baseUrl: `http://127.0.0.1:${port}`,
        async close() {
            server.closeAllConnections?.();
            await new Promise(resolve => server.close(resolve));
        }
    };
}

function createClient(baseUrl) {
    return async function api(
        pathname,
        { method = "GET", token, body, rawBody, headers: extraHeaders } = {}
    ) {
        const headers = { ...(extraHeaders || {}) };

        let payload;

        if (rawBody !== undefined) {
            payload = rawBody;
        } else if (body !== undefined) {
            headers["Content-Type"] = "application/json";
            payload = JSON.stringify(body);
        }

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`${baseUrl}${pathname}`, {
            method,
            headers,
            body: payload
        });

        const text = await response.text();

        let json = null;

        try {
            json = text ? JSON.parse(text) : null;
        } catch (error) {
            json = { raw: text };
        }

        return { status: response.status, body: json, headers: response.headers };
    };
}

let emailCounter = 0;

function uniqueEmail(prefix = "student") {
    emailCounter += 1;
    return `${prefix}.${Date.now()}.${emailCounter}@example.com`;
}

/**
 * Register a complete student through the public API and return the token.
 */
async function createStudent(api, overrides = {}) {
    const email = overrides.email || uniqueEmail(overrides.prefix || "student");

    const registration = await api("/api/auth/register", {
        method: "POST",
        body: {
            name: overrides.name || "Test Student",
            email,
            password: overrides.password || "secret123",
            course: overrides.course || "B.Tech",
            year: overrides.year || "2nd Year",
            college: overrides.college || "BML Munjal University"
        }
    });

    if (registration.status !== 201) {
        throw new Error(
            `Could not create test student (${registration.status}): ${JSON.stringify(registration.body)}`
        );
    }

    const token = registration.body.token;
    const id = registration.body.user.id;

    const profile = await api(`/api/profiles/${id}`, {
        method: "PUT",
        token,
        body: {
            skills: overrides.skills || ["Python", "HTML & CSS"],
            teachSkills: overrides.teachSkills || ["Python"],
            learningSkills: overrides.learningSkills || ["Figma"],
            interests: overrides.interests || ["Web Development"],
            bio: overrides.bio || "Test student profile.",
            profileCompleted: true
        }
    });

    if (profile.status !== 200) {
        throw new Error(
            `Could not complete test profile (${profile.status}): ${JSON.stringify(profile.body)}`
        );
    }

    return {
        id,
        email,
        token,
        user: profile.body.user
    };
}

module.exports = {
    prepareEnvironment,
    startTestServer,
    createClient,
    createStudent,
    uniqueEmail
};
