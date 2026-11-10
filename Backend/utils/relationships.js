"use strict";

/**
 * Helpers that describe how two students are related.
 * Used by profile, connection, message and saved-people routes so the frontend
 * always receives the same vocabulary.
 */

const STATUS = Object.freeze({
    PENDING: "pending",
    ACCEPTED: "accepted",
    REJECTED: "rejected",
    CANCELLED: "cancelled"
});

/**
 * Find the most relevant connection record between two students.
 * An accepted record wins over a pending one, which wins over a rejection.
 */
function findConnection(connections, firstId, secondId) {
    const between = connections.filter(
        record =>
            (record.senderId === firstId && record.receiverId === secondId) ||
            (record.senderId === secondId && record.receiverId === firstId)
    );

    if (between.length === 0) return null;

    const rank = {
        [STATUS.ACCEPTED]: 3,
        [STATUS.PENDING]: 2,
        [STATUS.REJECTED]: 1,
        [STATUS.CANCELLED]: 0
    };

    return between.sort(
        (a, b) => (rank[b.status] || 0) - (rank[a.status] || 0)
    )[0];
}

/**
 * Describe the relationship from `meId`'s point of view.
 *
 * @returns {{status: string, connectionId: string|null, direction: string|null}}
 */
function describeConnection(connection, meId) {
    if (!connection) {
        return { status: "none", connectionId: null, direction: null };
    }

    const isSender = connection.senderId === meId;

    if (connection.status === STATUS.PENDING) {
        return {
            status: isSender ? "pending_sent" : "pending_received",
            connectionId: connection.id,
            direction: isSender ? "outgoing" : "incoming"
        };
    }

    return {
        status: connection.status,
        connectionId: connection.id,
        direction: isSender ? "outgoing" : "incoming"
    };
}

function isAccepted(connections, firstId, secondId) {
    const record = findConnection(connections, firstId, secondId);

    return Boolean(record && record.status === STATUS.ACCEPTED);
}

function findSaved(savedRecords, userId, savedStudentId) {
    return (
        savedRecords.find(
            record =>
                record.userId === userId &&
                record.savedStudentId === savedStudentId
        ) || null
    );
}

module.exports = {
    STATUS,
    findConnection,
    describeConnection,
    isAccepted,
    findSaved
};
