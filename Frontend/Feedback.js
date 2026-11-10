document.addEventListener("DOMContentLoaded", function () {

    const $ = selector => document.querySelector(selector);

    const FEEDBACK_KEY = "skillmateFeedback";

    const feedbackForm = $("#feedbackForm");
    const nameInput = $("#name");
    const emailInput = $("#email");
    const categoryInput = $("#feedbackCategory");
    const feedbackInput = $("#feedback");

    const statusMessage = $("#statusMessage");
    const characterCount = $("#characterCount");

    // Read data from localStorage

    function readJSON(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key));
            return value ?? fallback;
        } catch (error) {
            return fallback;
        }
    }

    // Read data from sessionStorage

    function readSession(key, fallback) {
        try {
            const value = JSON.parse(sessionStorage.getItem(key));
            return value ?? fallback;
        } catch (error) {
            return fallback;
        }
    }

    // Save data in localStorage

    function saveJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error("Storage error:", error);
            return false;
        }
    }

    // Get the logged-in student's information

    const currentUser =
        readSession("skillmateCurrentUser", null) ||
        readJSON("skillmateCurrentUser", null) ||
        {};

    const signupDraft =
        readSession("skillmateSignupDraft", null) ||
        readJSON("skillmateSignupDraft", {});

    const user = {
        ...signupDraft,
        ...currentUser
    };

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
            console.log("Status message:", message, "Type:", type);
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

// Send feedback to backend

try {
    const response = await fetch("http://127.0.0.1:5000/api/feedback", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
            user: name,
            email: email,
            rating: Number(selectedRating.value),
            category: category,
            feedback: feedbackText
        })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
        showStatus(
            result.message || "Feedback could not be saved.",
            "failure"
        );

        return;
    }

} catch (error) {
    console.error("Feedback submission error:", error);

    showStatus(
        "Unable to connect to the backend. Please try again.",
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

        logoutButton.addEventListener("click", function (event) {

            event.preventDefault();

            const confirmed = confirm("Are you sure you want to log out?");

            if (confirmed) {

                localStorage.removeItem("skillmateCurrentUser");
                sessionStorage.removeItem("skillmateCurrentUser");

                window.location.href = "./Login.html";
            }

        });
    }

});