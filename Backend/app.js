"use strict";

/**
 * SkillMate application entry point.
 *
 * `server.js` (Part 1 of the project) is intentionally left untouched. This
 * file composes the full API from the modular route files, serves the existing
 * frontend from the repository root, and is what `npm start` runs.
 *
 *   npm start        -> node app.js       (full API + frontend)
 *   npm run start:legacy -> node server.js (Part 1 server, for reference)
 */

const path = require("path");
const express = require("express");
const cors = require("cors");

const config = require("./config");
const db = require("./db");
const apiRoutes = require("./routes");
const {
    notFoundHandler,
    errorHandler,
    securityHeaders
} = require("./middleware/errorMiddleware");
const { AppError } = require("./utils/errors");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", true);

// ---------------------------------------------------------------------------
// Core middleware
// ---------------------------------------------------------------------------
app.use(securityHeaders);
app.use(express.json({ limit: "6mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// CORS is only needed when the frontend is hosted on another origin. When the
// pages are served by this server, requests are same-origin and need no CORS.
const corsOptions = {
    origin(origin, callback) {
        if (!origin || origin === "null") {
            // No Origin header (curl, same-origin) or a file:// page.
            // file:// is only tolerated outside production.
            return config.isProduction && origin === "null"
                ? callback(new AppError(403, "Origin not allowed."))
                : callback(null, true);
        }

        if (config.corsOrigins.includes(origin)) {
            return callback(null, true);
        }

        if (!config.isProduction && config.corsOrigins.length === 0) {
            return callback(null, true);
        }

        return callback(new AppError(403, "Origin not allowed by CORS."));
    },
    credentials: false,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600
};

app.use(cors(corsOptions));

// Simple request log in development (skipped for static assets and tests).
if (!config.isProduction && config.nodeEnv !== "test") {
    app.use((req, res, next) => {
        if (req.path.startsWith("/api")) {
            const startedAt = Date.now();

            res.on("finish", () => {
                console.log(
                    `${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - startedAt}ms)`
                );
            });
        }

        next();
    });
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        status: "ok",
        service: "SkillMate API",
        environment: config.nodeEnv,
        uptimeSeconds: Math.round(process.uptime())
    });
});

app.use("/api", apiRoutes);

// ---------------------------------------------------------------------------
// Existing frontend (HTML/CSS/JS at the repository root)
// ---------------------------------------------------------------------------
if (config.serveFrontend) {
    // Never expose the JSON database, secrets or backups as static files.
    const blocked = ["/Backend", "/backend_backup", "/node_modules", "/tests"];

    app.use(blocked, (req, res) => {
        res.status(404).json({
            success: false,
            message: "This path is not publicly available."
        });
    });

    app.get("/", (req, res) => {
        res.redirect("/Login.html");
    });

    app.use(
        express.static(config.frontendDir, {
            index: false,
            dotfiles: "deny",
            extensions: false,
            maxAge: config.isProduction ? "1h" : 0
        })
    );
}

// ---------------------------------------------------------------------------
// 404 + errors
// ---------------------------------------------------------------------------
app.use(notFoundHandler);
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function start() {
    await db.ensureCollections();

    const server = app.listen(config.port, () => {
        console.log("");
        console.log("  SkillMate API");
        console.log(`  Server:  http://localhost:${config.port}`);
        console.log(`  API:     http://localhost:${config.port}/api`);
        console.log(`  Frontend:http://localhost:${config.port}/Login.html`);
        console.log(`  Data:    ${path.relative(process.cwd(), config.dataDir) || config.dataDir}`);
        console.log(`  Env:     ${config.nodeEnv}`);
        console.log("");
    });

    return server;
}

if (require.main === module) {
    start().catch(error => {
        console.error("[SkillMate] Failed to start:", error);
        process.exitCode = 1;
    });
}

module.exports = { app, start };
