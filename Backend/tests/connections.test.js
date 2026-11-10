"use strict";

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const {
    prepareEnvironment,
    startTestServer,
    createClient,
    createStudent
} = require("./helpers");

prepareEnvironment();

const { app } = require("../app");

describe("Connections", () => {
    let server;
    let api;
    let alex;
    let blair;
    let casey;

    before(async () => {
        server = await startTestServer(app);
        api = createClient(server.baseUrl);

        alex = await createStudent(api, { name: "Alex Sender" });
        blair = await createStudent(api, { name: "Blair Receiver" });
        casey = await createStudent(api, { name: "Casey Third" });
    });

    after(async () => {
        await server.close();
    });

    let requestId;

    test("sends a connection request", async () => {
        const response = await api("/api/connections", {
            method: "POST",
            token: alex.token,
            body: { receiverId: blair.id }
        });

        assert.equal(response.status, 201);
        assert.equal(response.body.connection.status, "pending");
        assert.equal(response.body.connection.personId, blair.id);
        assert.equal(response.body.connection.direction, "outgoing");

        requestId = response.body.connection.id;
    });

    test("prevents duplicate requests", async () => {
        const response = await api("/api/connections", {
            method: "POST",
            token: alex.token,
            body: { receiverId: blair.id }
        });

        assert.equal(response.status, 409);
        assert.match(response.body.message, /already sent/i);
    });

    test("prevents a duplicate request in the opposite direction", async () => {
        const response = await api("/api/connections", {
            method: "POST",
            token: blair.token,
            body: { receiverId: alex.id }
        });

        assert.equal(response.status, 409);
        assert.match(response.body.message, /already sent you a request/i);
    });

    test("prevents self connections", async () => {
        const response = await api("/api/connections", {
            method: "POST",
            token: alex.token,
            body: { receiverId: alex.id }
        });

        assert.equal(response.status, 400);
    });

    test("returns 404 for an unknown receiver", async () => {
        const response = await api("/api/connections", {
            method: "POST",
            token: alex.token,
            body: { receiverId: "user_missing" }
        });

        assert.equal(response.status, 404);
    });

    test("shows the request in the receiver's inbox", async () => {
        const response = await api("/api/connections", { token: blair.token });

        assert.equal(response.status, 200);
        assert.equal(response.body.received.length, 1);
        assert.equal(response.body.received[0].personId, alex.id);
        assert.equal(response.body.received[0].direction, "incoming");
        assert.equal(response.body.counts.receivedPending, 1);
    });

    test("only the receiver can accept", async () => {
        const response = await api(`/api/connections/${requestId}/accept`, {
            method: "PUT",
            token: alex.token
        });

        assert.equal(response.status, 403);
    });

    test("accepts the request as the receiver", async () => {
        const response = await api(`/api/connections/${requestId}/accept`, {
            method: "PUT",
            token: blair.token
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.connection.status, "accepted");
    });

    test("lists the accepted connection for both students", async () => {
        const forAlex = await api("/api/connections?status=accepted", {
            token: alex.token
        });

        assert.equal(forAlex.body.accepted.length, 1);
        assert.equal(forAlex.body.accepted[0].personId, blair.id);

        const forBlair = await api("/api/connections", { token: blair.token });

        assert.equal(forBlair.body.accepted.length, 1);
        assert.equal(forBlair.body.accepted[0].personId, alex.id);
    });

    test("rejects a pending request", async () => {
        const created = await api("/api/connections", {
            method: "POST",
            token: casey.token,
            body: { receiverId: alex.id }
        });

        const rejected = await api(
            `/api/connections/${created.body.connection.id}/reject`,
            { method: "PUT", token: alex.token }
        );

        assert.equal(rejected.status, 200);
        assert.equal(rejected.body.connection.status, "rejected");
    });

    test("allows a new request after a rejection", async () => {
        const response = await api("/api/connections", {
            method: "POST",
            token: casey.token,
            body: { receiverId: alex.id }
        });

        assert.equal(response.status, 201);
        assert.equal(response.body.connection.status, "pending");

        const cancelled = await api(
            `/api/connections/${response.body.connection.id}`,
            { method: "DELETE", token: casey.token }
        );

        assert.equal(cancelled.status, 200);
    });

    test("a sender cannot cancel someone else's request", async () => {
        const created = await api("/api/connections", {
            method: "POST",
            token: casey.token,
            body: { receiverId: blair.id }
        });

        const response = await api(
            `/api/connections/${created.body.connection.id}`,
            { method: "DELETE", token: alex.token }
        );

        assert.equal(response.status, 403);
    });

    test("requires authentication", async () => {
        const response = await api("/api/connections");

        assert.equal(response.status, 401);
    });
});
