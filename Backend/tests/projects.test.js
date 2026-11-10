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

describe("Projects", () => {
    let server;
    let api;
    let owner;
    let joiner;
    let outsider;
    let projectId;

    before(async () => {
        server = await startTestServer(app);
        api = createClient(server.baseUrl);

        owner = await createStudent(api, { name: "Owner Student" });
        joiner = await createStudent(api, { name: "Joiner Student" });
        outsider = await createStudent(api, { name: "Outsider Student" });
    });

    after(async () => {
        await server.close();
    });

    test("creates a project with the creator as first member", async () => {
        const response = await api("/api/projects", {
            method: "POST",
            token: owner.token,
            body: {
                title: "Campus Connect",
                description: "A platform for campus events.",
                category: "Web Development",
                requiredSkills: "HTML & CSS, JavaScript",
                teamSize: 3
            }
        });

        assert.equal(response.status, 201);
        assert.equal(response.body.project.title, "Campus Connect");
        assert.equal(response.body.project.creatorId, owner.id);
        assert.deepEqual(response.body.project.teamMembers, [owner.id]);
        assert.deepEqual(response.body.project.requiredSkills, [
            "HTML & CSS",
            "JavaScript"
        ]);
        assert.equal(response.body.project.isCreator, true);

        projectId = response.body.project.id;
    });

    test("validates required fields", async () => {
        const response = await api("/api/projects", {
            method: "POST",
            token: owner.token,
            body: { description: "No title", category: "Other" }
        });

        assert.equal(response.status, 400);
        assert.match(response.body.message, /title/i);
    });

    test("lists and filters projects", async () => {
        const all = await api("/api/projects", { token: joiner.token });

        assert.equal(all.status, 200);
        assert.ok(all.body.projects.some(project => project.id === projectId));

        const byCategory = await api(
            "/api/projects?category=Web%20Development",
            { token: joiner.token }
        );

        assert.equal(byCategory.body.projects.length, 1);

        const bySkill = await api("/api/projects?skill=javascript", {
            token: joiner.token
        });

        assert.equal(bySkill.body.projects.length, 1);

        const bySearch = await api("/api/projects?search=campus", {
            token: joiner.token
        });

        assert.equal(bySearch.body.projects.length, 1);

        const empty = await api("/api/projects?search=quantum", {
            token: joiner.token
        });

        assert.equal(empty.body.projects.length, 0);
    });

    test("returns a single project with people", async () => {
        const response = await api(`/api/projects/${projectId}`, {
            token: joiner.token
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.project.id, projectId);
        assert.equal(response.body.project.creator.id, owner.id);
        assert.equal(response.body.project.members[0].id, owner.id);
        assert.equal(response.body.project.isMember, false);
    });

    test("only the creator can edit", async () => {
        const blocked = await api(`/api/projects/${projectId}`, {
            method: "PUT",
            token: joiner.token,
            body: { title: "Hijacked" }
        });

        assert.equal(blocked.status, 403);

        const updated = await api(`/api/projects/${projectId}`, {
            method: "PUT",
            token: owner.token,
            body: { title: "Campus Connect 2", status: "In progress" }
        });

        assert.equal(updated.status, 200);
        assert.equal(updated.body.project.title, "Campus Connect 2");
        assert.equal(updated.body.project.status, "In progress");
    });

    test("rejects an unknown status", async () => {
        const response = await api(`/api/projects/${projectId}`, {
            method: "PUT",
            token: owner.token,
            body: { status: "Something else" }
        });

        assert.equal(response.status, 400);
    });

    test("lets another student request to join", async () => {
        const response = await api(`/api/projects/${projectId}/join`, {
            method: "POST",
            token: joiner.token,
            body: { message: "I can build the frontend." }
        });

        assert.equal(response.status, 201);
        assert.equal(response.body.project.hasPendingRequest, true);
        assert.equal(response.body.project.joinRequests.length, 1);
    });

    test("prevents duplicate join requests and creator self-join", async () => {
        const duplicate = await api(`/api/projects/${projectId}/join`, {
            method: "POST",
            token: joiner.token
        });

        assert.equal(duplicate.status, 409);

        const creator = await api(`/api/projects/${projectId}/join`, {
            method: "POST",
            token: owner.token
        });

        assert.equal(creator.status, 409);
    });

    test("only the creator can accept a join request", async () => {
        const blocked = await api(
            `/api/projects/${projectId}/join-requests/${joiner.id}`,
            { method: "PUT", token: outsider.token, body: { status: "accepted" } }
        );

        assert.equal(blocked.status, 403);

        const accepted = await api(
            `/api/projects/${projectId}/join-requests/${joiner.id}`,
            { method: "PUT", token: owner.token, body: { status: "accepted" } }
        );

        assert.equal(accepted.status, 200);
        assert.ok(accepted.body.project.teamMembers.includes(joiner.id));
    });

    test("a member can leave the project", async () => {
        const response = await api(
            `/api/projects/${projectId}/members/${joiner.id}`,
            { method: "DELETE", token: joiner.token }
        );

        assert.equal(response.status, 200);
        assert.ok(!response.body.project.teamMembers.includes(joiner.id));
    });

    test("the creator cannot leave their own project", async () => {
        const response = await api(
            `/api/projects/${projectId}/members/${owner.id}`,
            { method: "DELETE", token: owner.token }
        );

        assert.equal(response.status, 409);
    });

    test("only the creator can delete", async () => {
        const blocked = await api(`/api/projects/${projectId}`, {
            method: "DELETE",
            token: outsider.token
        });

        assert.equal(blocked.status, 403);

        const deleted = await api(`/api/projects/${projectId}`, {
            method: "DELETE",
            token: owner.token
        });

        assert.equal(deleted.status, 200);

        const missing = await api(`/api/projects/${projectId}`, {
            token: owner.token
        });

        assert.equal(missing.status, 404);
    });

    test("requires authentication", async () => {
        const response = await api("/api/projects");

        assert.equal(response.status, 401);
    });
});
