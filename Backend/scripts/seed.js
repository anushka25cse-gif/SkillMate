"use strict";

/**
 * Seed the JSON database with the SkillMate demo data.
 *
 * Usage:
 *   npm run seed            # writes all seven files (backs up the old ones)
 *   npm run seed -- --reset # same, but also clears every collection first
 *
 * The demo students all use the password: skillmate123
 * (documented in README.md and API_DOCUMENTATION.md — demo data only).
 */

const fs = require("fs/promises");
const path = require("path");
const bcrypt = require("bcryptjs");

const { JsonDatabase } = require("../utils/jsonDatabase");
const config = require("../config");

const db = new JsonDatabase(config.dataDir);

const DEMO_PASSWORD = "skillmate123";

function isoDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
}

async function backupExisting() {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = path.join(config.dataDir, "backups", stamp);

    let found = false;

    for (const file of [
        "User.json",
        "Projects.json",
        "Connections.json",
        "SkillExchange.json",
        "Messages.json",
        "Feedback.json",
        "Savedpeople.json"
    ]) {
        const source = path.join(config.dataDir, file);

        try {
            const content = await fs.readFile(source, "utf8");

            if (!found) {
                await fs.mkdir(backupDir, { recursive: true });
                found = true;
            }

            await fs.writeFile(path.join(backupDir, file), content, "utf8");
        } catch (error) {
            if (error.code !== "ENOENT") throw error;
        }
    }

    if (found) {
        console.log(`Backed up the previous data to ${backupDir}`);
    }
}

async function seed() {
    const reset = process.argv.includes("--reset");

    await db.ensureCollections();

    if (reset) {
        console.log("--reset: clearing every collection.");
    } else {
        await backupExisting();
    }

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, config.bcryptRounds);

    const students = [
        {
            id: "U001",
            name: "Aarav Sharma",
            email: "aarav@example.com",
            course: "B.Tech",
            year: "2nd Year",
            college: "BML Munjal University",
            registration: "BMU2024001",
            graduation: "2027",
            skills: ["Python", "Machine Learning", "Data Analytics"],
            teachSkills: ["Python", "Machine Learning"],
            learningSkills: ["Figma", "UI/UX Design", "JavaScript"],
            interests: ["Artificial Intelligence", "Research"],
            bio: "AI enthusiast who enjoys turning interesting ideas into working prototypes.",
            proficiency: "Intermediate",
            availability: "Weekends",
            collaboration: "Remote"
        },
        {
            id: "U002",
            name: "Riya Kapoor",
            email: "riya@example.com",
            course: "B.Tech",
            year: "2nd Year",
            college: "BML Munjal University",
            registration: "BMU2024002",
            graduation: "2027",
            skills: ["UI/UX Design", "Figma", "Web Development"],
            teachSkills: ["Figma", "UI/UX Design", "Graphic Design"],
            learningSkills: ["Python", "Machine Learning", "SQL"],
            interests: ["Product Design", "Hackathons"],
            bio: "Building thoughtful digital experiences through design and code.",
            proficiency: "Advanced",
            availability: "Evenings",
            collaboration: "Hybrid"
        },
        {
            id: "U003",
            name: "Mehak Verma",
            email: "mehak@example.com",
            course: "B.Des",
            year: "2nd Year",
            college: "BML Munjal University",
            registration: "BMU2024003",
            graduation: "2027",
            skills: ["Graphic Design", "Figma", "Content Writing"],
            teachSkills: ["Graphic Design", "Figma", "Illustration"],
            learningSkills: ["Python", "Web Development", "JavaScript"],
            interests: ["Art", "Branding"],
            bio: "Creative thinker who loves branding, visual storytelling and collaboration.",
            proficiency: "Advanced",
            availability: "Weekdays",
            collaboration: "In person"
        },
        {
            id: "U004",
            name: "Kabir Malhotra",
            email: "kabir@example.com",
            course: "B.Tech",
            year: "1st Year",
            college: "BML Munjal University",
            registration: "BMU2025004",
            graduation: "2028",
            skills: ["JavaScript", "Web Development", "HTML & CSS"],
            teachSkills: ["Web Development", "JavaScript", "HTML & CSS"],
            learningSkills: ["UI/UX Design", "Figma", "Graphic Design"],
            interests: ["Startups", "Web Apps"],
            bio: "Web developer learning to build useful tools for campus life.",
            proficiency: "Intermediate",
            availability: "Weekends",
            collaboration: "Remote"
        },
        {
            id: "U005",
            name: "Sana Ali",
            email: "sana@example.com",
            course: "B.Tech",
            year: "2nd Year",
            college: "BML Munjal University",
            registration: "BMU2024005",
            graduation: "2027",
            skills: ["Python", "SQL", "Data Analytics"],
            teachSkills: ["SQL", "Python", "Data Analytics"],
            learningSkills: ["Figma", "UI/UX Design", "Content Writing"],
            interests: ["Analytics", "Social Impact"],
            bio: "Interested in data, problem-solving and projects with real-world impact.",
            proficiency: "Intermediate",
            availability: "Evenings",
            collaboration: "Hybrid"
        },
        {
            id: "U006",
            name: "Dev Mehta",
            email: "dev@example.com",
            course: "B.Tech",
            year: "1st Year",
            college: "BML Munjal University",
            registration: "BMU2025006",
            graduation: "2028",
            skills: ["Java", "C / C++", "Problem Solving"],
            teachSkills: ["Java", "C / C++", "Python"],
            learningSkills: ["Web Development", "Graphic Design", "Video Editing"],
            interests: ["Coding", "Competitive Programming"],
            bio: "Learning Java and exploring how good software gets built in teams.",
            proficiency: "Beginner",
            availability: "Weekdays",
            collaboration: "In person"
        }
    ];

    const users = students.map((student, index) => ({
        ...student,
        passwordHash,
        profileImage: "",
        profileCompleted: true,
        createdAt: isoDaysAgo(40 - index * 3),
        updatedAt: isoDaysAgo(index)
    }));

    const projects = [
        {
            id: "P001",
            title: "Campus Connect",
            description:
                "A student platform to discover campus events, clubs and people with shared interests.",
            category: "Web Development",
            requiredSkills: ["HTML & CSS", "JavaScript", "UI/UX Design"],
            creatorId: "U004",
            teamMembers: ["U004", "U003"],
            teamSize: 4,
            status: "Looking for teammates",
            emoji: "✦",
            joinRequests: [],
            createdAt: isoDaysAgo(21),
            updatedAt: isoDaysAgo(4)
        },
        {
            id: "P002",
            title: "Smart Study Buddy",
            description:
                "A study companion that helps students organise learning and revision with spaced repetition.",
            category: "AI & Machine Learning",
            requiredSkills: ["Python", "Machine Learning", "UI/UX Design"],
            creatorId: "U002",
            teamMembers: ["U002"],
            teamSize: 3,
            status: "Open",
            emoji: "✳",
            joinRequests: [],
            createdAt: isoDaysAgo(14),
            updatedAt: isoDaysAgo(2)
        },
        {
            id: "P003",
            title: "Green Campus Initiative",
            description:
                "Creative ways to make campus life more sustainable and community-driven.",
            category: "Social Impact",
            requiredSkills: ["Research", "Graphic Design", "Web Development"],
            creatorId: "U005",
            teamMembers: ["U005", "U006", "U001"],
            teamSize: 5,
            status: "Open",
            emoji: "❋",
            joinRequests: [],
            createdAt: isoDaysAgo(9),
            updatedAt: isoDaysAgo(1)
        }
    ];

    const connections = [
        {
            id: "C001",
            senderId: "U002",
            receiverId: "U001",
            status: "pending",
            createdAt: isoDaysAgo(3),
            updatedAt: isoDaysAgo(3)
        },
        {
            id: "C002",
            senderId: "U004",
            receiverId: "U001",
            status: "pending",
            createdAt: isoDaysAgo(2),
            updatedAt: isoDaysAgo(2)
        },
        {
            id: "C003",
            senderId: "U003",
            receiverId: "U002",
            status: "accepted",
            createdAt: isoDaysAgo(8),
            updatedAt: isoDaysAgo(7)
        },
        {
            id: "C004",
            senderId: "U001",
            receiverId: "U006",
            status: "accepted",
            createdAt: isoDaysAgo(12),
            updatedAt: isoDaysAgo(11)
        }
    ];

    const messages = [
        {
            id: "M001",
            senderId: "U003",
            receiverId: "U002",
            content: "Hi Riya! Loved your Figma prototype for the campus app.",
            timestamp: isoDaysAgo(2),
            read: true
        },
        {
            id: "M002",
            senderId: "U002",
            receiverId: "U003",
            content: "Thank you! Want to pair up on the visual design for Campus Connect?",
            timestamp: isoDaysAgo(2),
            read: true
        },
        {
            id: "M003",
            senderId: "U003",
            receiverId: "U002",
            content: "Absolutely. I can start on the branding next week.",
            timestamp: isoDaysAgo(1),
            read: false
        },
        {
            id: "M004",
            senderId: "U006",
            receiverId: "U001",
            content: "Hello! How are you?",
            timestamp: isoDaysAgo(1),
            read: false
        }
    ];

    const feedback = [
        {
            id: "F001",
            studentId: "U001",
            rating: 5,
            category: "Platform",
            comments: "The platform is easy to use and the skill matching is genuinely useful.",
            createdAt: isoDaysAgo(6)
        },
        {
            id: "F002",
            studentId: "U003",
            rating: 4,
            category: "Skill Exchange",
            comments: "Found a design partner in two days. Would love a calendar view for swaps.",
            createdAt: isoDaysAgo(5)
        }
    ];

    const savedPeople = [
        {
            id: "SP001",
            userId: "U001",
            savedStudentId: "U004",
            createdAt: isoDaysAgo(4)
        },
        {
            id: "SP002",
            userId: "U001",
            savedStudentId: "U006",
            createdAt: isoDaysAgo(3)
        }
    ];

    const skillExchange = [
        {
            id: "S001",
            studentId: "U001",
            skillsToTeach: ["Python", "Machine Learning"],
            skillsToLearn: ["Figma", "UI/UX Design"],
            matchedStudentId: "U002",
            message: "I can help with the ML model if you can review our UI.",
            status: "pending",
            createdAt: isoDaysAgo(2),
            updatedAt: isoDaysAgo(2)
        },
        {
            id: "S002",
            studentId: "U003",
            skillsToTeach: ["Graphic Design", "Figma"],
            skillsToLearn: ["Python", "Web Development"],
            matchedStudentId: "U001",
            message: "Happy to swap design for some Python basics!",
            status: "pending",
            createdAt: isoDaysAgo(1),
            updatedAt: isoDaysAgo(1)
        }
    ];

    await db.writeAll("users", users);
    await db.writeAll("projects", projects);
    await db.writeAll("connections", connections);
    await db.writeAll("messages", messages);
    await db.writeAll("feedback", feedback);
    await db.writeAll("savedPeople", savedPeople);
    await db.writeAll("skillExchange", skillExchange);

    console.log("");
    console.log("Seeded SkillMate demo data:");
    console.log(`  users:         ${users.length}`);
    console.log(`  projects:      ${projects.length}`);
    console.log(`  connections:   ${connections.length}`);
    console.log(`  messages:      ${messages.length}`);
    console.log(`  feedback:      ${feedback.length}`);
    console.log(`  saved people:  ${savedPeople.length}`);
    console.log(`  skill swaps:   ${skillExchange.length}`);
    console.log("");
    console.log(`Demo login: aarav@example.com / ${DEMO_PASSWORD}`);
    console.log("");
}

seed().catch(error => {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
});
