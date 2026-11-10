document.addEventListener("DOMContentLoaded", function () {

    const $ = selector => document.querySelector(selector);

    // Feedback can only be submitted by a signed-in student.
    if (!SkillMate.requireAuth()) return;

    // SkillMate API client (api.js) owns the session and every server call.
    const api = SkillMate.api;

    const feedbackForm = $("#feedbackForm");
    const nameInput = $("#name");
    const emailInput = $("#email");
    const categoryInput = $("#feedbackCategory");
    const feedbackInput = $("#feedback");

    const statusMessage = $("#statusMessage");
    const characterCount = $("#characterCount");

    // Get the logged-in student's information (api.js caches it at login)

    const user = SkillMate.getUser() || {};

    const studentName = user.fullName || user.name || "";
    const studentEmail = user.email || "";

    // Display student name in the topbar

    const topUserName = $("#topUserName");
    const topAvatar = $("#topAvatar");

    if (topUserName) {
        topUserName.textContent =
            studentName ? studentName.split(/\s+/)[0] : "Student";
    }

    if (topAvatar) {
        topAvatar.textContent = studentName
            ? studentName.trim()
                .split(/\s+/)
                .slice(0, 2)
                .map(part => part[0].toUpperCase())
                .join("")
            : "S";
    }

    // Fill name and email when available

    if (studentName) {
        nameInput.value = studentName;
    }

    if (studentEmail) {
        emailInput.value = studentEmail;
    }

    // Show validation errors

    function showError(id, message) {
        const element = document.getElementById(id);

        if (element) {
            element.textContent = message;
        }
    }

    // Clear previous errors

    function clearErrors() {
        showError("nameError", "");
        showError("emailError", "");
        showError("categoryError", "");
        showError("ratingError", "");
        showError("feedbackError", "");

        statusMessage.textContent = "";
        statusMessage.className = "status-message";
    }

    // Show success or error message

    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
    }

    // Update character count

    feedbackInput.addEventListener("input", function () {
        characterCount.textContent = feedbackInput.value.length;
    });

    // Submit feedback form

    feedbackForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        clearErrors();

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const category = categoryInput.value;
        const feedbackText = feedbackInput.value.trim();

        const selectedRating = document.querySelector(
            'input[name="rating"]:checked'
        );

        let isValid = true;

        // Validate name

        if (name.length < 2) {
            showError(
                "nameError",
                "Please enter a name with at least 2 characters."
            );

            isValid = false;
        }

        // Validate email

        if (!email || !emailInput.checkValidity()) {
            showError(
                "emailError",
                "Please enter a valid email address."
            );

            isValid = false;
        }

        // Validate category

        if (!category) {
            showError(
                "categoryError",
                "Please select a feedback category."
            );

            isValid = false;
        }

        // Validate rating

        if (!selectedRating) {
            showError(
                "ratingError",
                "Please select a rating from 1 to 5."
            );

            isValid = false;
        }

        // Validate feedback text

        if (feedbackText.length < 10) {
            showError(
                "feedbackError",
                "Please write at least 10 characters."
            );

            isValid = false;
        }

        // Stop if any field is incorrect

        if (!isValid) {
            showStatus(
                "Please correct the highlighted fields.",
                "failure"
            );

            return;
        }

        // Store the feedback on the SkillMate server (Feedback.json)

        try {
            await api.submitFeedback({
                rating: Number(selectedRating.value),
                category: category,
                comments: feedbackText
            });
        } catch (error) {
            showStatus(
                error.message || "Feedback could not be saved. Please try again.",
                "failure"
            );

            return;
        }

        // Reset the form

        feedbackForm.reset();

        // Keep the logged-in student's details

        nameInput.value = studentName;
        emailInput.value = studentEmail;

        characterCount.textContent = "0";

        // Display confirmation

        showStatus(
            "Thank you! Your feedback has been submitted successfully.",
            "success"
        );

    });


    // Mobile sidebar

    const sidebar = $("#sidebar");
    const mobileMenu = $("#mobileMenu");

    if (mobileMenu && sidebar) {

        mobileMenu.addEventListener("click", function () {
            sidebar.classList.toggle("open");
        });

        document.addEventListener("click", function (event) {

            if (
                window.innerWidth <= 850 &&
                sidebar.classList.contains("open") &&
                !sidebar.contains(event.target) &&
                !mobileMenu.contains(event.target)
            ) {
                sidebar.classList.remove("open");
            }

        });
    }


    // Logout

    const logoutButton = $("#logoutBtn");

    if (logoutButton) {

        logoutButton.addEventListener("click", async function (event) {

            event.preventDefault();

            const confirmed = confirm("Are you sure you want to log out?");

            if (confirmed) {

                await SkillMate.api.logout();

                window.location.href = "./Login.html";
            }

        });
    }

});