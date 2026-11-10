const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../data/Connections.json");

// READ CONNECTIONS FROM JSON
function readConnections() {
    try {
        const fileContent = fs.readFileSync(DATA_FILE, "utf8");
        const data = JSON.parse(fileContent);

        return Array.isArray(data.connections) ? data.connections : [];

    } catch (error) {
        console.error("Error reading Connections.json:", error.message);
        throw error;
    }
}

// WRITE CONNECTIONS TO JSON
function writeConnections(connections) {
    try {
        const temporaryFile = DATA_FILE + ".tmp";

        const data = {
            connections
        };

        fs.writeFileSync(
            temporaryFile,
            JSON.stringify(data, null, 4),
            "utf8"
        );

        fs.renameSync(temporaryFile, DATA_FILE);

    } catch (error) {
        console.error("Error writing Connections.json:", error.message);
        throw error;
    }
}

module.exports = {
    readConnections,
    writeConnections
};