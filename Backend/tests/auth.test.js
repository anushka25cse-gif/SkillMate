"use strict";

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const {
    prepareEnvironment,
    startTestServer,
    createClient,
    uniqueEmail
} = require("./helpers");

prepareEnvironment();

const { app } = require("../app");

describe("Authentication", () => {
    let server;
    let api;

    before(async () => {
        server = await startTestServer(app);
        api = createClient(server.baseUrl);
    });

    after(async () => {
        await server.close();
    });

    const email = uniqueEmail("auth.primary");

    test("registers a new student and returns a token", async () => {
        const response = await api("/api/auth/register", {
            method: "POST",
            body: {
                fullName: "Auth Primary",
                email,
                password: "secret123",
                course: "B.Tech",
                year: "2nd Year",
                college: "BML Munjal University",
                registration: "BMU001",
                graduation: "2027"
            }
        });

        assert.equal(response.status, 201);
        assert.equal(response.body.success, true);
        assert.ok(response.body.token);
        assert.equal(response.body.user.email, email);
        assert.equal(response.body.user.name, "Auth Primary");
        assert.equal(response.body.user.profileCompleted, false);

        // Secrets must never be serialised.
        assert.equal(response.body.user.passwordHash, undefined);
        assert.equal(response.body.user.passwordSalt, undefined);
    });

    test("rejects a duplicate email (case insensitive)", async () => {
        const response = await api("/api/auth/register", {
            method: "POST",
            body: {
                name: "Duplicate",
                email: email.toUpperCase(),
                password: "secret123"
            }
        });

        assert.equal(response.status, 409);
        assert.equal(response.body.success, false);
        assert.match(response.body.message, /already exists/i);
    });

    test("rejects an invalid email address", async () => {
        const response = await api("/api/auth/register", {
            method: "POST",
            body: {
                name: "Bad Email",
                email: "not-an-email",
                password: "secret123"
            }
        });

        assert.equal(response.status, 400);
        assert.equal(response.body.success, false);
    });

    test("rejects a short password", async () => {
        const response = await api("/api/auth/register", {
            method: "POST",
            body: {
                name: "Short Password",
                email: uniqueEmail("auth.short"),
                password: "123"
            }
        });

        assert.equal(response.status, 400);
        assert.match(response.body.message, /at least 6/i);
    });

    test("rejects a missing name", async () => {
        const response = await api("/api/auth/register", {
            method: "POST",
            body: {
                email: uniqueEmail("auth.noname"),
                password: "secret123"
            }
        });

        assert.equal(response.status, 400);
        assert.match(response.body.message, /required/i);
    });

    test("rejects malformed JSON with a clear message", async () => {
        const response = await api("/api/auth/register", {
            method: "POST",
            rawBody: "{ this is not json",
            headers: { "Content-Type": "application/json" }
        });

        assert.equal(response.status, 400);
        assert.match(response.body.message, /not valid JSON/i);
    });

    test("logs in with valid credentials", async () => {
        const response = await api("/api/auth/login", {
            method: "POST",
            body: { email, password: "secret123" }
        });

        assert.equal(response.status, 200);
        assert.ok(response.body.token);
        assert.equal(response.body.user.email, email);
    });

    test("rejects a wrong password", async () => {
        const response = await api("/api/auth/login", {
            method: "POST",
            body: { email, password: "wrong-password" }
        });

        assert.equal(response.status, 401);
        assert.match(response.body.message, /incorrect/i);
    });

    test("rejects an unknown email with the same message", async () => {
        const response = await api("/api/auth/login", {
            method: "POST",
            body: { email: "nobody@example.com", password: "secret123" }
        });

        assert.equal(response.status, 401);
        assert.match(response.body.message, /incorrect/i);
    });

    test("returns the current user for a valid token", async () => {
        const login = await api("/api/auth/login", {
            method: "POST",
            body: { email, password: "secret123" }
        });

        const me = await api("/api/auth/me", { token: login.body.token });

        assert.equal(me.status, 200);
        assert.equal(me.body.user.email, email);
        assert.equal(me.body.user.passwordHash, undefined);
    });

    test("blocks /me without a token", async () => {
        const response = await api("/api/auth/me");

        assert.equal(response.status, 401);
    });

    test("blocks /me with a tampered token", async () => {
        const response = await api("/api/auth/me", {
            token: "eyJhbGciOiJIUzI1NiJ9.invalid.signature"
        });

        assert.equal(response.status, 401);
    });

    test("logs out successfully", async () => {
        const login = await api("/api/auth/login", {
            method: "POST",
            body: { email, password: "secret123" }
        });

        const logout = await api("/api/auth/logout", {
            method: "POST",
            token: login.body.token
        });

        assert.equal(logout.status, 200);
        assert.equal(logout.body.success, true);
    });
});
