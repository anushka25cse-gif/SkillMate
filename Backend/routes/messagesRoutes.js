const express = require("express");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { randomUUID } = require("crypto");

const Connection = require("../models/Connection");
const User = require("../models/User");
const Message = require("../models/Message");

const router = express.Router();

const DATA_FILE = path.join(__dirname, "../data/Messages.json");

// -----------------------------------------
// CHECK LOGIN
// -----------------------------------------

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

// -----------------------------------------
// READ MESSAGES FROM JSON
// -----------------------------------------

function readMessages() {
    try {
        const data = JSON.parse(
            fs.readFileSync(DATA_FILE, "utf8")
        );

        return Array.isArray(data.messages)
            ? data.messages
            : [];

    } catch (error) {
        console.error("Messages JSON read error:", error);
        throw error;
    }
}

// -----------------------------------------
// SAVE MESSAGES TO JSON
// -----------------------------------------

function saveMessages(messages) {
    try {
        const temporaryFile = DATA_FILE + ".tmp";

        fs.writeFileSync(
            temporaryFile,
            JSON.stringify({ messages }, null, 4),
            "utf8"
        );

        fs.renameSync(temporaryFile, DATA_FILE);

        return true;

    } catch (error) {
        console.error("Messages JSON save error:", error);
        return false;
    }
}

// -----------------------------------------
// CHECK ACCEPTED CONNECTION
// -----------------------------------------

async function checkAcceptedConnection(userId, otherUserId) {
    return Connection.findOne({
        status: "Accepted",
        $or: [
            { sender: userId, receiver: otherUserId },
            { sender: otherUserId, receiver: userId }
        ]
    });
}

// -----------------------------------------
// GET ALL ACCEPTED CHAT CONTACTS
// -----------------------------------------

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

// -----------------------------------------
// GET CONVERSATION WITH A STUDENT
// -----------------------------------------

router.get("/:userId", async (req, res) => {
    try {
        const currentUserId = req.session.userId.toString();
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

        // Fetch conversation from MongoDB
        const conversation = await Message.find({
            $or: [
                {
                    senderId: currentUserId,
                    receiverId: otherUserId
                },
                {
                    senderId: otherUserId,
                    receiverId: currentUserId
                }
            ]
        })
            .sort({ createdAt: 1 })
            .lean();

        // Convert MongoDB records to frontend format
        const formattedMessages = conversation.map(message => ({
            id: message.id,
            senderId: message.senderId,
            receiverId: message.receiverId,
            senderName: message.senderName,
            text: message.text,
            createdAt: new Date(message.createdAt).toISOString()
        }));

        res.json({
            success: true,
            messages: formattedMessages
        });

    } catch (error) {
        console.error("Messages conversation error:", error);

        res.status(500).json({
            success: false,
            message: "Could not load conversation."
        });
    }
});

// -----------------------------------------
// SEND A NEW MESSAGE
// -----------------------------------------

router.post("/:userId", async (req, res) => {
    try {
        const currentUserId = req.session.userId.toString();
        const otherUserId = req.params.userId;

        const text = String(req.body.text || "").trim();

        // Validate receiver ID
        if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid student ID."
            });
        }

        // Validate message text
        if (!text || text.length > 1000) {
            return res.status(400).json({
                success: false,
                message: "Message must contain 1 to 1000 characters."
            });
        }

        // Prevent messaging yourself
        if (currentUserId === otherUserId) {
            return res.status(400).json({
                success: false,
                message: "You cannot message yourself."
            });
        }

        // Check accepted connection
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

        // Find receiver
        const receiver = await User.findById(otherUserId);

        if (!receiver) {
            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        // Find sender
        const sender = await User.findById(currentUserId);

        if (!sender) {
            return res.status(404).json({
                success: false,
                message: "Sender not found."
            });
        }

        // Create message
        const newMessage = {
            id: randomUUID(),
            senderId: currentUserId,
            receiverId: otherUserId,
            senderName: sender.fullName,
            text,
            createdAt: new Date().toISOString()
        };

        // ---------------------------------
        // 1. SAVE IN JSON
        // ---------------------------------

        const messages = readMessages();

        messages.push(newMessage);

        if (!saveMessages(messages)) {
            return res.status(500).json({
                success: false,
                message: "Message could not be saved in JSON."
            });
        }

        // ---------------------------------
        // 2. SAVE IN MONGODB
        // ---------------------------------

        try {

            await Message.create(newMessage);

        } catch (mongoError) {

            // Remove JSON entry if MongoDB saving fails
            const updatedMessages = messages.filter(
                message => message.id !== newMessage.id
            );

            saveMessages(updatedMessages);

            throw mongoError;
        }

        // ---------------------------------
        // SUCCESS RESPONSE
        // ---------------------------------

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