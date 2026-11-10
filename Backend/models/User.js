const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        // Basic Account Details
        fullName: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        passwordHash: {
            type: String,
            required: true
        },

        // Academic Details
        college: { type: String, default: "" },
        registration: { type: String, default: "" },
        course: { type: String, default: "" },
        year: { type: String, default: "" },
        graduation: { type: String, default: "" },

        // Skills
        knownSkills: {
            type: [String],
            default: []
        },

        teachSkills: {
            type: [String],
            default: []
        },

        // Profile Information
        bio: {
            type: String,
            default: ""
        },

        interests: {
            type: [String],
            default: []
        },

        profilePhoto: {
            type: String,
            default: ""
        },

        // Collaboration Preferences
        proficiency: { type: String, default: "" },
        availability: { type: String, default: "" },
        collaboration: { type: String, default: "" }
    },
    {
        timestamps: true
    }
);

const User = mongoose.model("User", userSchema);

module.exports = User;