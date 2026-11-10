"use strict";

/**
 * Skill compatibility engine shared by Discover, Skill Exchange and the
 * dashboard recommendations.
 *
 * Compatibility is intentionally simple and explainable:
 *
 *   score = 40
 *         + 15 per skill the other student can teach that I want to learn (max 30)
 *         + 10 per skill I can teach that the other student wants to learn (max 20)
 *         +  2 per skill we both already know (max 8)
 *
 * A result is capped at 99 so a "perfect" score is never claimed by a simple
 * keyword match, and floored at 25 so weak matches still display sensibly.
 */

const MAX_TEACH_SCORE = 30;
const MAX_LEARN_SCORE = 20;
const MAX_SHARED_SCORE = 8;

function uniqueList(value) {
    const list = Array.isArray(value) ? value : [];
    const seen = new Set();
    const result = [];

    for (const item of list) {
        const cleaned = String(item || "").trim();

        if (!cleaned) continue;

        const key = cleaned.toLowerCase();

        if (seen.has(key)) continue;

        seen.add(key);
        result.push(cleaned);
    }

    return result;
}

/** Lowercase lookup map: "machine learning" -> "Machine Learning". */
function indexByLowercase(list) {
    const map = new Map();

    for (const item of uniqueList(list)) {
        map.set(item.toLowerCase(), item);
    }

    return map;
}

/** Skills a student says they want to learn (learning goals + interests). */
function wantsToLearn(user) {
    return uniqueList([
        ...(Array.isArray(user && user.learningSkills) ? user.learningSkills : []),
        ...(Array.isArray(user && user.interests) ? user.interests : [])
    ]);
}

/** Skills a student can teach. Falls back to known skills when unset. */
function canTeach(user) {
    const explicit = uniqueList(user && user.teachSkills);
    return explicit.length > 0 ? explicit : uniqueList(user && user.skills);
}

/**
 * Compare two students.
 *
 * @returns {{
 *   score: number,
 *   theyCanTeachYou: string[],
 *   youCanTeachThem: string[],
 *   sharedSkills: string[],
 *   isMutual: boolean
 * }}
 */
function compareStudents(me, other) {
    const mine = {
        skills: indexByLowercase(me && me.skills),
        teaching: indexByLowercase(canTeach(me)),
        learning: indexByLowercase(wantsToLearn(me))
    };

    const theirs = {
        skills: indexByLowercase(other && other.skills),
        teaching: indexByLowercase(canTeach(other)),
        learning: indexByLowercase(wantsToLearn(other))
    };

    // What they can teach that I want to learn.
    const theyCanTeachYou = [];

    for (const [key, display] of theirs.teaching) {
        if (mine.learning.has(key) && !mine.skills.has(key)) {
            theyCanTeachYou.push(display);
        }
    }

    // What I can teach that they want to learn.
    const youCanTeachThem = [];

    for (const [key, display] of mine.teaching) {
        if (theirs.learning.has(key) && !theirs.skills.has(key)) {
            youCanTeachThem.push(display);
        }
    }

    const sharedSkills = [];

    for (const [key, display] of theirs.skills) {
        if (mine.skills.has(key)) {
            sharedSkills.push(display);
        }
    }

    const teachPoints = Math.min(MAX_TEACH_SCORE, theyCanTeachYou.length * 15);
    const learnPoints = Math.min(MAX_LEARN_SCORE, youCanTeachThem.length * 10);
    const sharedPoints = Math.min(MAX_SHARED_SCORE, sharedSkills.length * 2);

    const raw = 40 + teachPoints + learnPoints + sharedPoints;

    return {
        score: Math.max(25, Math.min(99, Math.round(raw))),
        theyCanTeachYou,
        youCanTeachThem,
        sharedSkills,
        isMutual: theyCanTeachYou.length > 0 && youCanTeachThem.length > 0
    };
}

module.exports = {
    compareStudents,
    canTeach,
    wantsToLearn,
    uniqueList
};
