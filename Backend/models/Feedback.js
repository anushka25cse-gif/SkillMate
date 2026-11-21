const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
    {
        id: {
            type: String,
            required: true,
            unique: true
        },

        user: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            trim: true
        },

        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },

        category: {
            type: String,
            required: true,
            trim: true
        },

        feedback: {
            type: String,
            required: true,
            trim: true
        },

        suggestions: {
            type: String,
            default: ""
        },

        submittedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Feedback", feedbackSchema);