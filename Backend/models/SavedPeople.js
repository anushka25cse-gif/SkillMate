const mongoose = require("mongoose");

// Each user's saved people
const savedPeopleGroupSchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: true
        },
        people: {
            type: [String],
            default: []
        }
    },
    { _id: false }
);

// Main Saved People document
const savedPeopleSchema = new mongoose.Schema(
    {
        savedPeople: {
            type: [savedPeopleGroupSchema],
            default: []
        }
    },
    {
        versionKey: false
    }
);

module.exports = mongoose.model("SavedPeople", savedPeopleSchema);