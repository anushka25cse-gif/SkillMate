const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../data/SavedPeople.json");

// READ SAVED PEOPLE FROM JSON
function readSavedPeople() {
    try {
        const fileContent = fs.readFileSync(DATA_FILE, "utf8");
        const data = JSON.parse(fileContent);

        return Array.isArray(data.savedPeople) ? data.savedPeople : [];

    } catch (error) {
        console.error("Error reading SavedPeople.json:", error.message);
        throw error;
    }
}

// WRITE SAVED PEOPLE TO JSON
function writeSavedPeople(savedPeople) {
    try {
        const temporaryFile = DATA_FILE + ".tmp";

        const data = {
            savedPeople
        };

        fs.writeFileSync(
            temporaryFile,
            JSON.stringify(data, null, 4),
            "utf8"
        );

      fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 4),
    "utf8"
);

fs.unlinkSync(temporaryFile);
    } catch (error) {
        console.error("Error writing SavedPeople.json:", error.message);
        throw error;
    }
}

module.exports = {
    readSavedPeople,
    writeSavedPeople
};