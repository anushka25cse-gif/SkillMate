const express = require("express");
const router = express.Router();

const Feedback = require("../models/Feedback");

const {
    readFeedback,
    writeFeedback
} = require("../utils/FeedbackStorage");

// Submit feedback
router.post("/", async (req, res) => {
    try {
        const {
            user,
            email,
            rating,
            category,
            feedback
        } = req.body;

        const newFeedback = {
            id: "feedback-" + Date.now(),
            user,
            email,
            rating: Number(rating),
            category,
            feedback,
            suggestions: feedback,
            submittedAt: new Date().toISOString()
        };

        // 1. Save feedback in JSON
        const allFeedback = readFeedback();

        allFeedback.push(newFeedback);

        writeFeedback(allFeedback);

        // 2. Save feedback in MongoDB
        const mongoFeedback = await Feedback.create(newFeedback);

        res.status(201).json({
            success: true,
            message: "Feedback submitted successfully.",
            feedback: newFeedback
        });

    } catch (error) {
        console.error("Submit feedback error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to save feedback."
        });
    }
});

module.exports = router;