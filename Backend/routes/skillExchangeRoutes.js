"use strict";

/**
 * Skill exchange (Skill Swap) routes.
 *
 *   GET    /api/skill-exchange            requests you sent / received
 *   GET    /api/skill-exchange/matches    students with complementary skills
 *   POST   /api/skill-exchange            create an exchange request
 *   PUT    /api/skill-exchange/:id        accept, decline, cancel or edit
 *   DELETE /api/skill-exchange/:id        delete your own pending request
 */

const express = require("express");

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
const { compareStudents, canTeach, wantsToLearn } = require("../utils/matching");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate);

const STATUS = Object.freeze({
    PENDING: "pending",
    ACCEPTED: "accepted",
    DECLINED: "declined",
    CANCELLED: "cancelled"
});

function presentRequest(request, usersById, viewerId) {
    const owner = usersById.get(request.studentId);
    const partner = usersById.get(request.matchedStudentId);
    const isOwner = request.studentId === viewerId;

    return {
        id: request.id,
        studentId: request.studentId,
        student: owner ? toSummary(owner) : { id: request.studentId, name: "Deleted student" },
        matchedStudentId: request.matchedStudentId,
        matchedStudent: partner
            ? toSummary(partner)
            : { id: request.matchedStudentId, name: "Deleted student" },
        skillsToTeach: request.skillsToTeach || [],
        skillsToLearn: request.skillsToLearn || [],
        message: request.message || "",
        status: request.status,
        direction: isOwner ? "sent" : "received",
        isOwner,
        createdAt: request.createdAt || null,
        updatedAt: request.updatedAt || null
    };
}

async function loadUsersMap() {
    const users = await db.readAll("users");
    return new Map(users.map(user => [user.id, user]));
}

// ---------------------------------------------------------------------------
// GET /api/skill-exchange
// ---------------------------------------------------------------------------
router.get(
    "/",
    asyncHandler(async (req, res) => {
        const box = String(req.query.box || "all").toLowerCase();

        if (!["all", "sent", "received"].includes(box)) {
            throw badRequest('"box" must be one of: all, sent, received.');
        }

        const [requests, usersById] = await Promise.all([
            db.readAll("skillExchange"),
            loadUsersMap()
        ]);

        const mine = requests.filter(
            request =>
                request.studentId === req.user.id ||
                request.matchedStudentId === req.user.id
        );

        const build = filter =>
            mine
                .filter(filter)
                .map(request => presentRequest(request, usersById, req.user.id))
                .sort(
                    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
                );

        const sent = build(request => request.studentId === req.user.id);
        const received = build(
            request => request.matchedStudentId === req.user.id
        );

        res.json({
            success: true,
            sent: box === "received" ? [] : sent,
            received: box === "sent" ? [] : received,
            counts: {
                sent: sent.length,
                received: received.length,
                pending: [...sent, ...received].filter(
                    request => request.status === STATUS.PENDING
                ).length,
                accepted: [...sent, ...received].filter(
                    request => request.status === STATUS.ACCEPTED
                ).length
            }
        });
    })
);

// ---------------------------------------------------------------------------
// GET /api/skill-exchange/matches
// ---------------------------------------------------------------------------
router.get(
    "/matches",
    asyncHandler(async (req, res) => {
        const mutualOnly = validate.boolean(req.query.mutualOnly, "mutualOnly", true);

        const [users, requests] = await Promise.all([
            db.readAll("users"),
            db.readAll("skillExchange")
        ]);

        const activePartnerIds = new Set(
            requests
                .filter(
                    request =>
                        request.studentId === req.user.id &&
                        [STATUS.PENDING, STATUS.ACCEPTED].includes(request.status)
                )
                .map(request => request.matchedStudentId)
        );

        const matches = users
            .filter(user => user.id !== req.user.id)
            .map(user => {
                const comparison = compareStudents(req.user, user);

                return {
                    student: toSummary(user),
                    teaches: canTeach(user),
                    wants: wantsToLearn(user),
                    score: comparison.score,
                    isMutual: comparison.isMutual,
                    theyCanTeachYou: comparison.theyCanTeachYou,
                    youCanTeachThem: comparison.youCanTeachThem,
                    sharedSkills: comparison.sharedSkills,
                    alreadyRequested: activePartnerIds.has(user.id)
                };
            })
            .filter(match => (mutualOnly ? match.isMutual : match.score >= 40))
            .sort((a, b) => b.score - a.score);

        res.json({
            success: true,
            count: matches.length,
            myTeachingSkills: canTeach(req.user),
            myLearningSkills: wantsToLearn(req.user),
            matches
        });
    })
);

// ---------------------------------------------------------------------------
// POST /api/skill-exchange
// ---------------------------------------------------------------------------
router.post(
    "/",
    asyncHandler(async (req, res) => {
        const body = req.body || {};

        validate.assertObject(body);

        const matchedStudentId = validate.id(
            body.matchedStudentId ?? body.studentId,
            "matchedStudentId"
        );

        if (matchedStudentId === req.user.id) {
            throw badRequest("You cannot create a skill exchange with yourself.");
        }

        const target = await db.findById("users", matchedStudentId);

        if (!target) {
            throw notFound("The student you want to swap skills with does not exist.");
        }

        const comparison = compareStudents(req.user, target);

        // A request only makes sense when at least one side has a skill the
        // other wants. The client may narrow the lists, but it cannot invent
        // an exchange out of unrelated skills.
        if (
            comparison.theyCanTeachYou.length === 0 &&
            comparison.youCanTeachThem.length === 0
        ) {
            throw badRequest(
                "There is no complementary skill overlap with this student yet. Add skills to your profile or choose a different student."
            );
        }

        const skillsToLearn = validate.stringList(
            body.skillsToLearn,
            "skillsToLearn"
        ) || comparison.theyCanTeachYou;

        const skillsToTeach = validate.stringList(
            body.skillsToTeach,
            "skillsToTeach"
        ) || comparison.youCanTeachThem;

        const message = validate.text(body.message, "message", {
            max: 600,
            label: "message"
        }) || "";

        const record = await db.mutate("skillExchange", records => {
            const existing = records.find(
                request =>
                    (request.studentId === req.user.id &&
                        request.matchedStudentId === matchedStudentId) ||
                    (request.studentId === matchedStudentId &&
                        request.matchedStudentId === req.user.id)
            );

            const timestamp = validate.now();

            if (
                existing &&
                [STATUS.PENDING, STATUS.ACCEPTED].includes(existing.status)
            ) {
                throw conflict(
                    existing.status === STATUS.ACCEPTED
                        ? "You already have an accepted skill exchange with this student."
                        : "You already have a pending skill exchange request with this student."
                );
            }

            if (existing) {
                existing.studentId = req.user.id;
                existing.matchedStudentId = matchedStudentId;
                existing.skillsToTeach = skillsToTeach;
                existing.skillsToLearn = skillsToLearn;
                existing.message = message;
                existing.status = STATUS.PENDING;
                existing.updatedAt = timestamp;

                return existing;
            }

            const created = {
                id: db.newId("swap"),
                studentId: req.user.id,
                skillsToTeach,
                skillsToLearn,
                matchedStudentId,
                message,
                status: STATUS.PENDING,
                createdAt: timestamp,
                updatedAt: timestamp
            };

            records.push(created);

            return created;
        });

        const usersById = await loadUsersMap();

        res.status(201).json({
            success: true,
            message: "Skill exchange request sent.",
            request: presentRequest(record, usersById, req.user.id)
        });
    })
);

// ---------------------------------------------------------------------------
// PUT /api/skill-exchange/:id
// ---------------------------------------------------------------------------
router.put(
    "/:id",
    asyncHandler(async (req, res) => {
        const id = validate.id(req.params.id);
        const body = req.body || {};

        validate.assertObject(body);

        const request = await db.findById("skillExchange", id);

        if (!request) {
            throw notFound("No skill exchange request was found with that id.");
        }

        const isOwner = request.studentId === req.user.id;
        const isPartner = request.matchedStudentId === req.user.id;

        if (!isOwner && !isPartner) {
            throw forbidden("This skill exchange request does not belong to you.");
        }

        const updates = {};

        if (body.skillsToTeach !== undefined) {
            if (!isOwner) {
                throw forbidden("Only the student who created the request can edit it.");
            }

            updates.skillsToTeach =
                validate.stringList(body.skillsToTeach, "skillsToTeach") || [];
        }

        if (body.skillsToLearn !== undefined) {
            if (!isOwner) {
                throw forbidden("Only the student who created the request can edit it.");
            }

            updates.skillsToLearn =
                validate.stringList(body.skillsToLearn, "skillsToLearn") || [];
        }

        if (body.message !== undefined) {
            if (!isOwner) {
                throw forbidden("Only the student who created the request can edit it.");
            }

            updates.message =
                validate.text(body.message, "message", { max: 600, label: "message" }) || "";
        }

        if (body.status !== undefined) {
            const nextStatus = validate.oneOf(
                body.status,
                "status",
                [STATUS.PENDING, STATUS.ACCEPTED, STATUS.DECLINED, STATUS.CANCELLED],
                { required: true, label: "status" }
            );

            if (nextStatus === STATUS.CANCELLED) {
                if (!isOwner) {
                    throw forbidden("Only the student who created the request can cancel it.");
                }

                if (request.status === STATUS.ACCEPTED) {
                    throw conflict("An accepted exchange cannot be cancelled here.");
                }
            } else if (nextStatus === STATUS.ACCEPTED || nextStatus === STATUS.DECLINED) {
                if (!isPartner) {
                    throw forbidden(
                        "Only the student who received the request can accept or decline it."
                    );
                }

                if (request.status !== STATUS.PENDING) {
                    throw conflict(`A ${request.status} request cannot be answered.`);
                }
            } else if (nextStatus === STATUS.PENDING) {
                if (request.status !== STATUS.CANCELLED && request.status !== STATUS.DECLINED) {
                    throw conflict("This request is already active.");
                }
            }

            updates.status = nextStatus;
        }

        if (Object.keys(updates).length === 0) {
            throw badRequest("Provide at least one field to update.");
        }

        updates.updatedAt = validate.now();

        const updated = await db.update("skillExchange", id, updates);
        const usersById = await loadUsersMap();

        res.json({
            success: true,
            message: "Skill exchange request updated.",
            request: presentRequest(updated, usersById, req.user.id)
        });
    })
);

// ---------------------------------------------------------------------------
// DELETE /api/skill-exchange/:id
// ---------------------------------------------------------------------------
router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
        const id = validate.id(req.params.id);

        const request = await db.findById("skillExchange", id);

        if (!request) {
            throw notFound("No skill exchange request was found with that id.");
        }

        if (request.studentId !== req.user.id) {
            throw forbidden("Only the student who created the request can delete it.");
        }

        if (request.status === STATUS.ACCEPTED) {
            throw conflict(
                "An accepted exchange cannot be deleted. Cancel it from the exchange page instead."
            );
        }

        await db.remove("skillExchange", id);

        res.json({
            success: true,
            message: "Skill exchange request deleted."
        });
    })
);

module.exports = router;
