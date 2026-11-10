const express = require("express");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { randomUUID } = require("crypto");

const Connection = require("../models/Connection");
const User = require("../models/User");

const router = express.Router();

const DATA_FILE = path.join(__dirname, "../data/Messages.json");

// Check whether the student is logged in
function checkLogin(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({
            success: false,
            message: "Please log in first."
        });
    }

    next();
}

router.use(checkLogin);

// Read messages from JSON file
function readMessages() {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

        return Array.isArray(data.messages) ? data.messages : [];
    } catch (error) {
        console.error("Messages JSON read error:", error);

        return [];
    }
}

// Save messages to JSON file
function saveMessages(messages) {
    try {
        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify({ messages }, null, 4)
        );

        return true;
    } catch (error) {
        console.error("Messages JSON save error:", error);

        return false;
    }
}

// Check whether two students are accepted connections
async function checkAcceptedConnection(userId, otherUserId) {
    return Connection.findOne({
        status: "Accepted",
        $or: [
            { sender: userId, receiver: otherUserId },
            { sender: otherUserId, receiver: userId }
        ]
    });
}

// GET all accepted chat contacts
router.get("/contacts", async (req, res) => {
    try {
        const userId = req.session.userId;

        const connections = await Connection.find({
            status: "Accepted",
            $or: [
                { sender: userId },
                { receiver: userId }
            ]
        }).populate(
            "sender receiver",
            "fullName email course year college profilePhoto"
        );

        const contacts = connections.map(connection => {
            const otherUser =
                connection.sender._id.toString() === userId.toString()
                    ? connection.receiver
                    : connection.sender;

            return otherUser;
        });

        res.json({
            success: true,
            contacts
        });

    } catch (error) {
        console.error("Messages contacts error:", error);

        res.status(500).json({
            success: false,
            message: "Could not load chat contacts."
        });
    }
});

// GET conversation with a particular student
router.get("/:userId", async (req, res) => {
    try {
        const currentUserId = req.session.userId;
        const otherUserId = req.params.userId;

        if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid student ID."
            });
        }

        const connection = await checkAcceptedConnection(
            currentUserId,
            otherUserId
        );

        if (!connection) {
            return res.status(403).json({
                success: false,
                message: "You can message only accepted connections."
            });
        }

        const allMessages = readMessages();

        const conversation = allMessages.filter(message =>
            (
                message.senderId === currentUserId.toString() &&
                message.receiverId === otherUserId
            ) ||
            (
                message.senderId === otherUserId &&
                message.receiverId === currentUserId.toString()
            )
        );

        conversation.sort(
            (a, b) =>
                new Date(a.createdAt) - new Date(b.createdAt)
        );

        res.json({
            success: true,
            messages: conversation
        });

    } catch (error) {
        console.error("Messages conversation error:", error);

        res.status(500).json({
            success: false,
            message: "Could not load conversation."
        });
    }
});

// POST a new message
router.post("/:userId", async (req, res) => {
    try {
        const currentUserId = req.session.userId;
        const otherUserId = req.params.userId;

        const text = String(req.body.text || "").trim();

        if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid student ID."
            });
        }

        if (!text || text.length > 1000) {
            return res.status(400).json({
                success: false,
                message: "Message must contain 1 to 1000 characters."
            });
        }

        if (currentUserId.toString() === otherUserId) {
            return res.status(400).json({
                success: false,
                message: "You cannot message yourself."
            });
        }

        const connection = await checkAcceptedConnection(
            currentUserId,
            otherUserId
        );

        if (!connection) {
            return res.status(403).json({
                success: false,
                message: "You can message only accepted connections."
            });
        }

        const receiver = await User.findById(otherUserId);

        if (!receiver) {
            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        const sender = await User.findById(currentUserId);

        const messages = readMessages();

        const newMessage = {
            id: randomUUID(),
            senderId: currentUserId.toString(),
            receiverId: otherUserId,
            senderName: sender.fullName,
            text,
            createdAt: new Date().toISOString()
        };

        messages.push(newMessage);

        if (!saveMessages(messages)) {
            return res.status(500).json({
                success: false,
                message: "Message could not be saved."
            });
        }

        res.status(201).json({
            success: true,
            message: "Message sent successfully.",
            data: newMessage
        });

    } catch (error) {
        console.error("Send message error:", error);

        res.status(500).json({
            success: false,
            message: "Could not send message."
        });
    }
});

module.exports = router;