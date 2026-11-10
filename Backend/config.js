"use strict";

/**
 * Central configuration for the SkillMate backend.
 *
 * Every value can be overridden through environment variables so that no
 * secret has to be committed to the repository. See `.env.example`.
 */

const path = require("path");

const BACKEND_DIR = __dirname;
const PROJECT_ROOT = path.resolve(BACKEND_DIR, "..");

function toBoolean(value, fallback) {
    if (value === undefined) return fallback;
    return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function toNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toList(value) {
    return String(value || "")
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);
}

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";

const config = {
    nodeEnv,
    isProduction,

    // HTTP
    port: toNumber(process.env.PORT, 3000),

    // JSON database
    dataDir: process.env.SKILLMATE_DATA_DIR
        ? path.resolve(process.env.SKILLMATE_DATA_DIR)
        : path.join(BACKEND_DIR, "Data"),

    // Authentication
    jwtSecret: process.env.JWT_SECRET || "skillmate-insecure-development-secret",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
    jwtIssuer: "skillmate",
    bcryptRounds: toNumber(process.env.BCRYPT_ROUNDS, 10),

    // Brute-force protection for /api/auth/login and /api/auth/register
    authRateLimit: {
        windowMs: toNumber(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
        max: toNumber(process.env.AUTH_RATE_LIMIT_MAX, 20),
        enabled: toBoolean(process.env.AUTH_RATE_LIMIT_ENABLED, true)
    },

    // CORS. When the frontend is served by this server no CORS is needed at
    // all; the list is only for a separately hosted frontend.
    corsOrigins: toList(process.env.CORS_ORIGINS),

    // Static frontend hosting
    serveFrontend: toBoolean(process.env.SERVE_FRONTEND, true),
    frontendDir: PROJECT_ROOT,

    // Limits used by the validators
    limits: {
        name: 120,
        email: 200,
        password: 128,
        passwordMin: 6,
        bio: 1200,
        shortText: 200,
        longText: 2000,
        skills: 40,
        skillLength: 60,
        message: 2000,
        comments: 1500
    }
};

if (isProduction && !process.env.JWT_SECRET) {
    throw new Error(
        "JWT_SECRET must be set in production. Copy .env.example to .env and set a long random value."
    );
}

module.exports = config;
