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

describe("Skill exchange", () => {
    let server;
    let api;
    let alex;
    let blair;
    let casey;
    let dana;

    before(async () => {
        server = await startTestServer(app);
        api = createClient(server.baseUrl);

        // Alex teaches Python and wants Figma; Blair is the mirror image.
        alex = await createStudent(api, {
            name: "Alex Swap",
            skills: ["Python"],
            teachSkills: ["Python"],
            learningSkills: ["Figma"],
            interests: ["Design"]
        });

        blair = await createStudent(api, {
            name: "Blair Swap",
            skills: ["Figma"],
            teachSkills: ["Figma"],
            learningSkills: ["Python"],
            interests: ["Data"]
        });

        casey = await createStudent(api, {
            name: "Casey Unrelated",
            skills: ["Java"],
            teachSkills: ["Java"],
            learningSkills: ["Marketing"],
            interests: ["Coding"]
        });

        // One-way overlap only: Dana teaches Figma (which Alex wants) but
        // does not want to learn Python.
        dana = await createStudent(api, {
            name: "Dana One Way",
            skills: ["Figma", "Branding"],
            teachSkills: ["Figma"],
            learningSkills: ["Marketing"],
            interests: ["Branding"]
        });
    });

    after(async () => {
        await server.close();
    });

    let requestId;

    test("finds mutual skill matches", async () => {
        const response = await api("/api/skill-exchange/matches", {
            token: alex.token
        });

        assert.equal(response.status, 200);

        const match = response.body.matches.find(
            item => item.student.id === blair.id
        );

        assert.ok(match, "Blair should be a mutual match");
        assert.equal(match.isMutual, true);
        assert.deepEqual(match.theyCanTeachYou, ["Figma"]);
        assert.deepEqual(match.youCanTeachThem, ["Python"]);

        const unrelated = response.body.matches.find(
            item => item.student.id === casey.id
        );

        assert.equal(unrelated, undefined);
        assert.deepEqual(response.body.myTeachingSkills, ["Python"]);
        assert.deepEqual(response.body.myLearningSkills, ["Figma", "Design"]);
    });

    test("rejects an exchange with yourself", async () => {
        const response = await api("/api/skill-exchange", {
            method: "POST",
            token: alex.token,
            body: { matchedStudentId: alex.id }
        });

        assert.equal(response.status, 400);
    });

    test("rejects an exchange with an unknown student", async () => {
        const response = await api("/api/skill-exchange", {
            method: "POST",
            token: alex.token,
            body: { matchedStudentId: "user_missing" }
        });

        assert.equal(response.status, 404);
    });

    test("rejects an exchange with no skill overlap", async () => {
        const response = await api("/api/skill-exchange", {
            method: "POST",
            token: alex.token,
            body: { matchedStudentId: casey.id }
        });

        assert.equal(response.status, 400);
        assert.match(response.body.message, /complementary/i);
    });

    test("creates a skill exchange request", async () => {
        const response = await api("/api/skill-exchange", {
            method: "POST",
            token: alex.token,
            body: {
                matchedStudentId: blair.id,
                message: "Design for data?"
            }
        });

        assert.equal(response.status, 201);
        assert.equal(response.body.request.status, "pending");
        assert.deepEqual(response.body.request.skillsToTeach, ["Python"]);
        assert.deepEqual(response.body.request.skillsToLearn, ["Figma"]);
        assert.equal(response.body.request.direction, "sent");

        requestId = response.body.request.id;
    });

    test("prevents duplicate active requests", async () => {
        const response = await api("/api/skill-exchange", {
            method: "POST",
            token: alex.token,
            body: { matchedStudentId: blair.id }
        });

        assert.equal(response.status, 409);
    });

    test("lists sent and received requests", async () => {
        const sent = await api("/api/skill-exchange?box=sent", {
            token: alex.token
        });

        assert.equal(sent.body.sent.length, 1);
        assert.equal(sent.body.received.length, 0);

        const received = await api("/api/skill-exchange?box=received", {
            token: blair.token
        });

        assert.equal(received.body.received.length, 1);
        assert.equal(received.body.received[0].direction, "received");
    });

    test("only the recipient can accept", async () => {
        const blocked = await api(`/api/skill-exchange/${requestId}`, {
            method: "PUT",
            token: alex.token,
            body: { status: "accepted" }
        });

        assert.equal(blocked.status, 403);

        const accepted = await api(`/api/skill-exchange/${requestId}`, {
            method: "PUT",
            token: blair.token,
            body: { status: "accepted" }
        });

        assert.equal(accepted.status, 200);
        assert.equal(accepted.body.request.status, "accepted");
    });

    test("only the owner can edit skills", async () => {
        const blocked = await api(`/api/skill-exchange/${requestId}`, {
            method: "PUT",
            token: blair.token,
            body: { skillsToTeach: ["Something"] }
        });

        assert.equal(blocked.status, 403);
    });

    test("an accepted exchange cannot be cancelled or deleted", async () => {
        const cancel = await api(`/api/skill-exchange/${requestId}`, {
            method: "PUT",
            token: alex.token,
            body: { status: "cancelled" }
        });

        assert.equal(cancel.status, 409);

        const remove = await api(`/api/skill-exchange/${requestId}`, {
            method: "DELETE",
            token: alex.token
        });

        assert.equal(remove.status, 409);
    });

    test("a pending request can be cancelled and deleted", async () => {
        const created = await api("/api/skill-exchange", {
            method: "POST",
            token: alex.token,
            body: { matchedStudentId: dana.id }
        });

        assert.equal(created.status, 201);
        assert.equal(created.body.request.isMutual, undefined);
        assert.deepEqual(created.body.request.skillsToLearn, ["Figma"]);

        const deleted = await api(`/api/skill-exchange/${created.body.request.id}`, {
            method: "DELETE",
            token: alex.token
        });

        assert.equal(deleted.status, 200);

        const remaining = await api("/api/skill-exchange?box=sent", {
            token: alex.token
        });

        assert.ok(
            !remaining.body.sent.some(
                request => request.matchedStudentId === dana.id
            )
        );
    });

    test("requires authentication", async () => {
        const response = await api("/api/skill-exchange/matches");

        assert.equal(response.status, 401);
    });
});
