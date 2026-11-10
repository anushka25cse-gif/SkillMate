"use strict";

/**
 * Authentication routes.
 *
 *   POST /api/auth/register  create an account and return a token
 *   POST /api/auth/login     sign in
 *   GET  /api/auth/me        the logged-in student's profile
 *   POST /api/auth/logout    client-side token disposal
 */

const express = require("express");

const config = require("../config");
const db = require("../db");
const validate = require("../utils/validate");
const { asyncHandler, conflict, unauthorized } = require("../utils/errors");
const { toSelf } = require("../utils/users");
const { createRateLimiter } = require("../middleware/rateLimit");
const {
    authenticate,
    hashPassword,
    verifyPassword,
    needsRehash,
    signToken
} = require("../middleware/authMiddleware");

const router = express.Router();

const authLimiter = createRateLimiter({
    windowMs: config.authRateLimit.windowMs,
    max: config.authRateLimit.max,
    enabled: config.authRateLimit.enabled,
    message:
        "Too many authentication attempts from this address. Please wait a few minutes and try again."
});

const STUDENT_FIELDS = [
    "course",
    "year",
    "college",
    "registration",
    "graduation"
];

/** Build a new user record from the registration payload. */
function buildUser(body, passwordHash) {
    const timestamp = validate.now();

    return {
        id: db.newId("user"),
        name: body.name,
        email: body.email,
        passwordHash,
        course: body.course || "",
        year: body.year === undefined ? "" : body.year,
        college: body.college || "",
        registration: body.registration || "",
        graduation: body.graduation || "",
        skills: body.skills || [],
        teachSkills: body.teachSkills || [],
        learningSkills: body.learningSkills || [],
        interests: body.interests || [],
        bio: body.bio || "",
        profileImage: body.profileImage || "",
        proficiency: "",
        availability: "",
        collaboration: "",
        profileCompleted: false,
        createdAt: timestamp,
        updatedAt: timestamp
    };
}

function readRegistrationPayload(body) {
    validate.assertObject(body);

    // The existing registration form sends `fullName`; the API also accepts
    // the shorter `name` used by the data model.
    const name = validate.text(body.name ?? body.fullName, "name", {
        required: true,
        max: config.limits.name,
        label: "full name"
    });

    const email = validate.email(body.email);
    const plainPassword = validate.password(body.password);

    const payload = {
        name,
        email,
        password: plainPassword,
        skills: validate.stringList(body.skills ?? body.knownSkills, "skills"),
        teachSkills: validate.stringList(body.teachSkills, "teachSkills"),
        learningSkills: validate.stringList(body.learningSkills, "learningSkills"),
        interests: validate.stringList(body.interests, "interests"),
        bio: validate.text(body.bio, "bio", { max: config.limits.bio, label: "bio" }),
        profileImage: validate.text(body.profileImage, "profileImage", {
            max: 3_000_000,
            label: "profile image"
        })
    };

    for (const field of STUDENT_FIELDS) {
        const value = validate.text(body[field], field, {
            max: config.limits.shortText,
            label: field
        });

        if (value !== undefined) {
            payload[field] = value;
        }
    }

    if (payload.profileImage && !/^(data:image\/|https?:\/\/)/i.test(payload.profileImage)) {
        throw badRequest(
            "The profile image must be an uploaded image or an https URL.",
            { field: "profileImage" }
        );
    }

    return payload;
}

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------
router.post(
    "/register",
    authLimiter,
    asyncHandler(async (req, res) => {
        const payload = readRegistrationPayload(req.body);

        const passwordHash = await hashPassword(payload.password);
        const user = buildUser(payload, passwordHash);

        // The uniqueness check and the insert happen inside one lock so two
        // simultaneous registrations cannot both claim the same email.
        await db.mutate("users", users => {
            const existing = users.find(
                item => validate.normalize(item.email) === payload.email
            );

            if (existing) {
                throw conflict(
                    "An account with this email already exists. Please sign in instead.",
                    { field: "email" }
                );
            }

            users.push(user);
        });

        res.status(201).json({
            success: true,
            message: "Account created successfully.",
            token: signToken(user),
            user: toSelf(user)
        });
    })
);

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
router.post(
    "/login",
    authLimiter,
    asyncHandler(async (req, res) => {
        validate.assertObject(req.body);

        const email = validate.email(req.body.email);
        const plainPassword = validate.text(req.body.password, "password", {
            required: true,
            max: config.limits.password,
            label: "password"
        });

        const user = await db.findOne(
            "users",
            record => validate.normalize(record.email) === email
        );

        // Identical message for "unknown email" and "wrong password" so the
        // endpoint cannot be used to enumerate registered students.
        const invalidMessage =
            "The email ID or password is incorrect. Please try again.";

        if (!user) {
            throw unauthorized(invalidMessage);
        }

        const isValid = await verifyPassword(plainPassword, user);

        if (!isValid) {
            throw unauthorized(invalidMessage);
        }

        // Transparently upgrade legacy scrypt hashes to bcrypt.
        if (needsRehash(user)) {
            const upgraded = await hashPassword(plainPassword);

            const updated = await db.update("users", user.id, {
                passwordHash: upgraded,
                passwordSalt: undefined,
                updatedAt: validate.now()
            });

            Object.assign(user, updated);
        }

        res.json({
            success: true,
            message: "Login successful.",
            token: signToken(user),
            user: toSelf(user)
        });
    })
);

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------
router.get(
    "/me",
    authenticate,
    asyncHandler(async (req, res) => {
        res.json({
            success: true,
            user: toSelf(req.user)
        });
    })
);

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------
router.post(
    "/logout",
    authenticate,
    asyncHandler(async (req, res) => {
        // JWTs are stateless: the client removes the token. This endpoint
        // exists so the frontend has one place to call on sign-out.
        res.json({
            success: true,
            message: "Signed out. Remove the stored token on the client."
        });
    })
);

module.exports = router;
