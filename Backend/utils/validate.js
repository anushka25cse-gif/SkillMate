"use strict";

/**
 * Validation helpers.
 *
 * Every helper either returns a clean value or throws an `AppError` with a
 * 400 status, which keeps route handlers short and consistent.
 */

const { badRequest } = require("./errors");
const config = require("../config");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SKILL_SPLIT = /[,;]/;

function fail(field, message) {
    throw badRequest(message, { field });
}

function assertObject(value, label = "request body") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw badRequest(`The ${label} must be a JSON object.`);
    }

    return value;
}

/**
 * Read a required or optional string.
 */
function text(value, field, options = {}) {
    const {
        required = false,
        min = 0,
        max = config.limits.longText,
        label = field
    } = options;

    if (value === undefined || value === null) {
        if (required) fail(field, `"${label}" is required.`);
        return undefined;
    }

    if (typeof value !== "string" && typeof value !== "number") {
        fail(field, `"${label}" must be text.`);
    }

    const cleaned = String(value).trim();

    if (required && cleaned.length === 0) {
        fail(field, `"${label}" is required.`);
    }

    if (cleaned.length > 0 && cleaned.length < min) {
        fail(field, `"${label}" must be at least ${min} characters long.`);
    }

    if (cleaned.length > max) {
        fail(field, `"${label}" must be ${max} characters or fewer.`);
    }

    return cleaned;
}

function email(value, field = "email", { required = true } = {}) {
    const cleaned = text(value, field, {
        required,
        max: config.limits.email,
        label: "email address"
    });

    if (cleaned === undefined) return undefined;

    const normalized = cleaned.toLowerCase();

    if (!EMAIL_PATTERN.test(normalized)) {
        fail(field, "Please enter a valid email address.");
    }

    return normalized;
}

function password(value, field = "password") {
    if (typeof value !== "string" || value.length === 0) {
        fail(field, "Please enter a password.");
    }

    if (value.length < config.limits.passwordMin) {
        fail(
            field,
            `Password must be at least ${config.limits.passwordMin} characters long.`
        );
    }

    if (value.length > config.limits.password) {
        fail(field, `Password must be ${config.limits.password} characters or fewer.`);
    }

    return value;
}

function oneOf(value, field, allowed, { required = false, label = field } = {}) {
    if (value === undefined || value === null || value === "") {
        if (required) fail(field, `"${label}" is required.`);
        return undefined;
    }

    const cleaned = String(value).trim();

    if (!allowed.includes(cleaned)) {
        fail(field, `"${label}" must be one of: ${allowed.join(", ")}.`);
    }

    return cleaned;
}

/**
 * Accept an array of strings, or a comma/semicolon separated string.
 * Duplicates are removed case-insensitively while the first spelling wins.
 */
function stringList(value, field, options = {}) {
    const {
        required = false,
        maxItems = config.limits.skills,
        maxLength = config.limits.skillLength,
        label = field
    } = options;

    if (value === undefined || value === null || value === "") {
        if (required) fail(field, `"${label}" is required.`);
        return undefined;
    }

    let items;

    if (Array.isArray(value)) {
        items = value;
    } else if (typeof value === "string") {
        items = value.split(SKILL_SPLIT);
    } else {
        fail(field, `"${label}" must be a list of text values.`);
    }

    if (items.length > maxItems) {
        fail(field, `"${label}" can contain at most ${maxItems} items.`);
    }

    const seen = new Set();
    const cleaned = [];

    for (const item of items) {
        if (item === null || item === undefined) continue;

        if (typeof item !== "string" && typeof item !== "number") {
            fail(field, `"${label}" must only contain text values.`);
        }

        const entry = String(item).trim();

        if (!entry) continue;

        if (entry.length > maxLength) {
            fail(field, `Each entry in "${label}" must be ${maxLength} characters or fewer.`);
        }

        const key = entry.toLowerCase();

        if (!seen.has(key)) {
            seen.add(key);
            cleaned.push(entry);
        }
    }

    if (required && cleaned.length === 0) {
        fail(field, `"${label}" must contain at least one item.`);
    }

    return cleaned;
}

function integer(value, field, options = {}) {
    const { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER, required = false, label = field } = options;

    if (value === undefined || value === null || value === "") {
        if (required) fail(field, `"${label}" is required.`);
        return undefined;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed)) {
        fail(field, `"${label}" must be a whole number.`);
    }

    if (parsed < min || parsed > max) {
        fail(field, `"${label}" must be between ${min} and ${max}.`);
    }

    return parsed;
}

function boolean(value, field, fallback = false) {
    if (value === undefined || value === null) return fallback;
    if (typeof value === "boolean") return value;

    if (typeof value === "string") {
        if (["true", "1", "yes"].includes(value.toLowerCase())) return true;
        if (["false", "0", "no"].includes(value.toLowerCase())) return false;
    }

    if (typeof value === "number") return value !== 0;

    fail(field, `"${field}" must be true or false.`);
}

function id(value, field = "id") {
    const cleaned = text(value, field, {
        required: true,
        max: 120,
        label: field
    });

    // Ids are opaque, but they must stay filesystem/URL safe.
    if (!/^[A-Za-z0-9._:-]+$/.test(cleaned)) {
        fail(field, `"${field}" contains invalid characters.`);
    }

    return cleaned;
}

/** Normalise a value for case-insensitive comparison. */
function normalize(value) {
    return String(value || "").trim().toLowerCase();
}

/** ISO timestamp helper so every record uses the same format. */
function now() {
    return new Date().toISOString();
}

module.exports = {
    assertObject,
    text,
    email,
    password,
    oneOf,
    stringList,
    integer,
    boolean,
    id,
    normalize,
    now,
    EMAIL_PATTERN
};
