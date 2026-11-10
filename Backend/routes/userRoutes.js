const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

const SKILL_EXCHANGE_FILE = require("path").join(
    __dirname,
    "../data/SkillExchange.json"
);

const {
    readUsers,
    writeUsers,
    findUserByEmail,
    findUserById
} = require("../utils/userStorage");

// -----------------------------------------
// HELPER: CHECK LOGIN
// -----------------------------------------

const checkLogin = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({
            success: false,
            message: "Please login first."
        });
    }

    next();
};

// -----------------------------------------
// HELPER: REMOVE PASSWORD FROM RESPONSE
// -----------------------------------------

function publicUser(user) {
    const { passwordHash, ...safeUser } = user;
    return safeUser;
}

// -----------------------------------------
// HELPER: SYNCHRONIZE USER TO MONGODB
// -----------------------------------------

async function syncUserToMongo(userData) {
    try {
        const { _id, __v, ...fields } = userData;

        await User.findByIdAndUpdate(
            _id,
            { $set: fields },
            {
                upsert: true,
                new: true,
                runValidators: true,
                setDefaultsOnInsert: true
            }
        );

        return true;

    } catch (error) {
        console.error(
            "MongoDB User Sync Pending:",
            error.message
        );

        return false;
    }
}

// -----------------------------------------
// SYNC TEACHING SKILLS TO SKILL EXCHANGE JSON
// -----------------------------------------

function syncTeachSkillsToSkillExchange(user) {
    try {
        const data = JSON.parse(
            require("fs").readFileSync(SKILL_EXCHANGE_FILE, "utf8")
        );

        if (!Array.isArray(data.profiles)) {
            data.profiles = [];
        }

        if (!Array.isArray(data.requests)) {
            data.requests = [];
        }

        const userId = String(user._id);

        const profileIndex = data.profiles.findIndex(
            profile => profile.studentId === userId
        );

       const now = new Date().toISOString();

if (profileIndex !== -1) {
    data.profiles[profileIndex].teachSkills =
        user.teachSkills || [];

    data.profiles[profileIndex].updatedAt = now;

} else {
    data.profiles.push({
        studentId: userId,
        teachSkills: user.teachSkills || [],
        learnSkills: [],
        status: "Active",
        createdAt: now,
        updatedAt: now
    });
}

        require("fs").writeFileSync(
            SKILL_EXCHANGE_FILE,
            JSON.stringify(data, null, 4),
            "utf8"
        );

    } catch (error) {
        console.error(
            "SkillExchange teaching skills sync error:",
            error.message
        );
    }
}

// -----------------------------------------
// 1. REGISTER USER
// -----------------------------------------

router.post("/register", async (req, res) => {
    try {
        const {
            fullName,
            email,
            password,
            college,
            registration,
            course,
            year,
            graduation,
            knownSkills,
            teachSkills,
            bio,
            interests,
            profilePhoto,
            proficiency,
            availability,
            collaboration
        } = req.body;

        if (!fullName || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Check JSON first
        const existingJSONUser = findUserByEmail(normalizedEmail);

        if (existingJSONUser) {
            return res.status(409).json({
                success: false,
                message: "Email already registered."
            });
        }

        // Also check MongoDB for any unsynchronized existing account
        const existingMongoUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingMongoUser) {
            return res.status(409).json({
                success: false,
                message: "Email already registered."
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        // Generate one ID for both storage systems
        const userId = new mongoose.Types.ObjectId();

        const now = new Date().toISOString();

        const newUser = {
            _id: userId.toString(),
            fullName: fullName.trim(),
            email: normalizedEmail,
            passwordHash,

            college: college || "",
            registration: registration || "",
            course: course || "",
            year: year || "",
            graduation: graduation || "",

            knownSkills: knownSkills || [],
            teachSkills: teachSkills || [],

            bio: bio || "",
            interests: interests || [],
            profilePhoto: profilePhoto || "",

            proficiency: proficiency || "",
            availability: availability || "",
            collaboration: collaboration || "",

            createdAt: now,
            updatedAt: now
        };

// STEP 1: Save to primary JSON storage
const users = readUsers();
users.push(newUser);
writeUsers(users);

// STEP 2: Synchronize teaching skills to SkillExchange JSON
syncTeachSkillsToSkillExchange(newUser);

// STEP 3: Synchronize to MongoDB
const mongoSynced = await syncUserToMongo(newUser);

        req.session.userId = newUser._id;

        return res.status(201).json({
            success: true,
            message: mongoSynced
                ? "Registration successful!"
                : "Registration successful! MongoDB synchronization is pending.",
            user: publicUser(newUser),
            mongoSynced
        });

    } catch (error) {
        console.error("Registration Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to register user."
        });
    }
});

// -----------------------------------------
// 2. LOGIN USER
// -----------------------------------------

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // JSON is the primary source
        const user = findUserByEmail(normalizedEmail);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const isMatch = await bcrypt.compare(
            password,
            user.passwordHash
        );

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        req.session.userId = user._id;

        // Retry synchronization during login
        const mongoSynced = await syncUserToMongo(user);

        return res.json({
            success: true,
            message: "Login successful!",
            user: publicUser(user),
            mongoSynced
        });

    } catch (error) {
        console.error("Login Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to login."
        });
    }
});

// -----------------------------------------
// 3. GET LOGGED-IN USER
// -----------------------------------------

router.get("/me", checkLogin, (req, res) => {
    try {
        const user = findUserById(req.session.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        return res.json({
            success: true,
            user: publicUser(user)
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// -----------------------------------------
// 4. GET ALL USERS
// -----------------------------------------

router.get("/", checkLogin, (req, res) => {
    try {
        const users = readUsers().map(publicUser);

        return res.json({
            success: true,
            users
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// -----------------------------------------
// 5. GET USER BY ID
// -----------------------------------------

router.get("/:id", checkLogin, (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID."
            });
        }

        const user = findUserById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        return res.json({
            success: true,
            user: publicUser(user)
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// -----------------------------------------
// 6. UPDATE USER PROFILE
// -----------------------------------------

router.put("/me", checkLogin, async (req, res) => {
    try {
        const allowedFields = [
            "fullName",
            "college",
            "registration",
            "course",
            "year",
            "graduation",
            "knownSkills",
            "teachSkills",
            "bio",
            "interests",
            "profilePhoto",
            "proficiency",
            "availability",
            "collaboration"
        ];

        const users = readUsers();

        const userIndex = users.findIndex(
            user => user._id === req.session.userId.toString()
        );

        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const updates = {};

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        // Update JSON record
        users[userIndex] = {
            ...users[userIndex],
            ...updates,
            updatedAt: new Date().toISOString()
        };

writeUsers(users);

// Synchronize teaching skills to SkillExchange.json
syncTeachSkillsToSkillExchange(users[userIndex]);

// Synchronize MongoDB
const mongoSynced = await syncUserToMongo(users[userIndex]);

        return res.json({
            success: true,
            message: mongoSynced
                ? "Profile updated successfully!"
                : "Profile updated in JSON. MongoDB synchronization is pending.",
            user: publicUser(users[userIndex]),
            mongoSynced
        });

    } catch (error) {
        console.error("Profile Update Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update profile."
        });
    }
});

// -----------------------------------------
// 7. LOGOUT USER
// -----------------------------------------

router.post("/logout", (req, res) => {
    req.session.destroy(error => {
        if (error) {
            return res.status(500).json({
                success: false,
                message: "Logout failed."
            });
        }

        res.clearCookie("connect.sid");

        return res.json({
            success: true,
            message: "Logged out successfully!"
        });
    });
});

// -----------------------------------------
// 8. DELETE USER ACCOUNT
// -----------------------------------------

router.delete("/me", checkLogin, async (req, res) => {
    try {
        const userId = req.session.userId.toString();

        const users = readUsers();

        const updatedUsers = users.filter(
            user => user._id !== userId
        );

        if (updatedUsers.length === users.length) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        // Delete from primary JSON storage
        writeUsers(updatedUsers);

        // Delete from MongoDB
        try {
            await User.findByIdAndDelete(userId);
        } catch (error) {
            console.error(
                "MongoDB User Deletion Pending:",
                error.message
            );
        }

        req.session.destroy(error => {
            if (error) {
                return res.status(500).json({
                    success: false,
                    message: "Account deleted, but session cleanup failed."
                });
            }

            res.clearCookie("connect.sid");

            return res.json({
                success: true,
                message: "Account deleted successfully!"
            });
        });

    } catch (error) {
        console.error("Delete Account Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to delete account."
        });
    }
});

// -----------------------------------------
// 9. CHANGE PASSWORD
// -----------------------------------------

router.put("/change-password", checkLogin, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Please enter both current and new passwords."
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: "New password must contain at least 8 characters."
            });
        }

        const users = readUsers();

        const userIndex = users.findIndex(
            user => user._id === req.session.userId.toString()
        );

        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const user = users[userIndex];

        const isMatch = await bcrypt.compare(
            currentPassword,
            user.passwordHash
        );

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect."
            });
        }

        // Hash the new password
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        // Update JSON
        users[userIndex].passwordHash = newPasswordHash;
        users[userIndex].updatedAt = new Date().toISOString();

        writeUsers(users);

        // Synchronize MongoDB
        const mongoSynced = await syncUserToMongo(users[userIndex]);

        return res.status(200).json({
            success: true,
            message: mongoSynced
                ? "Password changed successfully."
                : "Password changed in JSON. MongoDB synchronization is pending.",
            mongoSynced
        });

    } catch (error) {
        console.error("Change Password Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to change password."
        });
    }
});

module.exports = router;