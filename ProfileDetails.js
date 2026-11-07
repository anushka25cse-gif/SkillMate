
document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("signupForm");
    const message = document.getElementById("formMessage");

    if (!form) {
        alert("Signup form not found. Please check ProfileDetails.html.");
        return;
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        function getValue(id) {
            const field = document.getElementById(id);
            return field ? field.value.trim() : "";
        }

        function showMessage(text) {
            if (message) {
                message.textContent = text;
                message.style.display = "block";
            } else {
                alert(text);
            }
        }

        const fullName = getValue("fullName");
        const email = getValue("email").toLowerCase();
        const college = getValue("college");
        const registration = getValue("registration");
        const course = getValue("course");
        const year = getValue("year");
        const graduation = getValue("graduation");

        const passwordField = document.getElementById("password");
        const confirmPasswordField =
            document.getElementById("confirmPassword");
        const terms = document.getElementById("terms");

        const password = passwordField ? passwordField.value : "";
        const confirmPassword = confirmPasswordField
            ? confirmPasswordField.value
            : "";

        if (
            !fullName ||
            !email ||
            !college ||
            !registration ||
            !course ||
            !year ||
            !graduation ||
            !password ||
            !confirmPassword
        ) {
            showMessage("Please fill in all required fields.");
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showMessage("Please enter a valid email address.");
            return;
        }

        if (password.length < 6) {
            showMessage("Password must be at least 6 characters long.");
            return;
        }

        if (password !== confirmPassword) {
            showMessage("Passwords do not match.");
            return;
        }

        if (terms && !terms.checked) {
            showMessage("Please accept the terms and conditions.");
            return;
        }

        const accountDetails = {
            fullName: fullName,
            email: email,
            college: college,
            registration: registration,
            course: course,
            year: year,
            graduation: graduation,
            password: password
        };

        try {
            sessionStorage.setItem(
                "skillmateSignupDraft",
                JSON.stringify(accountDetails)
            );

            sessionStorage.removeItem("skillmateSkillDraft");

            // Move from Create Account to the Skills page.
            window.location.href = "./Skills.html";

        } catch (error) {
            showMessage(
                "Unable to continue. Please check your browser settings and try again."
            );
        }
    });
});
