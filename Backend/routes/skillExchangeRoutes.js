const express = require("express");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const User = require("../models/User");

const router = express.Router();

const DATA_FILE = path.join(__dirname, "../data/SkillExchange.json");

// -----------------------------------------
// LOGIN CHECK
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

router.use(checkLogin);

// -----------------------------------------
// JSON FILE HELPERS
// -----------------------------------------

function readData() {
    try {
        const data = JSON.parse(
            fs.readFileSync(DATA_FILE, "utf8")
        );

        if (Array.isArray(data)) {
            return {
                profiles: data,
                requests: []
            };
        }

        return {
            profiles: Array.isArray(data.profiles)
                ? data.profiles
                : [],
            requests: Array.isArray(data.requests)
                ? data.requests
                : []
        };

    } catch (error) {
        console.error("SkillExchange JSON read error:", error);

        return {
            profiles: [],
            requests: []
        };
    }
}

function saveData(data) {
    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(data, null, 4)
    );
}

// -----------------------------------------
// 1. GET ALL STUDENT SKILL PROFILES
// -----------------------------------------

router.get("/", async (req, res) => {
    try {
        const data = readData();

        const studentIds = data.profiles.map(
            profile => profile.studentId
        );

        const users = await User.find({
            _id: { $in: studentIds }
        }).select(
            "fullName email course year college knownSkills teachSkills"
        );

        const userMap = new Map(
            users.map(user => [
                String(user._id),
                user
            ])
        );

        const profiles = data.profiles
            .map(profile => {
                const user = userMap.get(profile.studentId);

                if (!user) return null;

                return {
                    ...profile,

 // Teaching skills are stored in JSON
teachSkills: profile.teachSkills || [],

                    fullName: user.fullName,
                    email: user.email,
                    course: user.course,
                    year: user.year,
                    college: user.college
                };
            })
            .filter(Boolean);

        res.json({
            success: true,
            profiles
        });

    } catch (error) {
        console.error("Fetch profiles error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to fetch skill profiles."
        });
    }
});

// -----------------------------------------
// 2. SAVE OR UPDATE LEARNING SKILLS
// -----------------------------------------

router.post("/", async (req, res) => {
    try {
        const { learnSkills } = req.body;

        if (!Array.isArray(learnSkills)) {
            return res.status(400).json({
                success: false,
                message: "Please provide valid learning skills."
            });
        }

        const userId = String(req.session.userId);

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        const data = readData();

        const existingIndex = data.profiles.findIndex(
            profile => profile.studentId === userId
        );

        const now = new Date().toISOString();

        const profile = {
            studentId: userId,

            // Teaching skills come from MongoDB
            teachSkills: user.teachSkills || [],

            // Learning skills are stored in JSON
            learnSkills: [...new Set(
                learnSkills
                    .map(skill => String(skill).trim())
                    .filter(Boolean)
            )],

            status: "Active",
            updatedAt: now
        };

        if (existingIndex !== -1) {
            data.profiles[existingIndex] = {
                ...data.profiles[existingIndex],
                ...profile
            };
        } else {
            data.profiles.push({
                ...profile,
                createdAt: now
            });
        }

        saveData(data);

        res.json({
            success: true,
            message: "Learning skills saved successfully.",
            profile
        });

    } catch (error) {
        console.error("Save profile error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to save skill profile."
        });
    }
});

// -----------------------------------------
// 3. GET CURRENT STUDENT'S SKILL PROFILE
// -----------------------------------------

router.get("/mine", async (req, res) => {
    try {
        const userId = String(req.session.userId);

        const data = readData();

        const profile = data.profiles.find(
            item => item.studentId === userId
        );

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        res.json({
            success: true,

profile: profile
    ? {
        ...profile,
        teachSkills: profile.teachSkills || []
    }
    : {
        studentId: userId,
        teachSkills: [],
        learnSkills: [],
        status: "Active"
    }
        });

    } catch (error) {
        console.error("Fetch own profile error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to fetch your skill profile."
        });
    }
});

// -----------------------------------------
// 4. DELETE CURRENT STUDENT'S SKILL PROFILE
// -----------------------------------------

router.delete("/mine", (req, res) => {
    try {
        const data = readData();

        data.profiles = data.profiles.filter(
            item => item.studentId !== String(req.session.userId)
        );

        saveData(data);

        res.json({
            success: true,
            message: "Skill profile deleted successfully."
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to delete skill profile."
        });
    }
});

// -----------------------------------------
// 5. SEND SKILL EXCHANGE REQUEST
// -----------------------------------------

router.post("/requests", async (req, res) => {
    try {
        const { receiverId } = req.body;

        const senderId = String(req.session.userId);

        if (!receiverId || !/^[a-f\d]{24}$/i.test(receiverId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid receiver ID."
            });
        }

        if (senderId === receiverId) {
            return res.status(400).json({
                success: false,
                message: "You cannot send a request to yourself."
            });
        }

        const receiver = await User.findById(receiverId);

        if (!receiver) {
            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        const data = readData();

        const existingRequest = data.requests.find(request =>
            (
                request.senderId === senderId &&
                request.receiverId === receiverId
            ) ||
            (
                request.senderId === receiverId &&
                request.receiverId === senderId
            )
        );

        if (existingRequest) {
            return res.status(409).json({
                success: false,
                message: "A skill exchange request already exists."
            });
        }

        const senderProfile = data.profiles.find(
            profile => profile.studentId === senderId
        );

        const receiverProfile = data.profiles.find(
            profile => profile.studentId === receiverId
        );

        if (!senderProfile || !receiverProfile) {
            return res.status(400).json({
                success: false,
                message: "Both students must save their learning skills first."
            });
        }

        const request = {
            id: randomUUID(),
            senderId,
            receiverId,
            status: "Pending",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        data.requests.push(request);

        saveData(data);

        res.status(201).json({
            success: true,
            message: "Skill exchange request sent successfully.",
            request
        });

    } catch (error) {
        console.error("Send request error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to send skill exchange request."
        });
    }
});

// -----------------------------------------
// 6. GET SENT AND RECEIVED REQUESTS
// -----------------------------------------

router.get("/requests/mine", (req, res) => {
    try {
        const data = readData();

        const userId = String(req.session.userId);

        const sent = data.requests.filter(
            request => request.senderId === userId
        );

        const received = data.requests.filter(
            request => request.receiverId === userId
        );

        res.json({
            success: true,
            sent,
            received
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to fetch exchange requests."
        });
    }
});

// -----------------------------------------
// 7. ACCEPT OR REJECT REQUEST
// -----------------------------------------

router.patch("/requests/:id", (req, res) => {
    try {
        const { status } = req.body;

        if (!["Accepted", "Rejected"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be Accepted or Rejected."
            });
        }

        const data = readData();

        const request = data.requests.find(
            item => item.id === req.params.id
        );

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Request not found."
            });
        }

        if (request.receiverId !== String(req.session.userId)) {
            return res.status(403).json({
                success: false,
                message: "You cannot update this request."
            });
        }

        if (request.status !== "Pending") {
            return res.status(400).json({
                success: false,
                message: "This request has already been processed."
            });
        }

        request.status = status;
        request.updatedAt = new Date().toISOString();

        saveData(data);

        res.json({
            success: true,
            message: `Request ${status.toLowerCase()} successfully.`,
            request
        });

    } catch (error) {
        console.error("Update request error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to update request."
        });
    }
});

module.exports = router;