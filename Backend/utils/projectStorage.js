const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../data/Projects.json");

// READ PROJECTS FROM JSON
function readProjects() {
    try {
        const fileContent = fs.readFileSync(DATA_FILE, "utf8");
        const data = JSON.parse(fileContent);

        return Array.isArray(data.projects) ? data.projects : [];

    } catch (error) {
        console.error("Error reading Projects.json:", error.message);
        throw error;
    }
}

// WRITE PROJECTS TO JSON
function writeProjects(projects) {
    try {
        const temporaryFile = DATA_FILE + ".tmp";

        const data = {
            projects
        };

        fs.writeFileSync(
            temporaryFile,
            JSON.stringify(data, null, 4),
            "utf8"
        );

        // Replace the original file safely
        fs.renameSync(temporaryFile, DATA_FILE);

    } catch (error) {
        console.error("Error writing Projects.json:", error.message);
        throw error;
    }
}

// FIND PROJECT BY ID
function findProjectById(projectId) {
    const projects = readProjects();

    return projects.find(
        project => project._id.toString() === projectId.toString()
    ) || null;
}

module.exports = {
    readProjects,
    writeProjects,
    findProjectById
};