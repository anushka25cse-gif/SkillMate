const express = require("express");
const router = express.Router();

const {
    readSavedPeople,
    writeSavedPeople
} = require("../utils/SavedPeopleStorage");

// Check whether the student is logged in
const checkLogin = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({
            success: false,
            message: "Please login first."
        });
    }

    next();
};

// GET SAVED PEOPLE
router.get("/", checkLogin, (req, res) => {
    try {
        const allSavedPeople = readSavedPeople();

        const userSavedPeople = allSavedPeople.find(
            item => item.userId === req.session.userId.toString()
        );

        res.json({
            success: true,
            savedPeople: userSavedPeople ? userSavedPeople.people : []
        });

    } catch (error) {
        console.error("Get saved people error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to fetch saved people."
        });
    }
});

// ADD A SAVED PERSON
router.post("/:personId", checkLogin, (req, res) => {
    try {
        const userId = req.session.userId.toString();
        const personId = req.params.personId;

        const allSavedPeople = readSavedPeople();

        let userSavedPeople = allSavedPeople.find(
            item => item.userId === userId
        );

        if (!userSavedPeople) {
            userSavedPeople = {
                userId,
                people: []
            };

            allSavedPeople.push(userSavedPeople);
        }

        if (!userSavedPeople.people.includes(personId)) {
            userSavedPeople.people.push(personId);
        }

        writeSavedPeople(allSavedPeople);

        res.json({
            success: true,
            message: "Person saved successfully.",
            savedPeople: userSavedPeople.people
        });

    } catch (error) {
        console.error("Save person error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to save person."
        });
    }
});

// REMOVE A SAVED PERSON
router.delete("/:personId", checkLogin, (req, res) => {
    try {
        const userId = req.session.userId.toString();
        const personId = req.params.personId;

        const allSavedPeople = readSavedPeople();

        const userSavedPeople = allSavedPeople.find(
            item => item.userId === userId
        );

        if (userSavedPeople) {
            userSavedPeople.people = userSavedPeople.people.filter(
                id => id !== personId
            );
        }

        writeSavedPeople(allSavedPeople);

        res.json({
            success: true,
            message: "Person removed successfully.",
            savedPeople: userSavedPeople ? userSavedPeople.people : []
        });

    } catch (error) {
        console.error("Remove saved person error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to remove person."
        });
    }
});

module.exports = router;