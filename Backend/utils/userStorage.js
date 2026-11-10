const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../data/Users.json");

// READ USERS FROM JSON
function readUsers() {
    try {
        const fileContent = fs.readFileSync(DATA_FILE, "utf8");
        const data = JSON.parse(fileContent);

        return Array.isArray(data.users) ? data.users : [];

    } catch (error) {
        console.error("Error reading Users.json:", error.message);
        throw error;
    }
}

// WRITE USERS TO JSON
function writeUsers(users) {
    try {
        const temporaryFile = DATA_FILE + ".tmp";

        const data = {
            users
        };

        fs.writeFileSync(
            temporaryFile,
            JSON.stringify(data, null, 4),
            "utf8"
        );

        // Replace the original file safely
        fs.renameSync(temporaryFile, DATA_FILE);

    } catch (error) {
        console.error("Error writing Users.json:", error.message);
        throw error;
    }
}

// FIND USER BY EMAIL
function findUserByEmail(email) {
    const users = readUsers();

    return users.find(
        user => user.email.toLowerCase() === email.toLowerCase()
    ) || null;
}

// FIND USER BY ID
function findUserById(userId) {
    const users = readUsers();

    return users.find(
        user => user._id.toString() === userId.toString()
    ) || null;
}

module.exports = {
    readUsers,
    writeUsers,
    findUserByEmail,
    findUserById
};