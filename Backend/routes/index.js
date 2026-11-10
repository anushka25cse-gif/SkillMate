"use strict";

/**
 * API router.
 *
 * Every feature lives in its own module so this file stays a simple map of the
 * public API surface. Mounted by app.js at /api.
 */

const express = require("express");

const authRoutes = require("./authRoutes");
const profileRoutes = require("./profileRoutes");
const connectionRoutes = require("./connectionRoutes");
const projectRoutes = require("./projectRoutes");
const skillExchangeRoutes = require("./skillExchangeRoutes");
const otherRoutes = require("./otherRoutes");

const router = express.Router();

router.get("/", (req, res) => {
    res.json({
        success: true,
        service: "SkillMate API",
        version: "2.0.0",
        documentation: "Backend/docs/API_DOCUMENTATION.md",
        endpoints: {
            auth: [
                "POST /api/auth/register",
                "POST /api/auth/login",
                "GET /api/auth/me",
                "POST /api/auth/logout"
            ],
            profiles: [
                "GET /api/profiles",
                "GET /api/profiles/:id",
                "PUT /api/profiles/:id"
            ],
            connections: [
                "GET /api/connections",
                "POST /api/connections",
                "PUT /api/connections/:id/accept",
                "PUT /api/connections/:id/reject",
                "DELETE /api/connections/:id"
            ],
            projects: [
                "GET /api/projects",
                "GET /api/projects/:id",
                "POST /api/projects",
                "PUT /api/projects/:id",
                "DELETE /api/projects/:id",
                "POST /api/projects/:id/join",
                "PUT /api/projects/:id/join-requests/:userId",
                "DELETE /api/projects/:id/members/:userId"
            ],
            skillExchange: [
                "GET /api/skill-exchange",
                "GET /api/skill-exchange/matches",
                "POST /api/skill-exchange",
                "PUT /api/skill-exchange/:id",
                "DELETE /api/skill-exchange/:id"
            ],
            messages: [
                "POST /api/messages",
                "GET /api/messages/threads",
                "GET /api/messages/:userId",
                "PUT /api/messages/:id/read"
            ],
            feedback: [
                "POST /api/feedback",
                "GET /api/feedback",
                "GET /api/feedback/stats"
            ],
            savedPeople: [
                "POST /api/saved-people",
                "GET /api/saved-people",
                "DELETE /api/saved-people/:id"
            ]
        }
    });
});

router.use("/auth", authRoutes);
router.use("/profiles", profileRoutes);
router.use("/connections", connectionRoutes);
router.use("/projects", projectRoutes);
router.use("/skill-exchange", skillExchangeRoutes);

// Messages, feedback and saved people share one module.
router.use("/", otherRoutes);

module.exports = router;
