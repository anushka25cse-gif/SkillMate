document.addEventListener("DOMContentLoaded", function () {

    const API_URL = "http://127.0.0.1:5000/api/users/change-password";

    const form = document.getElementById("changePasswordForm");
    const currentPassword = document.getElementById("currentPassword");
    const newPassword = document.getElementById("newPassword");
    const confirmPassword = document.getElementById("confirmPassword");
    const message = document.getElementById("passwordMessage");
    const submitButton = document.getElementById("changePasswordBtn");

    function showMessage(text, success = false) {
        message.textContent = text;
        message.style.color = success ? "#16803c" : "#dc2626";
    }

    form.addEventListener("submit", async function (event) {

        event.preventDefault();

        const current = currentPassword.value;
        const newPass = newPassword.value;
        const confirm = confirmPassword.value;

        // Check new password length

        if (newPass.length < 8) {
            showMessage("New password must contain at least 8 characters.");
            return;
        }

        // Check whether new passwords match

        if (newPass !== confirm) {
            showMessage("New passwords do not match.");
            return;
        }

        // Check whether the new password is different

        if (current === newPass) {
            showMessage("New password must be different from your current password.");
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "Updating...";

        try {

            const response = await fetch(API_URL, {
                method: "PUT",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    currentPassword: current,
                    newPassword: newPass
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                showMessage(result.message || "Unable to change password.");
                return;
            }

            showMessage("Password changed successfully!", true);

            form.reset();

        } catch (error) {

            console.error("Change Password Error:", error);

            showMessage("Cannot connect to SkillMate server. Please try again.");

        } finally {

            submitButton.disabled = false;
            submitButton.textContent = "Update Password";

        }

    });

});