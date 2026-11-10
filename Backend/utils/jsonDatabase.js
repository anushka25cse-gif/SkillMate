"use strict";

/**
 * Safe JSON-file database used by every route.
 *
 * Design goals
 * ------------
 * - One collection per JSON file, always stored as a JSON array.
 * - Asynchronous filesystem access only.
 * - Atomic writes: data is written to a temporary file and then renamed, so a
 *   crash can never leave a half-written JSON file behind.
 * - Serialised read-modify-write cycles per collection, so two concurrent
 *   requests cannot overwrite each other's changes.
 * - Missing files are created on demand; corrupt files raise a clear 500
 *   instead of silently destroying data.
 *
 * Limitations (documented for reviewers): JSON files are a single-process
 * store. They are perfect for a college project and a demo, but they do not
 * replace a real database for concurrent, multi-instance or large workloads.
 */

const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const { AppError } = require("./errors");

/** Public collection name -> file name. Only these files are reachable. */
const COLLECTIONS = Object.freeze({
    users: "User.json",
    projects: "Projects.json",
    connections: "Connections.json",
    skillExchange: "SkillExchange.json",
    messages: "Messages.json",
    feedback: "Feedback.json",
    savedPeople: "Savedpeople.json"
});

class JsonDatabase {
    constructor(dataDir) {
        if (!dataDir) {
            throw new Error("JsonDatabase requires a data directory.");
        }

        this.dataDir = dataDir;
        this.locks = new Map();
    }

    /** Resolve a collection name to its absolute file path. */
    filePath(collection) {
        const fileName = COLLECTIONS[collection];

        if (!fileName) {
            throw new AppError(500, `Unknown data collection: ${collection}.`);
        }

        return path.join(this.dataDir, fileName);
    }

    /**
     * Run `task` after every previously queued task for the same collection
     * has finished. Guarantees read-modify-write sequences cannot interleave.
     */
    withLock(collection, task) {
        const previous = this.locks.get(collection) || Promise.resolve();

        const run = previous.then(task, task);

        // Store a settled-safe tail so one failed task never poisons the queue.
        this.locks.set(collection, run.then(() => undefined, () => undefined));

        return run;
    }

    /**
     * Read an entire collection.
     * A missing file is not an error: it is treated as an empty collection and
     * created lazily on the next write.
     */
    async readAll(collection) {
        const file = this.filePath(collection);
        let raw;

        try {
            raw = await fs.readFile(file, "utf8");
        } catch (error) {
            if (error.code === "ENOENT") {
                return [];
            }

            throw new AppError(500, `Could not read ${path.basename(file)}.`);
        }

        if (!raw.trim()) {
            return [];
        }

        let parsed;

        try {
            parsed = JSON.parse(raw);
        } catch (error) {
            throw new AppError(
                500,
                `${path.basename(file)} contains invalid JSON. Restore the file from a backup before continuing.`
            );
        }

        if (!Array.isArray(parsed)) {
            throw new AppError(
                500,
                `${path.basename(file)} must contain a JSON array.`
            );
        }

        return parsed;
    }

    /** Atomically replace a collection. Call only from inside a lock. */
    async writeAll(collection, records) {
        if (!Array.isArray(records)) {
            throw new AppError(500, "Only arrays can be written to a collection.");
        }

        const file = this.filePath(collection);
        const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;

        await fs.mkdir(path.dirname(file), { recursive: true });

        try {
            await fs.writeFile(temporary, `${JSON.stringify(records, null, 2)}\n`, "utf8");
            await fs.rename(temporary, file);
        } catch (error) {
            await fs.rm(temporary, { force: true }).catch(() => {});
            throw new AppError(
                500,
                `Could not save ${path.basename(file)}. Check file permissions and available disk space.`
            );
        }

        return records;
    }

    /** Read + transform + write, safely serialised. */
    mutate(collection, mutator) {
        return this.withLock(collection, async () => {
            const records = await this.readAll(collection);
            const result = await mutator(records);

            // Mutators may return `{ records, value }` when the caller needs
            // both the persisted array and a derived result.
            if (result && Array.isArray(result.records)) {
                await this.writeAll(collection, result.records);
                return result.value;
            }

            await this.writeAll(collection, records);
            return result;
        });
    }

    async findAll(collection, predicate = () => true) {
        const records = await this.readAll(collection);
        return records.filter(predicate);
    }

    async findOne(collection, predicate) {
        const records = await this.readAll(collection);
        return records.find(predicate) || null;
    }

    async findById(collection, id) {
        if (!id) return null;
        return this.findOne(collection, record => record.id === id);
    }

    /** Insert a record, assigning an id when one is not supplied. */
    async insert(collection, record) {
        return this.mutate(collection, records => {
            const row = {
                id: record.id || this.newId(collection),
                ...record
            };

            if (!row.id) {
                row.id = this.newId(collection);
            }

            records.push(row);
            return row;
        });
    }

    /** Shallow-merge a patch into one record. Returns the updated record. */
    async update(collection, id, patch) {
        return this.mutate(collection, records => {
            const index = records.findIndex(record => record.id === id);

            if (index === -1) {
                throw new AppError(404, "Record not found.");
            }

            records[index] = {
                ...records[index],
                ...patch,
                id: records[index].id
            };

            return records[index];
        });
    }

    /** Delete one record. Returns true when something was removed. */
    async remove(collection, id) {
        return this.mutate(collection, records => {
            const index = records.findIndex(record => record.id === id);

            if (index === -1) {
                return false;
            }

            records.splice(index, 1);
            return true;
        });
    }

    /** Remove every record matching a predicate. Returns the removed count. */
    async removeWhere(collection, predicate) {
        return this.mutate(collection, records => {
            let removed = 0;

            for (let index = records.length - 1; index >= 0; index -= 1) {
                if (predicate(records[index])) {
                    records.splice(index, 1);
                    removed += 1;
                }
            }

            return removed;
        });
    }

    /** A collision-resistant id for new records. */
    newId(prefix = "rec") {
        return `${prefix}_${crypto.randomUUID()}`;
    }

    /** Ensure the data directory and all seven files exist. */
    async ensureCollections() {
        await fs.mkdir(this.dataDir, { recursive: true });

        for (const collection of Object.keys(COLLECTIONS)) {
            const file = this.filePath(collection);

            try {
                await fs.access(file);
            } catch (error) {
                if (error.code !== "ENOENT") throw error;
                await this.writeAll(collection, []);
            }
        }
    }
}

module.exports = {
    JsonDatabase,
    COLLECTIONS
};
