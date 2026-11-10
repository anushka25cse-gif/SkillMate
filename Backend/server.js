
require("dotenv").config();

const cors = require("cors");
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo").default || require("connect-mongo");

const connectDB = require("./config/db");

const userRoutes = require("./routes/userRoutes");
const projectRoutes = require("./routes/projectRoutes");
const connectionRoutes = require("./routes/connectionRoutes");
const skillExchangeRoutes = require("./routes/skillExchangeRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const savedPeopleRoutes = require("./routes/savedPeopleRoutes");
const messageRoutes = require("./routes/messagesRoutes");

const Project = require("./models/Project");
const { writeProjects } = require("./utils/projectStorage");
const Connection = require("./models/Connection");
const { writeConnections } = require("./utils/connectionStorage");

const app = express();

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

app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/connections", connectionRoutes);
app.use("/api/skill-exchange", skillExchangeRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/saved-people", savedPeopleRoutes);
app.use("/api/messages", messageRoutes);

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

async function syncAllProjectsToJson() {
    const projects = await Project.find().lean();
    writeProjects(projects);
    console.log("Projects.json synced successfully!");
}

async function syncAllConnectionsToJson() {
    const connections = await Connection.find().lean();
    writeConnections(connections);
    console.log("Connections.json synced successfully!");
}

app.get("/", (req, res) => {
    res.send("SkillMate Backend is Running!");
});

const startServer = async () => {
    try {
        await connectDB();

        await seedSampleProjects();
        await syncAllProjectsToJson();
        await syncAllConnectionsToJson();

        const PORT = process.env.PORT || 5000;

        app.listen(PORT, () => {
            console.log(`SkillMate Server running on port ${PORT}`);
        });

    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
};

startServer();
