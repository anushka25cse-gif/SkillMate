const mongoose = require("mongoose");

// -----------------------------------------
// STUDENT SKILL PROFILE SCHEMA
// -----------------------------------------

const profileSchema = new mongoose.Schema(
    {
        studentId: {
            type: String,
            required: true
        },

        teachSkills: {
            type: [String],
            default: []
        },

        learnSkills: {
            type: [String],
            default: []
        },

        status: {
            type: String,
            default: "Active"
        },

        createdAt: {
            type: Date,
            default: Date.now
        },

        updatedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        _id: false
    }
);

// -----------------------------------------
// SKILL EXCHANGE REQUEST SCHEMA
// -----------------------------------------

const requestSchema = new mongoose.Schema(
    {
        id: {
            type: String,
            required: true
        },

        senderId: {
            type: String,
            required: true
        },

        receiverId: {
            type: String,
            required: true
        },

        status: {
            type: String,
            enum: ["Pending", "Accepted", "Rejected"],
            default: "Pending"
        },

        createdAt: {
            type: Date,
            default: Date.now
        },

        updatedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        _id: false
    }
);

// -----------------------------------------
// MAIN SKILL EXCHANGE SCHEMA
// -----------------------------------------

const skillExchangeSchema = new mongoose.Schema(
    {
        profiles: {
            type: [profileSchema],
            default: []
        },

        requests: {
            type: [requestSchema],
            default: []
        }
    },
    {
        versionKey: false
    }
);

module.exports = mongoose.model(
    "SkillExchange",
    skillExchangeSchema
);