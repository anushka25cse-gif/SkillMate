const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const rememberMe = document.getElementById("rememberMe");
const formMessage = document.getElementById("formMessage");
const forgotPassword = document.getElementById("forgotPassword");

// Backend API URL
const API_URL = "http://127.0.0.1:5000/api/users";

// Restore remembered email
try {
    const savedEmail = localStorage.getItem("skillmateRememberedEmail");

    if (savedEmail) {
        emailInput.value = savedEmail;
        rememberMe.checked = true;
    }
} catch (error) {
    console.warn("Remembered email is unavailable.");
}

// Show or hide password
togglePassword.addEventListener("click", function () {
    const showingPassword = passwordInput.type === "password";

    passwordInput.type = showingPassword ? "text" : "password";
    togglePassword.textContent = showingPassword ? "Hide" : "Show";

    togglePassword.setAttribute(
        "aria-label",
        showingPassword ? "Hide password" : "Show password"
    );
});

// Display messages
function showMessage(message, type) {
    formMessage.textContent = message;
    formMessage.className = "form-message " + type;
}

// Clear messages when editing
emailInput.addEventListener("input", function () {
    showMessage("", "");
});

passwordInput.addEventListener("input", function () {
    showMessage("", "");
});

// Forgot password
forgotPassword.addEventListener("click", function (event) {
    event.preventDefault();

    const email = emailInput.value.trim();

    if (!email) {
        showMessage("Enter your college email ID first.", "error");
        emailInput.focus();
        return;
    }

    showMessage(
        "Password recovery is not connected yet. Please contact your project administrator.",
        "error"
    );
});

// Login using MongoDB backend
loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    if (!email || !password) {
        showMessage(
            "Please enter both your email ID and password.",
            "error"
        );
        return;
    }

    const loginButton = loginForm.querySelector(".login-button");

    loginButton.disabled = true;
    loginButton.textContent = "Signing in...";

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            credentials: "include",

            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            showMessage(
                data.message || "Invalid email or password.",
                "error"
            );
            return;
        }

        // Remember only the email, never the password.
        try {
            if (rememberMe.checked) {
                localStorage.setItem(
                    "skillmateRememberedEmail",
                    email
                );
            } else {
                localStorage.removeItem("skillmateRememberedEmail");
            }
        } catch (error) {
            console.warn("Could not save remembered email.");
        }

        // Store basic user information for frontend display.
        // Authentication is maintained by the backend session cookie.
        sessionStorage.setItem(
            "skillmateCurrentUser",
            JSON.stringify(data.user)
        );

        showMessage(
            "Login successful! Opening your dashboard...",
            "success"
        );

        setTimeout(function () {
            window.location.href = "Dashboard.html";
        }, 1000);

    } catch (error) {
        console.error("Login error:", error);

        showMessage(
            "Unable to connect to the server. Please make sure your backend is running.",
            "error"
        );

    } finally {
        loginButton.disabled = false;
        loginButton.innerHTML = 'Sign In <span>→</span>';
    }
});