
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Location of JSON database files
const DATA_FOLDER = path.join(__dirname, "Data");

// Function to read data from JSON files
function readData(fileName) {
    const filePath = path.join(DATA_FOLDER, fileName);
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
}

// Function to write data into JSON files
function writeData(fileName, data) {
    const filePath = path.join(DATA_FOLDER, fileName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Test route
app.get("/", (req, res) => {
    res.send("SkillMate Backend is running!");
});

// Get all students
app.get("/api/users", (req, res) => {
    const users = readData("User.json");
    res.json(users);
});

// Get all projects
app.get("/api/Projects", (req, res) => {
    const Projects = readData("Projects.json");
    res.json(Projects);
});

// Get all connection requests
app.get("/api/Connections", (req, res) => {
    const Connections = readData("Connections.json");
    res.json(Connections);
});

// Get all skill exchange requests
app.get("/api/SkillExchange", (req, res) => {
    const requests = readData("SkillExchange.json");
    res.json(requests);
});

// Get all messages
app.get("/api/Messages", (req, res) => {
    const Messages = readData("Messages.json");
    res.json(Messages);
});

// Get all feedback
app.get("/api/Feedback", (req, res) => {
    const Feedback = readData("Feedback.json");
    res.json(Feedback);
});

// Get saved people
app.get("/api/Savedpeople", (req, res) => {
    const Savedpeople = readData("Savedpeople.json");
    res.json(Savedpeople);
});

// Start server
app.listen(PORT, () => {
    console.log(`SkillMate server running at http://localhost:${PORT}`);
});
