const express = require("express");
const router = express.Router();
console.log("UPDATED PROJECT ROUTES FILE LOADED");

const Project = require("../models/Project");

const {
    readProjects,
    writeProjects
} = require("../utils/projectStorage");

// Check whether the student is logged in
const checkLogin = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({
            success: false,
            message: "Please login first."
        });
    }

    next();
};


// Check whether the logged-in student created the project
const checkProjectOwner = (project, userId) => {
    return (
        project.createdBy &&
        project.createdBy.toString() === userId.toString()
    );
};

// SYNC PROJECT DATA FROM MONGODB TO JSON
function syncProjectToJson(project) {
    const projects = readProjects();

    const projectData = project.toObject({
        depopulate: true
    });

    const existingIndex = projects.findIndex(
        item => item._id.toString() === projectData._id.toString()
    );

    if (existingIndex !== -1) {
        projects[existingIndex] = projectData;
    } else {
        projects.push(projectData);
    }

    writeProjects(projects);
}

// -----------------------------------------
// 1. GET ALL PROJECTS
// -----------------------------------------

router.get("/", checkLogin, async (req, res) => {
    try {
        const projects = await Project.find()
            .populate("createdBy", "fullName email")
            .populate("members", "fullName email")
            .populate("interestedUsers", "fullName email")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            projects
        });

    } catch (error) {
        console.error("Fetch Projects Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to fetch projects."
        });
    }
});


// -----------------------------------------
// 2. GET MY PROJECTS
// -----------------------------------------

router.get("/mine", checkLogin, async (req, res) => {
    try {
        const projects = await Project.find({
            members: req.session.userId
        })
            .populate("createdBy", "fullName email")
            .populate("members", "fullName email")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            projects
        });

    } catch (error) {
        console.error("Fetch My Projects Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to fetch your projects."
        });
    }
});


// -----------------------------------------
// 3. CREATE A NEW PROJECT
// -----------------------------------------

router.post("/", checkLogin, async (req, res) => {
    try {
        const {
            title,
            category,
            description,
            skills,
            teamSize
        } = req.body;

        if (!title || !category || !description) {
            return res.status(400).json({
                success: false,
                message: "Please fill all required project details."
            });
        }

        const project = await Project.create({
            title,
            category,
            description,
            skills: Array.isArray(skills) ? skills : [],
            teamSize: Number(teamSize) || 3,
            createdBy: req.session.userId,
            members: [req.session.userId],
            interestedUsers: [],
            status: "Open",
            isSample: false
        });
        syncProjectToJson(project);

        const savedProject = await Project.findById(project._id)
            .populate("createdBy", "fullName email")
            .populate("members", "fullName email");

        res.status(201).json({
            success: true,
            message: "Project created successfully.",
            project: savedProject
        });

    } catch (error) {
        console.error("Create Project Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to create project."
        });
    }
});


// -----------------------------------------
// 4. EXPRESS INTEREST IN A PROJECT
// -----------------------------------------

router.post("/:id/interest", checkLogin, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found."
            });
        }

        const userId = req.session.userId.toString();

        if (checkProjectOwner(project, userId)) {
            return res.status(400).json({
                success: false,
                message: "You cannot request to join your own project."
            });
        }

        const members = project.members || [];
        const interestedUsers = project.interestedUsers || [];

        if (members.some(member => member.toString() === userId)) {
            return res.status(400).json({
                success: false,
                message: "You are already a team member."
            });
        }

        if (project.status === "Closed") {
            return res.status(400).json({
                success: false,
                message: "This project is closed."
            });
        }

        if (members.length >= project.teamSize) {
            return res.status(400).json({
                success: false,
                message: "This project has reached its maximum team size."
            });
        }

        if (interestedUsers.some(user => user.toString() === userId)) {
            return res.status(400).json({
                success: false,
                message: "You have already expressed interest."
            });
        }

        project.interestedUsers.push(req.session.userId);

        await project.save();
        syncProjectToJson(project);
        res.status(200).json({
            success: true,
            message: "Your interest has been sent successfully."
        });

    } catch (error) {
        console.error("Project Interest Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to send your interest."
        });
    }
});


// -----------------------------------------
// 5. VIEW JOIN REQUESTS
// -----------------------------------------

router.get("/:id/requests", checkLogin, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate("interestedUsers", "fullName email college knownSkills");

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found."
            });
        }

        if (!checkProjectOwner(project, req.session.userId)) {
            return res.status(403).json({
                success: false,
                message: "Only the project creator can view join requests."
            });
        }

        res.status(200).json({
            success: true,
            requests: project.interestedUsers
        });

    } catch (error) {
        console.error("Fetch Join Requests Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to fetch join requests."
        });
    }
});


// -----------------------------------------
// 6. ACCEPT A JOIN REQUEST
// -----------------------------------------

router.post("/:id/requests/:userId/accept", checkLogin, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found."
            });
        }

        if (!checkProjectOwner(project, req.session.userId)) {
            return res.status(403).json({
                success: false,
                message: "Only the project creator can accept requests."
            });
        }

        const requestedUserId = req.params.userId;

        const interestedUsers = project.interestedUsers || [];
        const members = project.members || [];

        const hasRequested = interestedUsers.some(
            user => user.toString() === requestedUserId
        );

        if (!hasRequested) {
            return res.status(404).json({
                success: false,
                message: "Join request not found."
            });
        }

        if (project.status === "Closed") {
            return res.status(400).json({
                success: false,
                message: "This project is closed."
            });
        }

        if (members.length >= project.teamSize) {
            return res.status(400).json({
                success: false,
                message: "Your team has reached its maximum size."
            });
        }

        const alreadyMember = members.some(
            member => member.toString() === requestedUserId
        );

        if (alreadyMember) {
            project.interestedUsers.pull(requestedUserId);

            await project.save();
            syncProjectToJson(project);

            return res.status(400).json({
                success: false,
                message: "This student is already a team member."
            });
        }

        project.members.push(requestedUserId);
        project.interestedUsers.pull(requestedUserId);

        await project.save();
        syncProjectToJson(project);
        console.log("MEMBERS AFTER ACCEPT:", project.members.map(id => id.toString()));

        res.status(200).json({
            success: true,
            message: "Join request accepted successfully."
        });

    } catch (error) {
        console.error("Accept Request Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to accept join request."
        });
    }
});


// -----------------------------------------
// 7. REJECT A JOIN REQUEST
// -----------------------------------------

router.post("/:id/requests/:userId/reject", checkLogin, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found."
            });
        }

        if (!checkProjectOwner(project, req.session.userId)) {
            return res.status(403).json({
                success: false,
                message: "Only the project creator can reject requests."
            });
        }

        const requestedUserId = req.params.userId;

        const hasRequested = (project.interestedUsers || []).some(
            user => user.toString() === requestedUserId
        );

        if (!hasRequested) {
            return res.status(404).json({
                success: false,
                message: "Join request not found."
            });
        }

        project.interestedUsers.pull(requestedUserId);

        await project.save();
        syncProjectToJson(project);

        res.status(200).json({
            success: true,
            message: "Join request rejected successfully."
        });

    } catch (error) {
        console.error("Reject Request Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to reject join request."
        });
    }
});


// -----------------------------------------
// 8. TEAM LEADER REMOVES A MEMBER
// -----------------------------------------

router.delete("/:id/members/:userId", checkLogin, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found."
            });
        }

        // Only the project creator can remove members
        if (!checkProjectOwner(project, req.session.userId)) {
            return res.status(403).json({
                success: false,
                message: "Only the team leader can remove members."
            });
        }

        const memberId = req.params.userId;

        // Team leader cannot remove themselves
        if (memberId === req.session.userId.toString()) {
            return res.status(400).json({
                success: false,
                message: "You cannot remove yourself as the team leader."
            });
        }

        const isMember = (project.members || []).some(
            member => member.toString() === memberId
        );

        if (!isMember) {
            return res.status(404).json({
                success: false,
                message: "Team member not found."
            });
        }

        project.members.pull(memberId);

        await project.save();
        syncProjectToJson(project);

        res.status(200).json({
            success: true,
            message: "Team member removed successfully."
        });

    } catch (error) {
        console.error("Remove Team Member Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to remove team member."
        });
    }
});


// -----------------------------------------
// 9. TEAM MEMBER LEAVES A PROJECT
// -----------------------------------------

router.delete("/:id/leave", checkLogin, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found."
            });
        }

        const userId = req.session.userId.toString();

        // Project creator cannot leave their own project
        if (checkProjectOwner(project, userId)) {
            return res.status(400).json({
                success: false,
                message: "The team leader cannot leave their own project."
            });
        }

        const isMember = (project.members || []).some(
            member => member.toString() === userId
        );

        if (!isMember) {
            return res.status(400).json({
                success: false,
                message: "You are not a member of this project."
            });
        }

        // Remove the student from the team
        project.members.pull(userId);

        // Also remove any pending interest request
        project.interestedUsers.pull(userId);

        await project.save();
        syncProjectToJson(project);
        console.log("New project synced to Projects.json:", project.title);

        res.status(200).json({
            success: true,
            message: "You have successfully left the project."
        });

    } catch (error) {
        console.error("Leave Project Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to leave the project."
        });
    }
});


module.exports = router;