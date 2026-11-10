const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const Connection = require("../models/Connection");
const User = require("../models/User");

const {
    readConnections,
    writeConnections
} = require("../utils/connectionStorage");

// SYNC CONNECTION DATA FROM MONGODB TO JSON
function syncConnectionToJson(connection) {
    const connections = readConnections();

    const connectionData = connection.toObject({
        depopulate: true
    });

    const existingIndex = connections.findIndex(
        item => item._id.toString() === connectionData._id.toString()
    );

    if (existingIndex !== -1) {
        connections[existingIndex] = connectionData;
    } else {
        connections.push(connectionData);
    }

    writeConnections(connections);
}

// Check whether student is logged in
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


// 1. Send a connection request
router.post("/request/:userId", async (req, res) => {
    try {
        const senderId = req.session.userId;
        const receiverId = req.params.userId;

        if (!mongoose.Types.ObjectId.isValid(receiverId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid student ID."
            });
        }

        if (senderId.toString() === receiverId) {
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

        // Check for an existing request in either direction
        const existingConnection = await Connection.findOne({
            $or: [
                { sender: senderId, receiver: receiverId },
                { sender: receiverId, receiver: senderId }
            ]
        });

        if (existingConnection) {

            if (existingConnection.status === "Accepted") {
                return res.status(400).json({
                    success: false,
                    message: "You are already connected."
                });
            }

            if (existingConnection.status === "Pending") {
                return res.status(400).json({
                    success: false,
                    message: "A connection request is already pending."
                });
            }

            // Allow the same student to send the request again
            if (
                existingConnection.sender.toString() === senderId.toString()
            ) {
                existingConnection.status = "Pending";
                await existingConnection.save();
                syncConnectionToJson(existingConnection);

                return res.status(200).json({
                    success: true,
                    message: "Connection request sent again.",
                    connection: existingConnection
                });
            }
        }

        const connection = await Connection.create({
            sender: senderId,
            receiver: receiverId,
            status: "Pending"
        });
        syncConnectionToJson(connection);

        res.status(201).json({
            success: true,
            message: "Connection request sent successfully.",
            connection
        });

    } catch (error) {
        console.error("Send connection request error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to send connection request."
        });
    }
});


// 2. Get received connection requests
router.get("/requests/received", async (req, res) => {
    try {
        const requests = await Connection.find({
            receiver: req.session.userId,
            status: "Pending"
        })
            .populate(
                "sender",
                "fullName email course year college knownSkills profilePhoto"
            )
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            requests
        });

    } catch (error) {
        console.error("Received requests error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to fetch received requests."
        });
    }
});


// 3. Get sent connection requests
router.get("/requests/sent", async (req, res) => {
    try {
        const requests = await Connection.find({
            sender: req.session.userId,
            status: "Pending"
        })
            .populate(
                "receiver",
                "fullName email course year college knownSkills profilePhoto"
            )
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            requests
        });

    } catch (error) {
        console.error("Sent requests error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to fetch sent requests."
        });
    }
});


// 4. Accept a connection request
router.patch("/:id/accept", async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid connection ID."
            });
        }

        const connection = await Connection.findOne({
            _id: req.params.id,
            receiver: req.session.userId,
            status: "Pending"
        });

        if (!connection) {
            return res.status(404).json({
                success: false,
                message: "Pending request not found."
            });
        }

        connection.status = "Accepted";
        await connection.save();
        syncConnectionToJson(connection);

        res.json({
            success: true,
            message: "Connection request accepted.",
            connection
        });

    } catch (error) {
        console.error("Accept request error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to accept connection request."
        });
    }
});


// 5. Reject a connection request
router.patch("/:id/reject", async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid connection ID."
            });
        }

        const connection = await Connection.findOne({
            _id: req.params.id,
            receiver: req.session.userId,
            status: "Pending"
        });

        if (!connection) {
            return res.status(404).json({
                success: false,
                message: "Pending request not found."
            });
        }

        connection.status = "Rejected";
        await connection.save();
        syncConnectionToJson(connection);
        res.json({
            success: true,
            message: "Connection request rejected."
        });

    } catch (error) {
        console.error("Reject request error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to reject connection request."
        });
    }
});


// 6. Get accepted connections
router.get("/", async (req, res) => {
    try {
        const connections = await Connection.find({
            $or: [
                { sender: req.session.userId },
                { receiver: req.session.userId }
            ],
            status: "Accepted"
        })
            .populate(
                "sender",
                "fullName email course year college knownSkills profilePhoto"
            )
            .populate(
                "receiver",
                "fullName email course year college knownSkills profilePhoto"
            )
            .sort({ updatedAt: -1 });

        res.json({
            success: true,
            connections
        });

    } catch (error) {
        console.error("Get connections error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to fetch connections."
        });
    }
});


// 7. Cancel a sent request or remove an accepted connection
router.delete("/:id", async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid connection ID."
            });
        }

        const connection = await Connection.findOne({
            _id: req.params.id,
            $or: [
                { sender: req.session.userId },
                { receiver: req.session.userId }
            ]
        });

        if (!connection) {
            return res.status(404).json({
                success: false,
                message: "Connection not found."
            });
        }

        if (
            connection.status === "Pending" &&
            connection.sender.toString() !== req.session.userId.toString()
        ) {
            return res.status(403).json({
                success: false,
                message: "Only the sender can cancel a pending request."
            });
        }

        await connection.deleteOne();
        const connections = readConnections();

const updatedConnections = connections.filter(
    item => item._id.toString() !== connection._id.toString()
);

writeConnections(updatedConnections);

        res.json({
            success: true,
            message: "Connection removed successfully."
        });

    } catch (error) {
        console.error("Remove connection error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to remove connection."
        });
    }
});


module.exports = router;