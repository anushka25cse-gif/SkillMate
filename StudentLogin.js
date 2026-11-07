
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const rememberMe = document.getElementById("rememberMe");
const formMessage = document.getElementById("formMessage");
const forgotPassword = document.getElementById("forgotPassword");

// Restore the remembered email, if one was saved.
try {
    const savedEmail = localStorage.getItem("skillmateRememberedEmail");

    if (savedEmail) {
        emailInput.value = savedEmail;
        rememberMe.checked = true;
    }
} catch (error) {
    console.warn("Remembered email is unavailable in this browser.");
}

// Show or hide the password.
togglePassword.addEventListener("click", function () {
    const showingPassword = passwordInput.type === "password";

    passwordInput.type = showingPassword ? "text" : "password";
    togglePassword.textContent = showingPassword ? "Hide" : "Show";
    togglePassword.setAttribute(
        "aria-label",
        showingPassword ? "Hide password" : "Show password"
    );
});

// Display messages accessibly.
function showMessage(message, type) {
    formMessage.textContent = message;
    formMessage.className = "form-message " + type;
}

// Clear messages while the student edits the form.
emailInput.addEventListener("input", function () {
    formMessage.textContent = "";
    formMessage.className = "form-message";
});

passwordInput.addEventListener("input", function () {
    formMessage.textContent = "";
    formMessage.className = "form-message";
});

// Demo forgot-password interaction.
forgotPassword.addEventListener("click", function (event) {
    event.preventDefault();

    const email = emailInput.value.trim();

    if (!email) {
        showMessage(
            "Enter your college email ID first. Password recovery needs to be connected to an email service.",
            "error"
        );
        emailInput.focus();
        return;
    }

    showMessage(
        "Password recovery is not connected yet. Please contact your project administrator.",
        "error"
    );
});

// Sign in.
loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    if (!email || !password) {
        showMessage("Please enter both your email ID and password.", "error");
        return;
    }

    let users;

    try {
        users = JSON.parse(localStorage.getItem("skillmateUsers") || "[]");
    } catch (error) {
        showMessage("Unable to read saved accounts in this browser.", "error");
        return;
    }

    if (!Array.isArray(users) || users.length === 0) {
        showMessage(
            "No registered accounts were found. Create an account first, and make sure registration saves it to SkillMate.",
            "error"
        );
        return;
    }

    const matchedUser = users.find(function (user) {
        return (
            user.email &&
            user.email.trim().toLowerCase() === email &&
            user.password === password
        );
    });

    if (!matchedUser) {
        showMessage(
            "The email ID or password is incorrect. Please try again.",
            "error"
        );
        return;
    }

    // Remember only the email, never the password.
    try {
        if (rememberMe.checked) {
            localStorage.setItem("skillmateRememberedEmail", email);
        } else {
            localStorage.removeItem("skillmateRememberedEmail");
        }

        // Store the current demo session.
        sessionStorage.setItem(
            "skillmateCurrentUser",
            JSON.stringify({
                email: matchedUser.email,
                fullName: matchedUser.fullName || matchedUser.name || ""
            })
        );
    } catch (error) {
        showMessage(
            "Your browser could not save the session. Please check its storage settings.",
            "error"
        );
        return;
    }

    showMessage("Login successful! Opening your dashboard...", "success");

    // Create Dashboard.html before using this redirect.
    window.location.href = "Dashboard.html";
});
