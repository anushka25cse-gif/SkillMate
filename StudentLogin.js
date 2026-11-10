
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const rememberMe = document.getElementById("rememberMe");
const formMessage = document.getElementById("formMessage");
const forgotPassword = document.getElementById("forgotPassword");

// SkillMate frontend API client (api.js) owns the server address.

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
loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    if (!email || !password) {
        showMessage("Please enter both your email ID and password.", "error");
        return;
    }

    // Sign in through the SkillMate API.
    let matchedUser = null;

    try {
        const result = await SkillMate.api.login(email, password);

        matchedUser = result.user;
    } catch (error) {
        showMessage(
            error.message ||
                "The email ID or password is incorrect. Please try again.",
            "error"
        );
        return;
    }

    if (!matchedUser) {
        showMessage("Login failed. Please try again.", "error");
        return;
    }

    // Remember only the email, never the password.
    try {
        if (rememberMe.checked) {
            localStorage.setItem("skillmateRememberedEmail", email);
        } else {
            localStorage.removeItem("skillmateRememberedEmail");
        }
    } catch (error) {
        console.warn("Could not save the remembered email.");
    }

    if (!matchedUser.profileCompleted) {
        showMessage(
            "Your profile is not complete yet. Opening your profile setup...",
            "success"
        );
        window.location.href = "CompleteProfile.html";
        return;
    }

    showMessage("Login successful! Opening your dashboard...", "success");
    window.location.href = "Dashboard.html";
});
