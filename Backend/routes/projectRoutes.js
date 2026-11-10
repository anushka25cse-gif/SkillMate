"use strict";

/**
 * Project CRUD + team management.
 *
 *   GET    /api/projects                       list / search / filter
 *   GET    /api/projects/:id                   one project with people
 *   POST   /api/projects                       create (creator = you)
 *   PUT    /api/projects/:id                   edit (creator only)
 *   DELETE /api/projects/:id                   delete (creator only)
 *   POST   /api/projects/:id/join              request to join
 *   PUT    /api/projects/:id/join-requests/:userId   accept / reject (creator)
 *   DELETE /api/projects/:id/members/:userId   leave or remove a member
 */

const express = require("express");

const config = require("../config");
const db = require("../db");
const validate = require("../utils/validate");
const {
    asyncHandler,
    badRequest,
    conflict,
    forbidden,
    notFound
} = require("../utils/errors");
const { toSummary } = require("../utils/users");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate);

const PROJECT_STATUSES = [
    "Open",
    "Looking for teammates",
    "Idea stage",
    "New project idea",
    "In progress",
    "Completed",
    "Closed"
];

const JOIN_STATUSES = ["pending", "accepted", "rejected"];

/** Expand a stored project with creator + member summaries. */
function presentProject(project, usersById, viewerId) {
    const creator = usersById.get(project.creatorId);
    const members = (project.teamMembers || [])
        .map(id => usersById.get(id))
        .filter(Boolean)
        .map(toSummary);

    const joinRequests = (project.joinRequests || []).map(request => ({
        userId: request.userId,
        status: request.status,
        message: request.message || "",
        person: usersById.has(request.userId)
            ? toSummary(usersById.get(request.userId))
            : { id: request.userId, name: "Deleted student" },
        createdAt: request.createdAt || null,
        updatedAt: request.updatedAt || null
    }));

    const myRequest = (project.joinRequests || []).find(
        request => request.userId === viewerId
    );

    return {
        id: project.id,
        title: project.title,
        description: project.description,
        category: project.category,
        requiredSkills: project.requiredSkills || [],
        creatorId: project.creatorId,
        creator: creator ? toSummary(creator) : null,
        teamMembers: project.teamMembers || [],
        members,
        teamSize: project.teamSize || Math.max(members.length, 1),
        status: project.status || "Open",
        emoji: project.emoji || "✦",
        joinRequests,
        isCreator: project.creatorId === viewerId,
        isMember: (project.teamMembers || []).includes(viewerId),
        hasPendingRequest: Boolean(myRequest && myRequest.status === "pending"),
        createdAt: project.createdAt || null,
        updatedAt: project.updatedAt || null
    };
}

async function loadUsersMap() {
    const users = await db.readAll("users");
    return new Map(users.map(user => [user.id, user]));
}

// ---------------------------------------------------------------------------
// GET /api/projects
// ---------------------------------------------------------------------------
router.get(
    "/",
    asyncHandler(async (req, res) => {
        const search = String(req.query.search || req.query.q || "")
            .trim()
            .toLowerCase();
        const category = String(req.query.category || "").trim().toLowerCase();
        const skill = String(req.query.skill || "").trim().toLowerCase();
        const status = String(req.query.status || "").trim().toLowerCase();
        const creatorId = String(req.query.creatorId || "").trim();
        const memberId = String(req.query.memberId || "").trim();
        const mine = validate.boolean(req.query.mine, "mine", false);
        const sort = String(req.query.sort || "recent").toLowerCase();

        const [projects, usersById] = await Promise.all([
            db.readAll("projects"),
            loadUsersMap()
        ]);

        let result = projects.filter(project => {
            if (mine && project.creatorId !== req.user.id) return false;
            if (creatorId && project.creatorId !== creatorId) return false;
            if (memberId && !(project.teamMembers || []).includes(memberId)) return false;

            if (category && String(project.category || "").toLowerCase() !== category) {
                return false;
            }

            if (status && String(project.status || "").toLowerCase() !== status) {
                return false;
            }

            if (skill) {
                const skills = (project.requiredSkills || []).map(item =>
                    String(item).toLowerCase()
                );

                if (!skills.includes(skill)) return false;
            }

            if (search) {
                const haystack = [
                    project.title,
                    project.description,
                    project.category,
                    ...(project.requiredSkills || [])
                ]
                    .join(" ")
                    .toLowerCase();

                if (!haystack.includes(search)) return false;
            }

            return true;
        });

        if (sort === "title") {
            result = result.sort((a, b) => String(a.title).localeCompare(String(b.title)));
        } else {
            result = result.sort(
                (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
            );
        }

        res.json({
            success: true,
            count: result.length,
            projects: result.map(project =>
                presentProject(project, usersById, req.user.id)
            )
        });
    })
);

// ---------------------------------------------------------------------------
// GET /api/projects/:id
// ---------------------------------------------------------------------------
router.get(
    "/:id",
    asyncHandler(async (req, res) => {
        const id = validate.id(req.params.id);

        const [project, usersById] = await Promise.all([
            db.findById("projects", id),
            loadUsersMap()
        ]);

        if (!project) {
            throw notFound("No project was found with that id.");
        }

        res.json({
            success: true,
            project: presentProject(project, usersById, req.user.id)
        });
    })
);

// ---------------------------------------------------------------------------
// POST /api/projects
// ---------------------------------------------------------------------------
router.post(
    "/",
    asyncHandler(async (req, res) => {
        const body = req.body || {};

        validate.assertObject(body);

        const title = validate.text(body.title, "title", {
            required: true,
            max: 160,
            label: "project title"
        });

        const description = validate.text(body.description, "description", {
            required: true,
            max: config.limits.longText,
            label: "description"
        });

        const category = validate.text(body.category, "category", {
            required: true,
            max: config.limits.skillLength,
            label: "category"
        });

        const requiredSkills = validate.stringList(
            body.requiredSkills ?? body.skills,
            "requiredSkills"
        ) || [];

        const status = body.status === undefined
            ? "Open"
            : validate.oneOf(body.status, "status", PROJECT_STATUSES, {
                label: "status"
            });

        const teamSize = validate.integer(body.teamSize, "teamSize", {
            min: 1,
            max: 50
        }) || Math.max(requiredSkills.length > 0 ? 2 : 1, 2);

        const timestamp = validate.now();

        const project = {
            id: db.newId("project"),
            title,
            description,
            category,
            requiredSkills,
            creatorId: req.user.id,
            teamMembers: [req.user.id],
            teamSize,
            status: status || "Open",
            emoji: validate.text(body.emoji, "emoji", { max: 8, label: "emoji" }) || "✦",
            joinRequests: [],
            createdAt: timestamp,
            updatedAt: timestamp
        };

        await db.insert("projects", project);

        const usersById = await loadUsersMap();

        res.status(201).json({
            success: true,
            message: "Project created successfully.",
            project: presentProject(project, usersById, req.user.id)
        });
    })
);

// ---------------------------------------------------------------------------
// PUT /api/projects/:id  (creator only)
// ---------------------------------------------------------------------------
router.put(
    "/:id",
    asyncHandler(async (req, res) => {
        const id = validate.id(req.params.id);
        const body = req.body || {};

        validate.assertObject(body);

        const project = await db.findById("projects", id);

        if (!project) {
            throw notFound("No project was found with that id.");
        }

        if (project.creatorId !== req.user.id) {
            throw forbidden("Only the project creator can edit this project.");
        }

        const updates = {};

        const setText = (field, options) => {
            const value = validate.text(body[field], field, options);

            if (value !== undefined && value !== "") updates[field] = value;
        };

        setText("title", { max: 160, label: "project title" });
        setText("description", { max: config.limits.longText, label: "description" });
        setText("category", { max: config.limits.skillLength, label: "category" });
        setText("emoji", { max: 8, label: "emoji" });

        const requiredSkills = validate.stringList(
            body.requiredSkills ?? body.skills,
            "requiredSkills"
        );

        if (requiredSkills !== undefined) updates.requiredSkills = requiredSkills;

        if (body.status !== undefined) {
            updates.status = validate.oneOf(body.status, "status", PROJECT_STATUSES, {
                required: true,
                label: "status"
            });
        }

        if (body.teamSize !== undefined) {
            updates.teamSize = validate.integer(body.teamSize, "teamSize", {
                min: 1,
                max: 50,
                required: true
            });
        }

        updates.updatedAt = validate.now();

        const updated = await db.update("projects", id, updates);
        const usersById = await loadUsersMap();

        res.json({
            success: true,
            message: "Project updated successfully.",
            project: presentProject(updated, usersById, req.user.id)
        });
    })
);

// ---------------------------------------------------------------------------
// DELETE /api/projects/:id  (creator only)
// ---------------------------------------------------------------------------
router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
        const id = validate.id(req.params.id);

        const project = await db.findById("projects", id);

        if (!project) {
            throw notFound("No project was found with that id.");
        }

        if (project.creatorId !== req.user.id) {
            throw forbidden("Only the project creator can delete this project.");
        }

        await db.remove("projects", id);

        res.json({
            success: true,
            message: "Project deleted successfully."
        });
    })
);

// ---------------------------------------------------------------------------
// POST /api/projects/:id/join  (request to join)
// ---------------------------------------------------------------------------
router.post(
    "/:id/join",
    asyncHandler(async (req, res) => {
        const id = validate.id(req.params.id);
        const message = validate.text(req.body && req.body.message, "message", {
            max: 400,
            label: "message"
        }) || "";

        const project = await db.findById("projects", id);

        if (!project) {
            throw notFound("No project was found with that id.");
        }

        if (project.creatorId === req.user.id) {
            throw conflict("You created this project.");
        }

        const updated = await db.mutate("projects", records => {
            const target = records.find(record => record.id === id);

            if (!target) {
                throw notFound("No project was found with that id.");
            }

            if ((target.teamMembers || []).includes(req.user.id)) {
                throw conflict("You are already a member of this project.");
            }

            target.joinRequests = Array.isArray(target.joinRequests)
                ? target.joinRequests
                : [];

            const existing = target.joinRequests.find(
                request => request.userId === req.user.id
            );

            if (existing && existing.status === "pending") {
                throw conflict("You have already asked to join this project.");
            }

            const timestamp = validate.now();

            if (existing) {
                existing.status = "pending";
                existing.message = message;
                existing.createdAt = timestamp;
                existing.updatedAt = timestamp;
            } else {
                target.joinRequests.push({
                    userId: req.user.id,
                    status: "pending",
                    message,
                    createdAt: timestamp,
                    updatedAt: timestamp
                });
            }

            target.updatedAt = timestamp;

            return target;
        });

        const usersById = await loadUsersMap();

        res.status(201).json({
            success: true,
            message: "Join request sent to the project creator.",
            project: presentProject(updated, usersById, req.user.id)
        });
    })
);

// ---------------------------------------------------------------------------
// PUT /api/projects/:id/join-requests/:userId  (creator decides)
// ---------------------------------------------------------------------------
router.put(
    "/:id/join-requests/:userId",
    asyncHandler(async (req, res) => {
        const id = validate.id(req.params.id);
        const userId = validate.id(req.params.userId, "userId");

        validate.assertObject(req.body);

        const decision = validate.oneOf(req.body.status, "status", JOIN_STATUSES, {
            required: true,
            label: "status"
        });

        if (decision === "pending") {
            throw badRequest('"status" must be "accepted" or "rejected".');
        }

        const project = await db.findById("projects", id);

        if (!project) {
            throw notFound("No project was found with that id.");
        }

        if (project.creatorId !== req.user.id) {
            throw forbidden("Only the project creator can manage join requests.");
        }

        const updated = await db.mutate("projects", records => {
            const target = records.find(record => record.id === id);

            const request = (target.joinRequests || []).find(
                item => item.userId === userId
            );

            if (!request) {
                throw notFound("No join request from this student was found.");
            }

            const timestamp = validate.now();

            request.status = decision;
            request.updatedAt = timestamp;

            target.teamMembers = Array.isArray(target.teamMembers)
                ? target.teamMembers
                : [];

            if (decision === "accepted") {
                if ((target.teamMembers || []).length >= (target.teamSize || 50)) {
                    throw conflict("This project team is already full.");
                }

                if (!target.teamMembers.includes(userId)) {
                    target.teamMembers.push(userId);
                }
            }

            target.updatedAt = timestamp;

            return target;
        });

        const usersById = await loadUsersMap();

        res.json({
            success: true,
            message:
                decision === "accepted"
                    ? "Student added to the project team."
                    : "Join request rejected.",
            project: presentProject(updated, usersById, req.user.id)
        });
    })
);

// ---------------------------------------------------------------------------
// DELETE /api/projects/:id/members/:userId  (leave / remove)
// ---------------------------------------------------------------------------
router.delete(
    "/:id/members/:userId",
    asyncHandler(async (req, res) => {
        const id = validate.id(req.params.id);
        const userId = validate.id(req.params.userId, "userId");

        const project = await db.findById("projects", id);

        if (!project) {
            throw notFound("No project was found with that id.");
        }

        const isCreator = project.creatorId === req.user.id;
        const isSelf = userId === req.user.id;

        if (!isCreator && !isSelf) {
            throw forbidden("You can only leave a project yourself.");
        }

        if (project.creatorId === userId) {
            throw conflict(
                "The project creator cannot leave. Delete the project instead."
            );
        }

        if (!(project.teamMembers || []).includes(userId)) {
            throw notFound("This student is not a member of the project.");
        }

        const updated = await db.mutate("projects", records => {
            const target = records.find(record => record.id === id);

            target.teamMembers = target.teamMembers.filter(member => member !== userId);
            target.joinRequests = (target.joinRequests || []).filter(
                request => request.userId !== userId
            );
            target.updatedAt = validate.now();

            return target;
        });

        const usersById = await loadUsersMap();

        res.json({
            success: true,
            message: isSelf ? "You left the project." : "Member removed from the project.",
            project: presentProject(updated, usersById, req.user.id)
        });
    })
);

module.exports = router;
