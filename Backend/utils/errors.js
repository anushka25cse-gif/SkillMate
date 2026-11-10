"use strict";

/**
 * Small error helpers shared by every route.
 *
 * `AppError` carries the HTTP status code that the central error middleware
 * should use, so route handlers can simply `throw badRequest("...")`.
 */

class AppError extends Error {
    constructor(statusCode, message, details) {
        super(message);

        this.name = "AppError";
        this.statusCode = statusCode;
        this.details = details;
        this.isOperational = true;

        Error.captureStackTrace(this, AppError);
    }
}

const badRequest = (message, details) => new AppError(400, message, details);
const unauthorized = message => new AppError(401, message);
const forbidden = message => new AppError(403, message);
const notFound = message => new AppError(404, message);
const conflict = (message, details) => new AppError(409, message, details);
const tooManyRequests = message => new AppError(429, message);

/**
 * Wrap an async route handler so rejected promises reach Express' error
 * middleware. Express 5 already supports this, but wrapping keeps the code
 * explicit and safe if the project is ever pinned to Express 4.
 */
function asyncHandler(handler) {
    return function wrapped(req, res, next) {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
}

module.exports = {
    AppError,
    badRequest,
    unauthorized,
    forbidden,
    notFound,
    conflict,
    tooManyRequests,
    asyncHandler
};
