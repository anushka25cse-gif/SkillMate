const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
    {
        id: {
            type: String,
            required: true,
            unique: true
        },

        senderId: {
            type: String,
            required: true
        },

        receiverId: {
            type: String,
            required: true
        },

        senderName: {
            type: String,
            required: true,
            trim: true
        },

        text: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000
        },

        createdAt: {
            type: Date,
            default: Date.now
        }
    }
);

module.exports = mongoose.model("Message", messageSchema);