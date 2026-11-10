"use strict";

/**
 * Messages, feedback and saved people.
 *
 *   POST   /api/messages                        send a message to a connection
 *   GET    /api/messages/threads                conversation list + unread counts
 *   GET    /api/messages/:userId                one conversation
 *   PUT    /api/messages/:id/read               mark one message as read
 *
 *   POST   /api/feedback                        submit feedback
 *   GET    /api/feedback                        your own feedback
 *   GET    /api/feedback/stats                  aggregate rating statistics
 *
 *   POST   /api/saved-people                    save a student profile
 *   GET    /api/saved-people                    your saved students
 *   DELETE /api/saved-people/:id                remove a saved student
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
const { isAccepted } = require("../utils/relationships");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate);

/* -------------------------------------------------------------------------
 * Messages
 * ---------------------------------------------------------------------- */

/** Both students must be connected before messages are allowed. */
async function assertConnected(firstId, secondId) {
    const connections = await db.readAll("connections");

    if (!isAccepted(connections, firstId, secondId)) {
        throw forbidden(
            "You can only message students you are connected with. Send a connection request first."
        );
    }
}

// POST /api/messages
router.post(
    "/messages",
    asyncHandler(async (req, res) => {
        validate.assertObject(req.body);

        const receiverId = validate.id(req.body.receiverId, "receiverId");

        const content = validate.text(
            req.body.content ?? req.body.text,
            "content",
            {
                required: true,
                max: config.limits.message,
                label: "message"
            }
        );

        if (receiverId === req.user.id) {
            throw badRequest("You cannot send a message to yourself.");
        }

        const receiver = await db.findById("users", receiverId);

        if (!receiver) {
            throw notFound("The student you are messaging does not exist.");
        }

        await assertConnected(req.user.id, receiverId);

        const message = {
            id: db.newId("message"),
            senderId: req.user.id,
            receiverId,
            content,
            timestamp: validate.now(),
            read: false
        };

        await db.insert("messages", message);

        res.status(201).json({
            success: true,
            message: "Message sent.",
            data: {
                ...message,
                person: toSummary(receiver),
                mine: true
            }
        });
    })
);

// GET /api/messages/threads  (must stay above /:userId)
router.get(
    "/messages/threads",
    asyncHandler(async (req, res) => {
        const [messages, connections, users] = await Promise.all([
            db.readAll("messages"),
            db.readAll("connections"),
            db.readAll("users")
        ]);

        const usersById = new Map(users.map(user => [user.id, user]));

        const partnerIds = new Set();

        for (const connection of connections) {
            if (connection.status !== "accepted") continue;

            if (connection.senderId === req.user.id) partnerIds.add(connection.receiverId);
            if (connection.receiverId === req.user.id) partnerIds.add(connection.senderId);
        }

        const threads = [...partnerIds]
            .map(partnerId => {
                const partner = usersById.get(partnerId);

                if (!partner) return null;

                const thread = messages
                    .filter(
                        message =>
                            (message.senderId === req.user.id &&
                                message.receiverId === partnerId) ||
                            (message.senderId === partnerId &&
                                message.receiverId === req.user.id)
                    )
                    .sort(
                        (a, b) =>
                            new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
                    );

                const lastMessage = thread[thread.length - 1] || null;

                return {
                    person: toSummary(partner),
                    lastMessage: lastMessage
                        ? {
                            content: lastMessage.content,
                            timestamp: lastMessage.timestamp,
                            senderId: lastMessage.senderId,
                            mine: lastMessage.senderId === req.user.id
                        }
                        : null,
                    unreadCount: thread.filter(
                        message =>
                            message.receiverId === req.user.id && !message.read
                    ).length,
                    messageCount: thread.length
                };
            })
            .filter(Boolean)
            .sort((a, b) => {
                const aTime = a.lastMessage ? new Date(a.lastMessage.timestamp).getTime() : 0;
                const bTime = b.lastMessage ? new Date(b.lastMessage.timestamp).getTime() : 0;

                return bTime - aTime;
            });

        res.json({
            success: true,
            count: threads.length,
            threads
        });
    })
);

// GET /api/messages/:userId
router.get(
    "/messages/:userId",
    asyncHandler(async (req, res) => {
        const userId = validate.id(req.params.userId, "userId");

        if (userId === req.user.id) {
            throw badRequest("Choose another student to open a conversation.");
        }

        const person = await db.findById("users", userId);

        if (!person) {
            throw notFound("The student you are looking for does not exist.");
        }

        await assertConnected(req.user.id, userId);

        const messages = await db.findAll(
            "messages",
            message =>
                (message.senderId === req.user.id && message.receiverId === userId) ||
                (message.senderId === userId && message.receiverId === req.user.id)
        );

        messages.sort(
            (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
        );

        res.json({
            success: true,
            person: toSummary(person),
            count: messages.length,
            messages: messages.map(message => ({
                id: message.id,
                senderId: message.senderId,
                receiverId: message.receiverId,
                content: message.content,
                timestamp: message.timestamp,
                read: Boolean(message.read),
                mine: message.senderId === req.user.id
            }))
        });
    })
);

// PUT /api/messages/:id/read
router.put(
    "/messages/:id/read",
    asyncHandler(async (req, res) => {
        const id = validate.id(req.params.id);

        const message = await db.findById("messages", id);

        if (!message) {
            throw notFound("No message was found with that id.");
        }

        if (message.receiverId !== req.user.id) {
            throw forbidden("Only the student who received a message can mark it as read.");
        }

        if (message.read) {
            return res.json({
                success: true,
                message: "Message was already marked as read.",
                data: message
            });
        }

        const updated = await db.update("messages", id, { read: true });

        res.json({
            success: true,
            message: "Message marked as read.",
            data: updated
        });
    })
);

/* -------------------------------------------------------------------------
 * Feedback
 * ---------------------------------------------------------------------- */

// POST /api/feedback
router.post(
    "/feedback",
    asyncHandler(async (req, res) => {
        const body = req.body || {};

        validate.assertObject(body);

        const rating = validate.integer(body.rating, "rating", {
            min: 1,
            max: 5,
            required: true,
            label: "rating"
        });

        const category = validate.text(body.category, "category", {
            required: true,
            max: 60,
            label: "category"
        });

        // The dashboard form splits comments into three boxes, the feedback
        // page uses one. Accept either shape.
        const comments =
            validate.text(body.comments ?? body.feedback, "comments", {
                max: config.limits.comments,
                label: "comments"
            }) ||
            [body.liked, body.improve, body.suggestions]
                .map(value => String(value || "").trim())
                .filter(Boolean)
                .join(" | ");

        if (!comments) {
            throw badRequest("Please write at least one comment.", {
                field: "comments"
            });
        }

        const record = {
            id: db.newId("feedback"),
            studentId: req.user.id,
            rating,
            category,
            comments: comments.slice(0, config.limits.comments),
            createdAt: validate.now()
        };

        await db.insert("feedback", record);

        res.status(201).json({
            success: true,
            message: "Thank you! Your feedback has been submitted.",
            feedback: record
        });
    })
);

// GET /api/feedback/stats  (public aggregate, no comment text)
router.get(
    "/feedback/stats",
    asyncHandler(async (req, res) => {
        const feedback = await db.readAll("feedback");

        const total = feedback.length;
        const average =
            total === 0
                ? 0
                : Math.round(
                    (feedback.reduce((sum, item) => sum + Number(item.rating || 0), 0) /
                        total) *
                    10
                ) / 10;

        const byCategory = new Map();

        for (const item of feedback) {
            const key = item.category || "Other";

            if (!byCategory.has(key)) {
                byCategory.set(key, { category: key, count: 0, total: 0 });
            }

            const bucket = byCategory.get(key);

            bucket.count += 1;
            bucket.total += Number(item.rating || 0);
        }

        res.json({
            success: true,
            stats: {
                total,
                average,
                categories: [...byCategory.values()].map(bucket => ({
                    category: bucket.category,
                    count: bucket.count,
                    average: Math.round((bucket.total / bucket.count) * 10) / 10
                }))
            }
        });
    })
);

// GET /api/feedback  (your own feedback only)
router.get(
    "/feedback",
    asyncHandler(async (req, res) => {
        const feedback = await db.findAll(
            "feedback",
            item => item.studentId === req.user.id
        );

        feedback.sort(
            (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );

        res.json({
            success: true,
            count: feedback.length,
            feedback
        });
    })
);

/* -------------------------------------------------------------------------
 * Saved people
 * ---------------------------------------------------------------------- */

// POST /api/saved-people
router.post(
    "/saved-people",
    asyncHandler(async (req, res) => {
        validate.assertObject(req.body);

        const savedStudentId = validate.id(
            req.body.savedStudentId ?? req.body.studentId,
            "savedStudentId"
        );

        if (savedStudentId === req.user.id) {
            throw badRequest("You cannot save your own profile.");
        }

        const student = await db.findById("users", savedStudentId);

        if (!student) {
            throw notFound("The student you are trying to save does not exist.");
        }

        const record = await db.mutate("savedPeople", records => {
            const existing = records.find(
                item =>
                    item.userId === req.user.id &&
                    item.savedStudentId === savedStudentId
            );

            if (existing) {
                throw conflict("This student is already in your saved people.");
            }

            const created = {
                id: db.newId("saved"),
                userId: req.user.id,
                savedStudentId,
                createdAt: validate.now()
            };

            records.push(created);

            return created;
        });

        res.status(201).json({
            success: true,
            message: "Student saved.",
            saved: {
                id: record.id,
                savedStudentId: record.savedStudentId,
                person: toSummary(student),
                createdAt: record.createdAt
            }
        });
    })
);

// GET /api/saved-people
router.get(
    "/saved-people",
    asyncHandler(async (req, res) => {
        const [records, users] = await Promise.all([
            db.findAll("savedPeople", item => item.userId === req.user.id),
            db.readAll("users")
        ]);

        const usersById = new Map(users.map(user => [user.id, user]));

        const saved = records
            .map(record => {
                const student = usersById.get(record.savedStudentId);

                if (!student) return null;

                return {
                    id: record.id,
                    savedStudentId: record.savedStudentId,
                    person: toSummary(student),
                    createdAt: record.createdAt || null
                };
            })
            .filter(Boolean)
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        res.json({
            success: true,
            count: saved.length,
            saved
        });
    })
);

// DELETE /api/saved-people/:id
router.delete(
    "/saved-people/:id",
    asyncHandler(async (req, res) => {
        const id = validate.id(req.params.id);

        const record = await db.findById("savedPeople", id);

        if (!record) {
            throw notFound("No saved student was found with that id.");
        }

        if (record.userId !== req.user.id) {
            throw forbidden("This saved student does not belong to you.");
        }

        await db.remove("savedPeople", id);

        res.json({
            success: true,
            message: "Student removed from your saved people."
        });
    })
);

module.exports = router;
