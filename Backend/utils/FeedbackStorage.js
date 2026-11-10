const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../data/Feedback.json");

// READ FEEDBACK FROM JSON
function readFeedback() {
    try {
        const fileContent = fs.readFileSync(DATA_FILE, "utf8");
        const data = JSON.parse(fileContent);

        return Array.isArray(data.feedback) ? data.feedback : [];

    } catch (error) {
        console.error("Error reading Feedback.json:", error.message);
        throw error;
    }
}

// WRITE FEEDBACK TO JSON
function writeFeedback(feedback) {
    try {
        const temporaryFile = DATA_FILE + ".tmp";

        const data = {
            feedback
        };

        fs.writeFileSync(
            temporaryFile,
            JSON.stringify(data, null, 4),
            "utf8"
        );

        fs.renameSync(temporaryFile, DATA_FILE);

    } catch (error) {
        console.error("Error writing Feedback.json:", error.message);
        throw error;
    }
}

module.exports = {
    readFeedback,
    writeFeedback
};