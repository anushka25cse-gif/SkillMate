"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { JsonDatabase } = require("../utils/jsonDatabase");
const { prepareEnvironment } = require("./helpers");

const dataDir = prepareEnvironment();

describe("JSON database", () => {
    test("treats a missing collection file as an empty array", async () => {
        const db = new JsonDatabase(path.join(dataDir, "missing"));

        assert.deepEqual(await db.readAll("users"), []);
    });

    test("writes and reads a collection atomically", async () => {
        const db = new JsonDatabase(dataDir);

        await db.writeAll("feedback", [
            { id: "1", rating: 5 },
            { id: "2", rating: 3 }
        ]);

        const records = await db.readAll("feedback");

        assert.equal(records.length, 2);
        assert.equal(records[1].rating, 3);

        // No temporary files may be left behind.
        const leftovers = fs
            .readdirSync(dataDir)
            .filter(name => name.endsWith(".tmp"));

        assert.deepEqual(leftovers, []);
    });

    test("refuses to read a corrupt JSON file", async () => {
        const dir = path.join(dataDir, "corrupt");

        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "User.json"), "{ broken", "utf8");

        const db = new JsonDatabase(dir);

        await assert.rejects(
            () => db.readAll("users"),
            error => {
                assert.equal(error.statusCode, 500);
                assert.match(error.message, /invalid JSON/i);
                return true;
            }
        );
    });

    test("refuses an unknown collection name", async () => {
        const db = new JsonDatabase(dataDir);

        await assert.rejects(
            () => db.readAll("../User"),
            error => {
                assert.equal(error.statusCode, 500);
                return true;
            }
        );
    });

    test("serialises concurrent read-modify-write cycles", async () => {
        const db = new JsonDatabase(path.join(dataDir, "concurrent"));

        await db.writeAll("messages", [
            { id: "counter", value: 0 }
        ]);

        await Promise.all(
            Array.from({ length: 40 }, () =>
                db.mutate("messages", records => {
                    records[0].value += 1;
                })
            )
        );

        const [record] = await db.readAll("messages");

        assert.equal(record.value, 40);
    });

    test("insert assigns ids and update merges patches", async () => {
        const db = new JsonDatabase(path.join(dataDir, "crud"));

        const created = await db.insert("savedPeople", {
            userId: "U1",
            savedStudentId: "U2"
        });

        assert.ok(created.id);

        const updated = await db.update("savedPeople", created.id, {
            note: "updated"
        });

        assert.equal(updated.note, "updated");
        assert.equal(updated.userId, "U1");

        assert.equal(await db.remove("savedPeople", created.id), true);
        assert.equal(await db.remove("savedPeople", created.id), false);
    });

    test("removeWhere removes only matching records", async () => {
        const db = new JsonDatabase(path.join(dataDir, "remove-where"));

        await db.writeAll("connections", [
            { id: "a", senderId: "U1" },
            { id: "b", senderId: "U2" },
            { id: "c", senderId: "U1" }
        ]);

        const removed = await db.removeWhere(
            "connections",
            record => record.senderId === "U1"
        );

        assert.equal(removed, 2);

        const remaining = await db.readAll("connections");

        assert.equal(remaining.length, 1);
        assert.equal(remaining[0].id, "b");
    });
});
