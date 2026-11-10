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

describe("Student profiles", () => {
    let server;
    let api;
    let aarav;
    let riya;
    let dev;

    before(async () => {
        server = await startTestServer(app);
        api = createClient(server.baseUrl);

        aarav = await createStudent(api, {
            name: "Aarav Profile",
            skills: ["Python", "HTML & CSS"],
            teachSkills: ["Python"],
            learningSkills: ["Figma"],
            interests: ["Artificial Intelligence"]
        });

        riya = await createStudent(api, {
            name: "Riya Profile",
            skills: ["Figma", "UI/UX Design"],
            teachSkills: ["Figma"],
            learningSkills: ["Python"],
            interests: ["Product Design"]
        });

        dev = await createStudent(api, {
            name: "Dev Profile",
            skills: ["Java", "C / C++"],
            teachSkills: ["Java"],
            learningSkills: ["Marketing"],
            interests: ["Coding"]
        });
    });

    after(async () => {
        await server.close();
    });

    test("requires authentication", async () => {
        const response = await api("/api/profiles");

        assert.equal(response.status, 401);
    });

    test("lists discoverable students without exposing secrets", async () => {
        const response = await api("/api/profiles", { token: aarav.token });

        assert.equal(response.status, 200);
        assert.equal(response.body.success, true);

        const ids = response.body.profiles.map(profile => profile.id);

        assert.ok(!ids.includes(aarav.id), "own profile must be excluded");
        assert.ok(ids.includes(riya.id));
        assert.ok(ids.includes(dev.id));

        for (const profile of response.body.profiles) {
            assert.equal(profile.passwordHash, undefined);
            assert.equal(profile.passwordSalt, undefined);
            assert.equal(profile.email, undefined);
            assert.equal(typeof profile.matchScore, "number");
            assert.ok(profile.relationship);
        }

        // Highest compatibility first.
        const scores = response.body.profiles.map(profile => profile.matchScore);

        assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
    });

    test("computes a mutual skill match", async () => {
        const response = await api("/api/profiles", { token: aarav.token });

        const riyaProfile = response.body.profiles.find(
            profile => profile.id === riya.id
        );

        assert.deepEqual(riyaProfile.match.theyCanTeachYou, ["Figma"]);
        assert.deepEqual(riyaProfile.match.youCanTeachThem, ["Python"]);
        assert.equal(riyaProfile.match.isMutual, true);
        assert.ok(riyaProfile.matchScore > 50);
    });

    test("searches by name, skill and course", async () => {
        const byName = await api("/api/profiles?search=Riya", {
            token: aarav.token
        });

        assert.equal(byName.body.profiles.length, 1);
        assert.equal(byName.body.profiles[0].id, riya.id);

        const bySkill = await api("/api/profiles?skill=Java", {
            token: aarav.token
        });

        assert.equal(bySkill.body.profiles.length, 1);
        assert.equal(bySkill.body.profiles[0].id, dev.id);

        const byCourse = await api("/api/profiles?course=b.tech", {
            token: aarav.token
        });

        assert.equal(byCourse.body.profiles.length, 2);
    });

    test("returns a single public profile", async () => {
        const response = await api(`/api/profiles/${riya.id}`, {
            token: aarav.token
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.profile.id, riya.id);
        assert.equal(response.body.profile.isSelf, false);
        assert.equal(response.body.profile.email, undefined);
        assert.equal(response.body.profile.saved, false);
        assert.equal(response.body.profile.relationship.status, "none");
    });

    test("returns your own profile with your email", async () => {
        const response = await api(`/api/profiles/${aarav.id}`, {
            token: aarav.token
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.profile.isSelf, true);
        assert.equal(response.body.profile.email, aarav.email);
    });

    test("returns 404 for an unknown profile", async () => {
        const response = await api("/api/profiles/user_does_not_exist", {
            token: aarav.token
        });

        assert.equal(response.status, 404);
    });

    test("rejects an id with invalid characters", async () => {
        const response = await api("/api/profiles/bad%24id", {
            token: aarav.token
        });

        assert.equal(response.status, 400);
    });

    test("updates your own profile, accepting comma separated skills", async () => {
        const response = await api(`/api/profiles/${aarav.id}`, {
            method: "PUT",
            token: aarav.token,
            body: {
                bio: "Updated bio for the test.",
                skills: "Python, SQL, HTML & CSS",
                interests: ["Analytics"]
            }
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.user.bio, "Updated bio for the test.");
        assert.deepEqual(response.body.user.skills, ["Python", "SQL", "HTML & CSS"]);
        assert.deepEqual(response.body.user.interests, ["Analytics"]);
    });

    test("blocks updating another student's profile", async () => {
        const response = await api(`/api/profiles/${riya.id}`, {
            method: "PUT",
            token: aarav.token,
            body: { bio: "Hijacked" }
        });

        assert.equal(response.status, 403);
    });

    test("rejects an invalid profile image", async () => {
        const response = await api(`/api/profiles/${aarav.id}`, {
            method: "PUT",
            token: aarav.token,
            body: { profileImage: "javascript:alert(1)" }
        });

        assert.equal(response.status, 400);
    });
});
