
require("dotenv").config();

const cors = require("cors");
const express = require("express");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const MongoStore = require("connect-mongo").default || require("connect-mongo");

const connectDB = require("./config/db");

// -----------------------------------------
// ROUTES
// -----------------------------------------

const userRoutes = require("./routes/userRoutes");
const projectRoutes = require("./routes/projectRoutes");
const connectionRoutes = require("./routes/connectionRoutes");
const skillExchangeRoutes = require("./routes/skillExchangeRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const savedPeopleRoutes = require("./routes/savedPeopleRoutes");
const messageRoutes = require("./routes/messagesRoutes");

// -----------------------------------------
// MODELS
// -----------------------------------------

const Project = require("./models/Project");
const Connection = require("./models/Connection");
const Feedback = require("./models/Feedback");
const Message = require("./models/Message");
const SkillExchange = require("./models/SkillExchange");
const SavedPeople = require("./models/SavedPeople");

// -----------------------------------------
// STORAGE FUNCTIONS
// -----------------------------------------

const { writeProjects } = require("./utils/projectStorage");
const { writeConnections } = require("./utils/connectionStorage");

const {
    readFeedback,
    writeFeedback
} = require("./utils/FeedbackStorage");

const {
    readSavedPeople,
    writeSavedPeople
} = require("./utils/SavedPeopleStorage");

// -----------------------------------------
// JSON FILE PATHS
// -----------------------------------------

const MESSAGE_FILE = path.join(__dirname, "data", "Messages.json");

const SKILL_EXCHANGE_FILE = path.join(
    __dirname,
    "data",
    "SkillExchange.json"
);

const app = express();

// -----------------------------------------
// CORS CONFIGURATION
// -----------------------------------------

app.use(cors({
    origin: [
        "http://127.0.0.1:5500",
        "http://localhost:5500"
    ],
    credentials: true
}));

app.use(express.json({ limit: "5mb" }));

app.use(express.urlencoded({
    extended: true,
    limit: "5mb"
}));

// -----------------------------------------
// SESSION CONFIGURATION
// -----------------------------------------

app.use(
    session({
        name: "skillmate.sid",
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,

        store: MongoStore.create({
            mongoUrl: process.env.MONGO_URI,
            collectionName: "sessions"
        }),

        cookie: {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 24 * 60 * 60 * 1000
        }
    })
);

// -----------------------------------------
// ROUTE CONNECTIONS
// -----------------------------------------

app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/connections", connectionRoutes);
app.use("/api/skill-exchange", skillExchangeRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/saved-people", savedPeopleRoutes);
app.use("/api/messages", messageRoutes);

// -----------------------------------------
// DEFAULT SAMPLE PROJECTS
// -----------------------------------------

const sampleProjects = [
    {
        title: "Campus Connect",
        category: "Web Development",
        description: "A student platform to discover campus events, clubs and people with shared interests.",
        skills: ["HTML & CSS", "JavaScript", "UI/UX Design"],
        teamSize: 5
    },
    {
        title: "Smart Study Buddy",
        category: "AI & Machine Learning",
        description: "An idea for a study companion that helps students organise learning and revision.",
        skills: ["Python", "Machine Learning", "UI/UX Design"],
        teamSize: 5
    },
    {
        title: "Green Campus Initiative",
        category: "Social Impact",
        description: "Explore creative ways to make campus life more sustainable and community-driven.",
        skills: ["Research", "Graphic Design", "Web Development"],
        teamSize: 5
    }
];

// -----------------------------------------
// INSERT SAMPLE PROJECTS
// -----------------------------------------

async function seedSampleProjects() {

    for (const sample of sampleProjects) {

        await Project.updateOne(
            {
                title: sample.title,
                isSample: true
            },
            {
                $setOnInsert: {
                    ...sample,
                    isSample: true,
                    createdBy: null,
                    members: [],
                    interestedUsers: [],
                    status: "Open"
                }
            },
            {
                upsert: true
            }
        );
    }

    console.log("Default sample projects checked successfully!");
}

// -----------------------------------------
// SYNC PROJECTS TO JSON
// -----------------------------------------

async function syncAllProjectsToJson() {

    const projects = await Project.find().lean();

    writeProjects(projects);

    console.log("Projects.json synced successfully!");
}

// -----------------------------------------
// SYNC CONNECTIONS TO JSON
// -----------------------------------------

async function syncAllConnectionsToJson() {

    const connections = await Connection.find().lean();

    writeConnections(connections);

    console.log("Connections.json synced successfully!");
}

// -----------------------------------------
// SYNC FEEDBACK BETWEEN JSON AND MONGODB
// -----------------------------------------

async function syncFeedbackBoth() {

    // Read existing feedback from JSON
    const jsonFeedback = readFeedback();

    // Transfer JSON feedback to MongoDB
    for (const feedback of jsonFeedback) {

        // Remove MongoDB-managed fields
        const {
            _id,
            __v,
            createdAt,
            updatedAt,
            ...feedbackData
        } = feedback;

        await Feedback.updateOne(
            {
                id: feedback.id
            },
            {
                $setOnInsert: feedbackData
            },
            {
                upsert: true
            }
        );
    }

    // Read all feedback from MongoDB
    const mongoFeedback = await Feedback.find().lean();

    // Merge feedback using unique IDs
    const feedbackMap = new Map();

    // Add JSON feedback
    jsonFeedback.forEach(feedback => {

        feedbackMap.set(feedback.id, {
            id: feedback.id,
            user: feedback.user,
            email: feedback.email,
            rating: feedback.rating,
            category: feedback.category,
            feedback: feedback.feedback,
            suggestions: feedback.suggestions || "",
            submittedAt: new Date(feedback.submittedAt).toISOString()
        });

    });

    // Add MongoDB feedback
    mongoFeedback.forEach(feedback => {

        feedbackMap.set(feedback.id, {
            id: feedback.id,
            user: feedback.user,
            email: feedback.email,
            rating: feedback.rating,
            category: feedback.category,
            feedback: feedback.feedback,
            suggestions: feedback.suggestions || "",
            submittedAt: feedback.submittedAt
                ? new Date(feedback.submittedAt).toISOString()
                : new Date().toISOString()
        });

    });

    // Save combined feedback to JSON
    writeFeedback(Array.from(feedbackMap.values()));

    console.log("Feedback.json and MongoDB synced successfully!");
    console.log(`Total feedback synchronized: ${feedbackMap.size}`);
}

// -----------------------------------------
// READ MESSAGES FROM JSON
// -----------------------------------------

function readMessagesFromJson() {

    const data = JSON.parse(
        fs.readFileSync(MESSAGE_FILE, "utf8")
    );

    return Array.isArray(data.messages)
        ? data.messages
        : [];
}

// -----------------------------------------
// WRITE MESSAGES TO JSON
// -----------------------------------------

function writeMessagesToJson(messages) {

    const temporaryFile = MESSAGE_FILE + ".tmp";

    fs.writeFileSync(
        temporaryFile,
        JSON.stringify({
            messages
        }, null, 4),
        "utf8"
    );

    fs.renameSync(temporaryFile, MESSAGE_FILE);
}

// -----------------------------------------
// SYNC MESSAGES BETWEEN JSON AND MONGODB
// -----------------------------------------

async function syncMessagesBoth() {

    // Read existing messages from JSON
    const jsonMessages = readMessagesFromJson();

    // Transfer missing JSON messages to MongoDB
    for (const message of jsonMessages) {

        await Message.updateOne(
            {
                id: message.id
            },
            {
                $setOnInsert: {
                    id: message.id,
                    senderId: message.senderId,
                    receiverId: message.receiverId,
                    senderName: message.senderName,
                    text: message.text,
                    createdAt: new Date(message.createdAt)
                }
            },
            {
                upsert: true
            }
        );
    }

    // Read all messages from MongoDB
    const mongoMessages = await Message.find()
        .sort({ createdAt: 1 })
        .lean();

    // Merge messages using unique IDs
    const messageMap = new Map();

    // Add JSON messages
    jsonMessages.forEach(message => {
        messageMap.set(message.id, message);
    });

    // Add MongoDB messages
    mongoMessages.forEach(message => {

        messageMap.set(message.id, {
            id: message.id,
            senderId: message.senderId,
            receiverId: message.receiverId,
            senderName: message.senderName,
            text: message.text,
            createdAt: new Date(message.createdAt).toISOString()
        });

    });

    // Convert Map into an array
    const allMessages = Array.from(messageMap.values());

    // Sort messages by date
    allMessages.sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );

    // Save combined messages to JSON
    writeMessagesToJson(allMessages);

    console.log("Messages.json and MongoDB synced successfully!");
    console.log(`Total messages synchronized: ${allMessages.length}`);
}

// -----------------------------------------
// SYNC SKILL EXCHANGE BETWEEN JSON AND MONGODB
// -----------------------------------------

async function syncSkillExchangeBoth() {

    // 1. Read existing Skill Exchange data from JSON

    let jsonData = JSON.parse(
        fs.readFileSync(SKILL_EXCHANGE_FILE, "utf8")
    );

    // Handle older JSON format
    if (Array.isArray(jsonData)) {
        jsonData = {
            profiles: jsonData,
            requests: []
        };
    }

    const jsonProfiles = Array.isArray(jsonData.profiles)
        ? jsonData.profiles
        : [];

    const jsonRequests = Array.isArray(jsonData.requests)
        ? jsonData.requests
        : [];

    // 2. Find existing MongoDB document

    let document = await SkillExchange.findOne();

    if (!document) {

        document = new SkillExchange({
            profiles: [],
            requests: []
        });

    }

    // 3. Merge profiles using studentId

    const profileMap = new Map();

    // First add JSON profiles
    jsonProfiles.forEach(profile => {

        profileMap.set(
            profile.studentId,
            profile
        );

    });

    // MongoDB records take priority if the same profile exists
    document.profiles.forEach(profile => {

        profileMap.set(
            profile.studentId,
            profile.toObject()
        );

    });

    // 4. Merge requests using unique request IDs

    const requestMap = new Map();

    // First add JSON requests
    jsonRequests.forEach(request => {

        requestMap.set(
            request.id,
            request
        );

    });

    // MongoDB records take priority if the same request exists
    document.requests.forEach(request => {

        requestMap.set(
            request.id,
            request.toObject()
        );

    });

    // 5. Save merged data in MongoDB

    document.profiles = Array.from(profileMap.values());

    document.requests = Array.from(requestMap.values());

    await document.save();

    // 6. Save the same merged data in JSON

    const finalData = {

        profiles: document.profiles.map(profile =>
            profile.toObject()
        ),

        requests: document.requests.map(request =>
            request.toObject()
        )

    };

    const temporaryFile = SKILL_EXCHANGE_FILE + ".tmp";

    fs.writeFileSync(
        temporaryFile,
        JSON.stringify(finalData, null, 4),
        "utf8"
    );

    fs.renameSync(
        temporaryFile,
        SKILL_EXCHANGE_FILE
    );

    console.log("SkillExchange.json and MongoDB synced successfully!");

    console.log(
        `Total skill profiles: ${finalData.profiles.length}`
    );

    console.log(
        `Total skill exchange requests: ${finalData.requests.length}`
    );
}

// -----------------------------------------
// SYNC SAVED PEOPLE BETWEEN JSON AND MONGODB
// -----------------------------------------

async function syncSavedPeopleBoth() {

    // 1. Read existing saved people from JSON
    const jsonSavedPeople = readSavedPeople();

    // 2. Find the existing MongoDB document
    let document = await SavedPeople.findOne();

    if (!document) {
        document = new SavedPeople({
            savedPeople: []
        });
    }

    // 3. Merge records using userId
    const savedPeopleMap = new Map();

    // Add JSON records first
    jsonSavedPeople.forEach(item => {

        savedPeopleMap.set(item.userId, {
            userId: item.userId,
            people: [...new Set(item.people || [])]
        });

    });

    // Merge MongoDB records with JSON records
    document.savedPeople.forEach(item => {

        const mongoItem = item.toObject();

        const existingItem = savedPeopleMap.get(mongoItem.userId);

        savedPeopleMap.set(mongoItem.userId, {
            userId: mongoItem.userId,
            people: [
                ...new Set([
                    ...(existingItem ? existingItem.people : []),
                    ...(mongoItem.people || [])
                ])
            ]
        });

    });

    // 4. Save merged records in MongoDB
    document.savedPeople = Array.from(savedPeopleMap.values());

    await document.save();

    // 5. Save the same records in JSON
    const finalSavedPeople = document.savedPeople.map(item =>
        item.toObject()
    );

    writeSavedPeople(finalSavedPeople);

    console.log("SavedPeople.json and MongoDB synced successfully!");

    console.log(
        `Total users with saved people: ${finalSavedPeople.length}`
    );
}

// -----------------------------------------
// TEST ROUTE
// -----------------------------------------

app.get("/", (req, res) => {

    res.send("SkillMate Backend is Running!");

});

// -----------------------------------------
// START SERVER
// -----------------------------------------

const startServer = async () => {

    try {

        await connectDB();

        await seedSampleProjects();

        await syncAllProjectsToJson();

        await syncAllConnectionsToJson();

        await syncFeedbackBoth();

        await syncMessagesBoth();

        await syncSkillExchangeBoth();

        await syncSavedPeopleBoth();

        const PORT = process.env.PORT || 5000;

        app.listen(PORT, () => {

            console.log(`SkillMate Server running on port ${PORT}`);

        });

    } catch (error) {

        console.error("Server startup failed:", error);

        process.exit(1);

    }

};

startServer();