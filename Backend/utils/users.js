"use strict";

/**
 * User shapes returned by the API.
 *
 * Password material never leaves the backend. Email addresses are only shown
 * to the student themselves, so a discovery list cannot be scraped for
 * contact details.
 */

function fullName(user) {
    return user.name || user.fullName || "SkillMate student";
}

/** Shape returned for the logged-in student. */
function toSelf(user) {
    if (!user) return null;

    return {
        id: user.id,
        name: fullName(user),
        email: user.email,
        course: user.course || "",
        year: user.year === undefined ? "" : user.year,
        college: user.college || "",
        registration: user.registration || "",
        graduation: user.graduation || "",
        skills: Array.isArray(user.skills) ? user.skills : [],
        teachSkills: Array.isArray(user.teachSkills) ? user.teachSkills : [],
        learningSkills: Array.isArray(user.learningSkills) ? user.learningSkills : [],
        interests: Array.isArray(user.interests) ? user.interests : [],
        bio: user.bio || "",
        profileImage: user.profileImage || "",
        proficiency: user.proficiency || "",
        availability: user.availability || "",
        collaboration: user.collaboration || "",
        profileCompleted: Boolean(user.profileCompleted),
        createdAt: user.createdAt || null,
        updatedAt: user.updatedAt || null
    };
}

/** Shape returned for other students (no email, no password material). */
function toPublicUser(user, options = {}) {
    if (!user) return null;

    const { includeEmail = false } = options;

    const publicUser = {
        id: user.id,
        name: fullName(user),
        course: user.course || "",
        year: user.year === undefined ? "" : user.year,
        college: user.college || "",
        skills: Array.isArray(user.skills) ? user.skills : [],
        teachSkills: Array.isArray(user.teachSkills) ? user.teachSkills : [],
        learningSkills: Array.isArray(user.learningSkills) ? user.learningSkills : [],
        interests: Array.isArray(user.interests) ? user.interests : [],
        bio: user.bio || "",
        profileImage: user.profileImage || "",
        availability: user.availability || "",
        collaboration: user.collaboration || ""
    };

    if (includeEmail) {
        publicUser.email = user.email;
    }

    return publicUser;
}

/** Very small shape used inside connection / project lists. */
function toSummary(user) {
    if (!user) return null;

    const name = fullName(user);

    return {
        id: user.id,
        name,
        initials: initialsOf(name),
        course: user.course || "",
        year: user.year === undefined ? "" : user.year,
        college: user.college || "",
        skills: Array.isArray(user.skills) ? user.skills.slice(0, 4) : [],
        bio: user.bio || "",
        profileImage: user.profileImage || ""
    };
}

function initialsOf(name) {
    return String(name || "Student")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0].toUpperCase())
        .join("");
}

module.exports = {
    toSelf,
    toPublicUser,
    toSummary,
    initialsOf
};
