const fs = require("fs");
const path = require("path");
require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../models/User");

const DATA_FILE = path.join(__dirname, "../data/Users.json");

async function migrateUsers() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);

        console.log("MongoDB connected.");

        // Read existing JSON data
        let data = { users: [] };

        if (fs.existsSync(DATA_FILE)) {
            const fileContent = fs.readFileSync(DATA_FILE, "utf8");

            if (fileContent.trim()) {
                data = JSON.parse(fileContent);
            }
        }

        if (!Array.isArray(data.users)) {
            throw new Error("Users.json must contain a users array.");
        }

        // Fetch existing MongoDB users
        const mongoUsers = await User.find().lean();

        let added = 0;
        let skipped = 0;

        for (const user of mongoUsers) {
            const userId = user._id.toString();

            // Avoid duplicate users
            const alreadyExists = data.users.some(
                existing =>
                    existing._id === userId ||
                    existing.email === user.email
            );

            if (alreadyExists) {
                skipped++;
                continue;
            }

            // Convert MongoDB user into JSON-compatible data
            const userData = {
                ...user,
                _id: userId,
                createdAt: user.createdAt
                    ? user.createdAt.toISOString()
                    : new Date().toISOString(),
                updatedAt: user.updatedAt
                    ? user.updatedAt.toISOString()
                    : new Date().toISOString()
            };

            data.users.push(userData);
            added++;
        }

        // Write JSON safely using a temporary file
        const temporaryFile = DATA_FILE + ".tmp";

        fs.writeFileSync(
            temporaryFile,
            JSON.stringify(data, null, 4),
            "utf8"
        );

        fs.renameSync(temporaryFile, DATA_FILE);

        console.log("--------------------------------");
        console.log("User migration completed.");
        console.log("MongoDB users found:", mongoUsers.length);
        console.log("Users added to JSON:", added);
        console.log("Users skipped:", skipped);
        console.log("--------------------------------");

    } catch (error) {
        console.error("Migration failed:", error.message);
    } finally {
        await mongoose.disconnect();
    }
}

migrateUsers();