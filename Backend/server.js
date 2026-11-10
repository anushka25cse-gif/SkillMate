
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Location of JSON database files
const DATA_FOLDER = path.join(__dirname, "Data");

// Only these files can be accessed through the data layer
const ALLOWED_FILES = [
    "User.json",
    "Projects.json",
    "Connections.json",
    "SkillExchange.json",
    "Messages.json",
    "Feedback.json",
    "Savedpeople.json"
];

// Custom error helper
function createError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

// Validate the requested filename
function getFilePath(fileName) {
    if (!ALLOWED_FILES.includes(fileName)) {
        throw createError("Invalid data filename.", 400);
    }

    return path.join(DATA_FOLDER, fileName);
}

// Read data from a JSON file
function readData(fileName) {
    const filePath = getFilePath(fileName);

    if (!fs.existsSync(filePath)) {
        throw createError(`${fileName} was not found.`, 404);
    }

    try {
        const fileContent = fs.readFileSync(filePath, "utf8");
        return JSON.parse(fileContent);
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw createError(`${fileName} contains invalid JSON.`, 500);
        }

        throw error;
    }
}

// Write data into a JSON file
function writeData(fileName, data) {
    const filePath = getFilePath(fileName);

    let jsonContent;

    try {
        jsonContent = JSON.stringify(data, null, 2);

        if (jsonContent === undefined) {
            throw new Error("Data cannot be converted to JSON.");
        }
    } catch (error) {
        throw createError("Could not convert data into JSON.", 400);
    }

    // Write to a temporary file first
    const tempPath = `${filePath}.tmp`;

    try {
        fs.writeFileSync(tempPath, jsonContent, "utf8");
        fs.renameSync(tempPath, filePath);
    } catch (error) {
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }

        throw createError("Could not save data to the JSON file.", 500);
    }
}

// Health-check route
app.get("/", (req, res) => {
    res.send("SkillMate Backend is running!");
});

// Reusable GET route
function getAllData(fileName) {
    return (req, res) => {
        const data = readData(fileName);
        res.json(data);
    };
}

// GET routes for all seven modules
// (The users route is sanitized so password hashes never leave the backend.)
app.get("/api/users", (req, res) => {
    const data = readData(USER_FILE);
    res.json(Array.isArray(data) ? data.map(sanitizeUser) : []);
});
app.get("/api/Projects", getAllData("Projects.json"));
app.get("/api/Connections", getAllData("Connections.json"));
app.get("/api/SkillExchange", getAllData("SkillExchange.json"));
app.get("/api/Messages", getAllData("Messages.json"));
app.get("/api/Feedback", getAllData("Feedback.json"));
app.get("/api/Savedpeople", getAllData("Savedpeople.json"));

// ============================================================================
// PART 1: Authentication & user accounts (User.json)
// ============================================================================

const USER_FILE = "User.json";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Hash a password with Node's built-in scrypt. No packages needed.
function hashPassword(password, salt) {
    return crypto.scryptSync(password, salt, 64).toString("hex");
}

// Remove secret fields before sending a user to the frontend.
function sanitizeUser(user) {
    const clean = { ...user };

    delete clean.passwordHash;
    delete clean.passwordSalt;

    return clean;
}

// Read User.json as an array, tolerating an empty/missing file.
function readUsers() {
    try {
        const data = readData(USER_FILE);

        return Array.isArray(data) ? data : [];
    } catch (error) {
        if (error.statusCode === 404) {
            return [];
        }

        throw error;
    }
}

// Save users back into User.json.
function writeUsers(users) {
    writeData(USER_FILE, users);
}

// The next user id keeps the existing "U001", "U002", ... style.
function nextUserId(users) {
    const highest = users.reduce((max, user) => {
        const match = /^U(\d+)$/.exec(String(user.id || ""));

        return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);

    return `U${String(highest + 1).padStart(3, "0")}`;
}

// Validate the registration payload sent by ProfileDetails.html.
function validateRegistration(body) {
    const required = [
        "fullName",
        "email",
        "college",
        "registration",
        "course",
        "year",
        "graduation",
        "password"
    ];

    for (const field of required) {
        if (!String(body[field] || "").trim()) {
            throw createError(`Missing required field: ${field}.`, 400);
        }
    }

    const email = String(body.email).trim().toLowerCase();

    if (!EMAIL_PATTERN.test(email)) {
        throw createError("Please enter a valid email address.", 400);
    }

    if (String(body.password).length < 6) {
        throw createError("Password must be at least 6 characters long.", 400);
    }
}

// Step 1 of registration: Create Account (ProfileDetails.html).
app.post("/api/auth/register", (req, res) => {
    const body = req.body || {};

    validateRegistration(body);

    const email = String(body.email).trim().toLowerCase();
    const users = readUsers();

    if (users.some(user => String(user.email || "").toLowerCase() === email)) {
        throw createError(
            "An account with this email already exists. Please sign in instead.",
            409
        );
    }

    const salt = crypto.randomBytes(16).toString("hex");

    const newUser = {
        id: nextUserId(users),
        fullName: String(body.fullName).trim(),
        email: email,
        college: String(body.college).trim(),
        registration: String(body.registration).trim(),
        course: String(body.course).trim(),
        year: String(body.year).trim(),
        graduation: String(body.graduation).trim(),
        passwordHash: hashPassword(String(body.password), salt),
        passwordSalt: salt,
        knownSkills: [],
        teachSkills: [],
        bio: "",
        interests: [],
        proficiency: "",
        availability: "",
        collaboration: "",
        profilePhoto: "",
        profileCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    users.push(newUser);
    writeUsers(users);

    // Keep the exact same sessionStorage draft keys working, so the
    // existing Skills page flow continues unchanged.
    res.status(201).json({
        success: true,
        message: "Account created. Continue to the Skills page.",
        user: sanitizeUser(newUser)
    });
});

// Step 3 of registration: Complete Profile page finalises the account.
app.put("/api/users/:email/complete", (req, res) => {
    const email = String(req.params.email || "").toLowerCase();
    const body = req.body || {};
    const users = readUsers();

    const index = users.findIndex(
        user => String(user.email || "").toLowerCase() === email
    );

    if (index === -1) {
        throw createError(
            "No account was found for this email. Please create an account first.",
            404
        );
    }

    const updates = ["knownSkills", "teachSkills", "interests"];

    updates.forEach(field => {
        if (Array.isArray(body[field])) {
            users[index][field] = [...body[field]];
        }
    });

    ["bio", "proficiency", "availability", "collaboration", "profilePhoto"]
        .forEach(field => {
            if (body[field] !== undefined) {
                users[index][field] = String(body[field]);
            }
        });

    users[index].profileCompleted = true;
    users[index].updatedAt = new Date().toISOString();

    writeUsers(users);

    res.json({
        success: true,
        message: "Profile saved successfully.",
        user: sanitizeUser(users[index])
    });
});

// Login (StudentLogin.html).
app.post("/api/auth/login", (req, res) => {
    const body = req.body || {};
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
        throw createError(
            "Please enter both your email ID and password.",
            400
        );
    }

    const users = readUsers();
    const user = users.find(
        item => String(item.email || "").toLowerCase() === email
    );

    if (!user) {
        throw createError(
            "The email ID or password is incorrect. Please try again.",
            401
        );
    }

    if (!user.passwordHash || !user.passwordSalt) {
        throw createError(
            "This account has no password on record. Please create a new account.",
            401
        );
    }

    const isCorrect = hashPassword(password, user.passwordSalt)
        === user.passwordHash;

    if (!isCorrect) {
        throw createError(
            "The email ID or password is incorrect. Please try again.",
            401
        );
    }

    res.json({
        success: true,
        message: "Login successful!",
        user: sanitizeUser(user)
    });
});

// Handle errors
app.use((err, req, res, next) => {
    console.error("Backend error:", err.message);

    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal server error."
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`SkillMate server running at http://localhost:${PORT}`);
});
