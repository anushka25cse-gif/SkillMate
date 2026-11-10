"use strict";

/**
 * Authentication middleware.
 *
 * Tokens are JWTs signed with HS256. The token only carries the user id, the
 * email and the name; the authoritative record is always re-read from
 * User.json, so a deleted or edited account takes effect immediately.
 */

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const config = require("../config");
const db = require("../db");
const { unauthorized, forbidden } = require("../utils/errors");
const { toSelf } = require("../utils/users");

const BCRYPT_PATTERN = /^\$2[aby]\$/;

/** Hash a new password with bcrypt. */
async function hashPassword(plainPassword) {
    return bcrypt.hash(plainPassword, config.bcryptRounds);
}

/**
 * Verify a password against either a bcrypt hash (current scheme) or the
 * legacy scrypt hash that the first version of the backend created.
 */
async function verifyPassword(plainPassword, user) {
    if (!user || !user.passwordHash) return false;

    if (BCRYPT_PATTERN.test(user.passwordHash)) {
        return bcrypt.compare(plainPassword, user.passwordHash);
    }

    // Legacy accounts: scrypt(password, salt) stored as hex.
    if (user.passwordSalt) {
        const derived = crypto.scryptSync(
            plainPassword,
            user.passwordSalt,
            64
        );

        const stored = Buffer.from(user.passwordHash, "hex");

        if (stored.length !== derived.length) return false;

        return crypto.timingSafeEqual(stored, derived);
    }

    return false;
}

/** True when the stored hash uses the old scheme and should be upgraded. */
function needsRehash(user) {
    return Boolean(
        user &&
        user.passwordHash &&
        !BCRYPT_PATTERN.test(user.passwordHash)
    );
}

function signToken(user) {
    return jwt.sign(
        {
            sub: user.id,
            email: user.email,
            name: user.name || user.fullName || ""
        },
        config.jwtSecret,
        {
            expiresIn: config.jwtExpiresIn,
            issuer: config.jwtIssuer
        }
    );
}

function readBearerToken(req) {
    const header = req.headers.authorization || "";

    const match = /^Bearer\s+(.+)$/i.exec(header.trim());

    return match ? match[1].trim() : null;
}

/**
 * Require a valid token. Attaches `req.user` (raw record) and `req.userId`.
 */
async function authenticate(req, res, next) {
    const token = readBearerToken(req);

    if (!token) {
        return next(unauthorized("Authentication required. Please sign in."));
    }

    let payload;

    try {
        payload = jwt.verify(token, config.jwtSecret, {
            issuer: config.jwtIssuer
        });
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return next(unauthorized("Your session has expired. Please sign in again."));
        }

        return next(unauthorized("Your session is not valid. Please sign in again."));
    }

    const user = await db.findById("users", payload.sub);

    if (!user) {
        return next(unauthorized("This account no longer exists."));
    }

    req.user = user;
    req.userId = user.id;
    req.tokenPayload = payload;

    return next();
}

/** Attach the user when a token is present, but never reject the request. */
async function optionalAuth(req, res, next) {
    const token = readBearerToken(req);

    if (!token) return next();

    try {
        const payload = jwt.verify(token, config.jwtSecret, {
            issuer: config.jwtIssuer
        });

        const user = await db.findById("users", payload.sub);

        if (user) {
            req.user = user;
            req.userId = user.id;
        }
    } catch (error) {
        // A bad token on a public route simply means "anonymous".
    }

    return next();
}

/** Reject the request unless the token belongs to the route's :id. */
function requireSelf(paramName = "id") {
    return function selfGuard(req, res, next) {
        if (!req.user) {
            return next(unauthorized("Authentication required. Please sign in."));
        }

        if (req.params[paramName] !== req.user.id) {
            return next(forbidden("You can only access or change your own profile."));
        }

        return next();
    };
}

/** Convenience: the logged-in student in API shape. */
function currentUser(req) {
    return toSelf(req.user);
}

module.exports = {
    hashPassword,
    verifyPassword,
    needsRehash,
    signToken,
    authenticate,
    optionalAuth,
    requireSelf,
    currentUser
};
