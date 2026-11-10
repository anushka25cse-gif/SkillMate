"use strict";

/**
 * Teammate discovery + connection requests.
 *
 *   GET    /api/connections            received, sent and accepted connections
 *   POST   /api/connections            send a request
 *   PUT    /api/connections/:id/accept accept an incoming request
 *   PUT    /api/connections/:id/reject reject an incoming request
 *   DELETE /api/connections/:id        cancel a request / remove a connection
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
const { STATUS } = require("../utils/relationships");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate);

function decorate(record, viewersId, usersById) {
    const isSender = record.senderId === viewersId;
    const otherId = isSender ? record.receiverId : record.senderId;
    const other = usersById.get(otherId);

    return {
        id: record.id,
        senderId: record.senderId,
        receiverId: record.receiverId,
        status: record.status,
        direction: isSender ? "outgoing" : "incoming",
        personId: otherId,
        person: other ? toSummary(other) : { id: otherId, name: "Deleted student" },
        createdAt: record.createdAt || null,
        updatedAt: record.updatedAt || null
    };
}

// ---------------------------------------------------------------------------
// GET /api/connections
// ---------------------------------------------------------------------------
router.get(
    "/",
    asyncHandler(async (req, res) => {
        const filter = String(req.query.status || "all").toLowerCase();
        const box = String(req.query.box || "all").toLowerCase();

        if (!["all", "pending", "accepted", "rejected", "cancelled"].includes(filter)) {
            throw badRequest(
                '"status" must be one of: all, pending, accepted, rejected, cancelled.'
            );
        }

        if (!["all", "received", "sent"].includes(box)) {
            throw badRequest('"box" must be one of: all, received, sent.');
        }

        const [connections, users] = await Promise.all([
            db.readAll("connections"),
            db.readAll("users")
        ]);

        const usersById = new Map(users.map(user => [user.id, user]));

        const mine = connections.filter(
            record =>
                record.senderId === req.user.id || record.receiverId === req.user.id
        );

        const matchesStatus = record =>
            filter === "all" || record.status === filter;

        const received = mine
            .filter(record => record.receiverId === req.user.id)
            .filter(matchesStatus)
            .map(record => decorate(record, req.user.id, usersById));

        const sent = mine
            .filter(record => record.senderId === req.user.id)
            .filter(matchesStatus)
            .map(record => decorate(record, req.user.id, usersById));

        const accepted = mine
            .filter(record => record.status === STATUS.ACCEPTED)
            .map(record => decorate(record, req.user.id, usersById));

        const response = {
            success: true,
            received,
            sent,
            accepted,
            counts: {
                receivedPending: received.filter(record => record.status === STATUS.PENDING).length,
                sentPending: sent.filter(record => record.status === STATUS.PENDING).length,
                accepted: accepted.length
            }
        };

        // `box` narrows the payload for callers that only need one side.
        if (box === "received") {
            response.sent = [];
        } else if (box === "sent") {
            response.received = [];
        }

        res.json(response);
    })
);

// ---------------------------------------------------------------------------
// POST /api/connections
// ---------------------------------------------------------------------------
router.post(
    "/",
    asyncHandler(async (req, res) => {
        validate.assertObject(req.body);

        const receiverId = validate.id(req.body.receiverId, "receiverId");

        if (receiverId === req.user.id) {
            throw badRequest("You cannot send a connection request to yourself.");
        }

        const receiver = await db.findById("users", receiverId);

        if (!receiver) {
            throw notFound("The student you are trying to connect with does not exist.");
        }

        const result = await db.mutate("connections", records => {
            const existing = records.find(
                record =>
                    (record.senderId === req.user.id && record.receiverId === receiverId) ||
                    (record.senderId === receiverId && record.receiverId === req.user.id)
            );

            const timestamp = validate.now();

            if (existing) {
                if (existing.status === STATUS.PENDING) {
                    throw conflict(
                        existing.senderId === req.user.id
                            ? "You have already sent a request to this student."
                            : "This student has already sent you a request. Accept it from your connection requests."
                    );
                }

                if (existing.status === STATUS.ACCEPTED) {
                    throw conflict("You are already connected with this student.");
                }

                // A previous rejection or cancellation can be retried.
                existing.senderId = req.user.id;
                existing.receiverId = receiverId;
                existing.status = STATUS.PENDING;
                existing.updatedAt = timestamp;

                return existing;
            }

            const record = {
                id: db.newId("connection"),
                senderId: req.user.id,
                receiverId,
                status: STATUS.PENDING,
                createdAt: timestamp,
                updatedAt: timestamp
            };

            records.push(record);

            return record;
        });

        res.status(201).json({
            success: true,
            message: "Connection request sent.",
            connection: {
                id: result.id,
                status: result.status,
                person: toSummary(receiver),
                personId: receiver.id,
                direction: "outgoing",
                createdAt: result.createdAt,
                updatedAt: result.updatedAt
            }
        });
    })
);

/** Load a connection that the current user is part of. */
async function loadConnectionFor(id, userId) {
    const record = await db.findById("connections", id);

    if (!record) {
        throw notFound("No connection request was found with that id.");
    }

    if (record.senderId !== userId && record.receiverId !== userId) {
        throw forbidden("This connection request does not belong to you.");
    }

    return record;
}

// ---------------------------------------------------------------------------
// PUT /api/connections/:id/accept
// ---------------------------------------------------------------------------
router.put(
    "/:id/accept",
    asyncHandler(async (req, res) => {
        const id = validate.id(req.params.id);
        const record = await loadConnectionFor(id, req.user.id);

        if (record.receiverId !== req.user.id) {
            throw forbidden("Only the student who received this request can accept it.");
        }

        if (record.status === STATUS.ACCEPTED) {
            throw conflict("This connection request has already been accepted.");
        }

        if (record.status !== STATUS.PENDING) {
            throw conflict(`A ${record.status} request cannot be accepted.`);
        }

        const updated = await db.update("connections", id, {
            status: STATUS.ACCEPTED,
            updatedAt: validate.now()
        });

        const sender = await db.findById("users", updated.senderId);

        res.json({
            success: true,
            message: "Connection accepted.",
            connection: {
                id: updated.id,
                status: updated.status,
                person: toSummary(sender),
                personId: updated.senderId,
                direction: "incoming",
                createdAt: updated.createdAt,
                updatedAt: updated.updatedAt
            }
        });
    })
);

// ---------------------------------------------------------------------------
// PUT /api/connections/:id/reject
// ---------------------------------------------------------------------------
router.put(
    "/:id/reject",
    asyncHandler(async (req, res) => {
        const id = validate.id(req.params.id);
        const record = await loadConnectionFor(id, req.user.id);

        if (record.receiverId !== req.user.id) {
            throw forbidden("Only the student who received this request can reject it.");
        }

        if (record.status !== STATUS.PENDING) {
            throw conflict(`A ${record.status} request cannot be rejected.`);
        }

        const updated = await db.update("connections", id, {
            status: STATUS.REJECTED,
            updatedAt: validate.now()
        });

        res.json({
            success: true,
            message: "Connection request rejected.",
            connection: {
                id: updated.id,
                status: updated.status,
                updatedAt: updated.updatedAt
            }
        });
    })
);

// ---------------------------------------------------------------------------
// DELETE /api/connections/:id
// ---------------------------------------------------------------------------
router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
        const id = validate.id(req.params.id);
        const record = await loadConnectionFor(id, req.user.id);

        if (record.status === STATUS.PENDING && record.senderId !== req.user.id) {
            throw forbidden(
                "Only the student who sent this request can cancel it. Use reject instead."
            );
        }

        await db.remove("connections", id);

        res.json({
            success: true,
            message: "Connection removed."
        });
    })
);

module.exports = router;
