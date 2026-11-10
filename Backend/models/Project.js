const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },

        category: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            required: true,
            trim: true
        },

        skills: {
            type: [String],
            default: []
        },

        teamSize: {
            type: Number,
            required: true,
            min: 1,
            default: 3
        },

        members: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],

        interestedUsers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        isSample: {
            type: Boolean,
            default: false
        },

        status: {
            type: String,
            enum: ["Open", "Closed"],
            default: "Open"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Project", projectSchema);