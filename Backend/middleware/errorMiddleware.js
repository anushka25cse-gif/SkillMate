"use strict";

/**
 * 404 + central error handling.
 *
 * Error responses always have the shape:
 *   { success: false, message: "...", details?: {...} }
 *
 * Internal errors never leak stack traces to the client, but are logged on the
 * server so they can be diagnosed.
 */

const config = require("../config");

function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        message: `No route matches ${req.method} ${req.originalUrl}.`
    });
}

// eslint-disable-next-line no-unused-vars -- Express requires four arguments.
function errorHandler(error, req, res, next) {
    let statusCode = error.statusCode || error.status || 500;
    let message = error.message || "Internal server error.";
    let details = error.details;

    // Malformed JSON body.
    if (error.type === "entity.parse.failed") {
        statusCode = 400;
        message = "The request body is not valid JSON.";
    }

    // Body larger than the configured limit.
    if (error.type === "entity.too.large") {
        statusCode = 413;
        message = "The request body is too large.";
    }

    if (statusCode >= 500) {
        console.error("[SkillMate] Unhandled error:", {
            method: req.method,
            url: req.originalUrl,
            message: error.message,
            stack: config.isProduction ? undefined : error.stack
        });

        if (config.isProduction) {
            message = "Something went wrong on the server. Please try again.";
        }
    }

    if (res.headersSent) {
        return next(error);
    }

    return res.status(statusCode).json({
        success: false,
        message,
        ...(details ? { details } : {})
    });
}

/** Small security headers, applied before the routes. */
function securityHeaders(req, res, next) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    next();
}

module.exports = {
    notFoundHandler,
    errorHandler,
    securityHeaders
};
