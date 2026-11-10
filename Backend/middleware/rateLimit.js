"use strict";

/**
 * A tiny in-memory rate limiter, used for the authentication endpoints.
 *
 * It is deliberately simple: a fixed window per key (IP + route). For a
 * multi-instance deployment you would move this to Redis, but for a single
 * Node process behind a demo this stops password guessing effectively.
 */

const { tooManyRequests } = require("../utils/errors");

function createRateLimiter({ windowMs, max, message, enabled = true }) {
    const hits = new Map();

    // Drop expired buckets periodically so the map cannot grow forever.
    const sweeper = setInterval(() => {
        const now = Date.now();

        for (const [key, bucket] of hits) {
            if (bucket.resetAt <= now) hits.delete(key);
        }
    }, Math.max(windowMs, 60_000));

    // Never keep the Node process alive just for the sweeper.
    if (typeof sweeper.unref === "function") sweeper.unref();

    return function rateLimit(req, res, next) {
        if (!enabled) return next();

        const key = `${req.ip}|${req.baseUrl}${req.path}`;
        const now = Date.now();
        const bucket = hits.get(key);

        if (!bucket || bucket.resetAt <= now) {
            hits.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }

        bucket.count += 1;

        if (bucket.count > max) {
            const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);

            res.setHeader("Retry-After", String(retryAfter));

            return next(
                tooManyRequests(
                    message ||
                        `Too many attempts. Please try again in ${retryAfter} seconds.`
                )
            );
        }

        return next();
    };
}

module.exports = { createRateLimiter };
