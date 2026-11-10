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

describe("Messages, feedback and saved people", () => {
    let server;
    let api;
    let alex;
    let blair;
    let casey;
    let firstMessageId;

    before(async () => {
        server = await startTestServer(app);
        api = createClient(server.baseUrl);

        alex = await createStudent(api, { name: "Alex Chat" });
        blair = await createStudent(api, { name: "Blair Chat" });
        casey = await createStudent(api, { name: "Casey Chat" });
    });

    after(async () => {
        await server.close();
    });

    test("blocks messaging a student you are not connected with", async () => {
        const response = await api("/api/messages", {
            method: "POST",
            token: alex.token,
            body: { receiverId: blair.id, content: "Hello there" }
        });

        assert.equal(response.status, 403);
        assert.match(response.body.message, /connected/i);
    });

    test("connects Alex and Blair", async () => {
        const request = await api("/api/connections", {
            method: "POST",
            token: alex.token,
            body: { receiverId: blair.id }
        });

        const accepted = await api(
            `/api/connections/${request.body.connection.id}/accept`,
            { method: "PUT", token: blair.token }
        );

        assert.equal(accepted.status, 200);
    });

    test("sends a message between connected students", async () => {
        const response = await api("/api/messages", {
            method: "POST",
            token: alex.token,
            body: { receiverId: blair.id, content: "Hello there" }
        });

        assert.equal(response.status, 201);
        assert.equal(response.body.data.senderId, alex.id);
        assert.equal(response.body.data.receiverId, blair.id);
        assert.equal(response.body.data.read, false);

        firstMessageId = response.body.data.id;

        const reply = await api("/api/messages", {
            method: "POST",
            token: blair.token,
            body: { receiverId: alex.id, content: "Hi Alex!" }
        });

        assert.equal(reply.status, 201);
    });

    test("rejects an empty message", async () => {
        const response = await api("/api/messages", {
            method: "POST",
            token: alex.token,
            body: { receiverId: blair.id, content: "   " }
        });

        assert.equal(response.status, 400);
    });

    test("rejects messaging yourself", async () => {
        const response = await api("/api/messages", {
            method: "POST",
            token: alex.token,
            body: { receiverId: alex.id, content: "Note to self" }
        });

        assert.equal(response.status, 400);
    });

    test("returns the conversation in chronological order", async () => {
        const response = await api(`/api/messages/${blair.id}`, {
            token: alex.token
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.messages.length, 2);
        assert.equal(response.body.messages[0].content, "Hello there");
        assert.equal(response.body.messages[0].mine, true);
        assert.equal(response.body.messages[1].mine, false);
        assert.equal(response.body.person.id, blair.id);
    });

    test("blocks reading a conversation you are not part of", async () => {
        const response = await api(`/api/messages/${blair.id}`, {
            token: casey.token
        });

        assert.equal(response.status, 403);
    });

    test("lists threads with unread counts", async () => {
        const response = await api("/api/messages/threads", {
            token: blair.token
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.threads.length, 1);
        assert.equal(response.body.threads[0].person.id, alex.id);
        assert.equal(response.body.threads[0].unreadCount, 1);
        assert.equal(response.body.threads[0].lastMessage.mine, true);
    });

    test("marks a message as read for the receiver only", async () => {
        const blocked = await api(`/api/messages/${firstMessageId}/read`, {
            method: "PUT",
            token: alex.token
        });

        assert.equal(blocked.status, 403);

        const marked = await api(`/api/messages/${firstMessageId}/read`, {
            method: "PUT",
            token: blair.token
        });

        assert.equal(marked.status, 200);
        assert.equal(marked.body.data.read, true);

        const threads = await api("/api/messages/threads", {
            token: blair.token
        });

        assert.equal(threads.body.threads[0].unreadCount, 0);
    });

    /* ------------------------------------------------------------------ */
    /* Feedback                                                            */
    /* ------------------------------------------------------------------ */

    test("validates the feedback rating", async () => {
        for (const rating of [0, 6, "five"]) {
            const response = await api("/api/feedback", {
                method: "POST",
                token: alex.token,
                body: { rating, category: "Platform", comments: "Test" }
            });

            assert.equal(response.status, 400, `rating ${rating} should fail`);
        }
    });

    test("requires comments", async () => {
        const response = await api("/api/feedback", {
            method: "POST",
            token: alex.token,
            body: { rating: 4, category: "Platform", comments: "   " }
        });

        assert.equal(response.status, 400);
    });

    test("submits feedback and lists only your own", async () => {
        const created = await api("/api/feedback", {
            method: "POST",
            token: alex.token,
            body: {
                rating: 5,
                category: "Skill Exchange",
                comments: "Great matches!"
            }
        });

        assert.equal(created.status, 201);
        assert.equal(created.body.feedback.studentId, alex.id);

        const mine = await api("/api/feedback", { token: alex.token });

        assert.equal(mine.body.count, 1);
        assert.equal(mine.body.feedback[0].comments, "Great matches!");

        const other = await api("/api/feedback", { token: blair.token });

        assert.equal(other.body.count, 0);
    });

    test("returns aggregate feedback statistics without comments", async () => {
        await api("/api/feedback", {
            method: "POST",
            token: blair.token,
            body: { rating: 3, category: "Platform", comments: "It is okay." }
        });

        const response = await api("/api/feedback/stats", {
            token: casey.token
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.stats.total, 2);
        assert.equal(response.body.stats.average, 4);
        assert.ok(!JSON.stringify(response.body).includes("Great matches!"));
    });

    /* ------------------------------------------------------------------ */
    /* Saved people                                                        */
    /* ------------------------------------------------------------------ */

    let savedId;

    test("saves a student", async () => {
        const response = await api("/api/saved-people", {
            method: "POST",
            token: alex.token,
            body: { savedStudentId: blair.id }
        });

        assert.equal(response.status, 201);
        assert.equal(response.body.saved.person.id, blair.id);

        savedId = response.body.saved.id;
    });

    test("prevents duplicates", async () => {
        const response = await api("/api/saved-people", {
            method: "POST",
            token: alex.token,
            body: { savedStudentId: blair.id }
        });

        assert.equal(response.status, 409);
    });

    test("prevents saving yourself", async () => {
        const response = await api("/api/saved-people", {
            method: "POST",
            token: alex.token,
            body: { savedStudentId: alex.id }
        });

        assert.equal(response.status, 400);
    });

    test("returns 404 for an unknown student", async () => {
        const response = await api("/api/saved-people", {
            method: "POST",
            token: alex.token,
            body: { savedStudentId: "user_missing" }
        });

        assert.equal(response.status, 404);
    });

    test("lists saved students", async () => {
        const response = await api("/api/saved-people", { token: alex.token });

        assert.equal(response.status, 200);
        assert.equal(response.body.count, 1);
        assert.equal(response.body.saved[0].savedStudentId, blair.id);
    });

    test("only the owner can remove a saved student", async () => {
        const blocked = await api(`/api/saved-people/${savedId}`, {
            method: "DELETE",
            token: casey.token
        });

        assert.equal(blocked.status, 403);

        const removed = await api(`/api/saved-people/${savedId}`, {
            method: "DELETE",
            token: alex.token
        });

        assert.equal(removed.status, 200);

        const list = await api("/api/saved-people", { token: alex.token });

        assert.equal(list.body.count, 0);
    });

    test("requires authentication", async () => {
        const response = await api("/api/saved-people");

        assert.equal(response.status, 401);
    });
});
