const express = require("express");
const router = express.Router();

const {
    readFeedback,
    writeFeedback
} = require("../utils/FeedbackStorage");

// Submit feedback
router.post("/", (req, res) => {
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

        const allFeedback = readFeedback();

        allFeedback.push(newFeedback);

        writeFeedback(allFeedback);

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