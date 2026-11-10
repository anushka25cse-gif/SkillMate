"use strict";

/**
 * Student profile routes.
 *
 *   GET /api/profiles      discoverable students, with search + filters
 *   GET /api/profiles/:id  one student's public profile
 *   PUT /api/profiles/:id  update your own profile
 *
 * Password material and other students' email addresses are never returned.
 */

const express = require("express");

const config = require("../config");
const db = require("../db");
const validate = require("../utils/validate");
const { asyncHandler, badRequest, notFound } = require("../utils/errors");
const { toPublicUser, toSelf } = require("../utils/users");
const { compareStudents } = require("../utils/matching");
const {
    findConnection,
    describeConnection,
    findSaved
} = require("../utils/relationships");
const { authenticate, requireSelf } = require("../middleware/authMiddleware");

const router = express.Router();

/** Everything a viewer is allowed to know about another student. */
function buildProfile(viewer, student, connections, savedRecords) {
    const match = compareStudents(viewer, student);
    const relationship = describeConnection(
        findConnection(connections, viewer.id, student.id),
        viewer.id
    );
    const saved = findSaved(savedRecords, viewer.id, student.id);

    return {
        ...toPublicUser(student),
        matchScore: match.score,
        match: {
            theyCanTeachYou: match.theyCanTeachYou,
            youCanTeachThem: match.youCanTeachThem,
            sharedSkills: match.sharedSkills,
            isMutual: match.isMutual
        },
        relationship,
        saved: Boolean(saved),
        savedRecordId: saved ? saved.id : null
    };
}

function matchesSearch(student, term) {
    if (!term) return true;

    const haystack = [
        student.name,
        student.course,
        student.year,
        student.college,
        student.bio,
        ...(student.skills || []),
        ...(student.teachSkills || []),
        ...(student.interests || [])
    ]
        .join(" ")
        .toLowerCase();

    return haystack.includes(term);
}

function matchesSkill(student, skill) {
    if (!skill) return true;

    const wanted = skill.toLowerCase();

    return [...(student.skills || []), ...(student.teachSkills || [])].some(
        item => String(item).toLowerCase() === wanted
    );
}

// ---------------------------------------------------------------------------
// GET /api/profiles
// ---------------------------------------------------------------------------
router.get(
    "/",
    authenticate,
    asyncHandler(async (req, res) => {
        const search = String(req.query.search || req.query.q || "")
            .trim()
            .toLowerCase();
        const course = String(req.query.course || "").trim().toLowerCase();
        const year = String(req.query.year || "").trim().toLowerCase();
        const skill = String(req.query.skill || "").trim();
        const sort = String(req.query.sort || "match").toLowerCase();
        const excludeSelf = validate.boolean(req.query.excludeSelf, "excludeSelf", true);
        const includeIncomplete = validate.boolean(
            req.query.includeIncomplete,
            "includeIncomplete",
            false
        );
        const limit = validate.integer(req.query.limit, "limit", {
            min: 1,
            max: 100
        }) || 50;
        const offset = validate.integer(req.query.offset, "offset", {
            min: 0,
            max: 10_000
        }) || 0;

        const [users, connections, savedRecords] = await Promise.all([
            db.readAll("users"),
            db.readAll("connections"),
            db.readAll("savedPeople")
        ]);

        let profiles = users.filter(student => {
            if (excludeSelf && student.id === req.user.id) return false;
            if (!includeIncomplete && student.profileCompleted === false) return false;
            if (course && String(student.course || "").toLowerCase() !== course) return false;
            if (year && String(student.year || "").toLowerCase() !== year) return false;
            if (!matchesSkill(student, skill)) return false;

            return matchesSearch(student, search);
        });

        profiles = profiles.map(student =>
            buildProfile(req.user, student, connections, savedRecords)
        );

        if (sort === "name") {
            profiles.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sort === "recent") {
            profiles.sort(
                (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
            );
        } else {
            profiles.sort((a, b) => b.matchScore - a.matchScore);
        }

        const total = profiles.length;
        const page = profiles.slice(offset, offset + limit);

        res.json({
            success: true,
            count: page.length,
            total,
            profiles: page
        });
    })
);

// ---------------------------------------------------------------------------
// GET /api/profiles/:id
// ---------------------------------------------------------------------------
router.get(
    "/:id",
    authenticate,
    asyncHandler(async (req, res) => {
        const id = validate.id(req.params.id);

        const [student, connections, savedRecords] = await Promise.all([
            db.findById("users", id),
            db.readAll("connections"),
            db.readAll("savedPeople")
        ]);

        if (!student) {
            throw notFound("No student was found with that id.");
        }

        const isSelf = student.id === req.user.id;

        res.json({
            success: true,
            profile: isSelf
                ? { ...toSelf(student), isSelf: true }
                : { ...buildProfile(req.user, student, connections, savedRecords), isSelf: false }
        });
    })
);

// ---------------------------------------------------------------------------
// PUT /api/profiles/:id  (self only)
// ---------------------------------------------------------------------------
router.put(
    "/:id",
    authenticate,
    requireSelf("id"),
    asyncHandler(async (req, res) => {
        const body = req.body || {};

        validate.assertObject(body);

        const updates = {};

        const setText = (field, options = {}) => {
            const value = validate.text(body[field], field, options);

            if (value !== undefined) updates[field] = value;
        };

        setText("name", { max: config.limits.name, label: "full name" });
        setText("course", { max: config.limits.shortText, label: "course" });
        setText("college", { max: config.limits.shortText, label: "college" });
        setText("registration", { max: config.limits.shortText, label: "registration number" });
        setText("graduation", { max: config.limits.shortText, label: "graduation year" });
        setText("year", { max: 40, label: "year" });
        setText("bio", { max: config.limits.bio, label: "bio" });
        setText("proficiency", { max: config.limits.shortText, label: "proficiency" });
        setText("availability", { max: config.limits.shortText, label: "availability" });
        setText("collaboration", { max: config.limits.shortText, label: "collaboration style" });

        const skills = validate.stringList(body.skills ?? body.knownSkills, "skills");
        const teachSkills = validate.stringList(body.teachSkills, "teachSkills");
        const learningSkills = validate.stringList(body.learningSkills, "learningSkills");
        const interests = validate.stringList(body.interests, "interests");

        if (skills !== undefined) updates.skills = skills;
        if (teachSkills !== undefined) updates.teachSkills = teachSkills;
        if (learningSkills !== undefined) updates.learningSkills = learningSkills;
        if (interests !== undefined) updates.interests = interests;

        if (body.profileImage !== undefined) {
            const image = validate.text(body.profileImage, "profileImage", {
                max: 3_000_000,
                label: "profile image"
            });

            if (image && !/^(data:image\/|https?:\/\/)/i.test(image)) {
                throw badRequest(
                    "The profile image must be an uploaded image or an https URL."
                );
            }

            updates.profileImage = image || "";
        }

        if (body.profileCompleted !== undefined) {
            updates.profileCompleted = validate.boolean(
                body.profileCompleted,
                "profileCompleted"
            );
        }

        if (body.name !== undefined && !updates.name) {
            throw badRequest("Your name cannot be empty.");
        }

        updates.updatedAt = validate.now();

        const updated = await db.update("users", req.user.id, updates);

        res.json({
            success: true,
            message: "Profile updated successfully.",
            user: toSelf(updated)
        });
    })
);

module.exports = router;
