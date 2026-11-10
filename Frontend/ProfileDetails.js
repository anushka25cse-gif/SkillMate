document.addEventListener("DOMContentLoaded", async function () {

    const form = document.getElementById("signupForm");
    const message = document.getElementById("formMessage");

    if (!form) {
        alert("Signup form not found. Please check ProfileDetails.html.");
        return;
    }

    const submitButton = form.querySelector(".create-button");

    const API_URL = "http://127.0.0.1:5000/api/users";

    // Check whether the page is in edit mode

    const params = new URLSearchParams(window.location.search);
    const isEditMode = params.get("mode") === "edit";

    // Get input values

    function getValue(id) {
        const field = document.getElementById(id);
        return field ? field.value.trim() : "";
    }

    // Display messages

    function showMessage(text, type = "error") {
        message.textContent = text;
        message.className = "form-message " + type;
        message.style.display = "block";
    }

    // Get password and terms elements

    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("confirmPassword");
    const terms = document.getElementById("terms");

    const passwordGroup = passwordInput.closest(".form-group");
    const confirmPasswordGroup = confirmPasswordInput.closest(".form-group");
    const termsRow = document.querySelector(".terms-row");

    // Edit mode configuration

    if (isEditMode) {

        // Hide registration-only fields

        passwordGroup.style.display = "none";
        confirmPasswordGroup.style.display = "none";
        termsRow.style.display = "none";

        // Disable required validation for hidden fields

        passwordInput.required = false;
        confirmPasswordInput.required = false;
        terms.required = false;

        document.querySelector(".intro h1").innerHTML =
            'Edit your <span>profile.</span>';

        document.querySelector(".intro p").textContent =
            "Update your student information.";

        document.querySelector(".card-heading h2").textContent =
            "Edit Student Details";

        document.querySelector(".card-heading p").textContent =
            "Update your information below.";

        submitButton.innerHTML =
            'Continue to Skills <span>→</span>';

        // Load existing student details from MongoDB

        try {

            showMessage("Loading your profile details...", "success");

            const response = await fetch(`${API_URL}/me`, {
                method: "GET",
                credentials: "include"
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Please login again."
                );
            }

            const user = result.user;

            // Fill existing information

            document.getElementById("fullName").value =
                user.fullName || "";

            document.getElementById("email").value =
                user.email || "";

            document.getElementById("college").value =
                user.college || "";

            document.getElementById("registration").value =
                user.registration || "";

            document.getElementById("course").value =
                user.course || "";

            document.getElementById("year").value =
                user.year || "";

            document.getElementById("graduation").value =
                user.graduation || "";

            // Email cannot be changed

            document.getElementById("email").readOnly = true;

            // Save existing account information temporarily

            const accountDetails = {
                fullName: user.fullName || "",
                email: user.email || "",
                college: user.college || "",
                registration: user.registration || "",
                course: user.course || "",
                year: user.year || "",
                graduation: user.graduation || ""
            };

            sessionStorage.setItem(
                "skillmateSignupDraft",
                JSON.stringify(accountDetails)
            );

            // Save existing skills and profile information

            sessionStorage.setItem(
                "skillmateSkillDraft",
                JSON.stringify({
                    knownSkills: user.knownSkills || [],
                    teachSkills: user.teachSkills || [],
                    bio: user.bio || "",
                    interests: user.interests || [],
                    profilePhoto: user.profilePhoto || "",
                    proficiency: user.proficiency || "",
                    availability: user.availability || "",
                    collaboration: user.collaboration || ""
                })
            );

            showMessage("", "");

        } catch (error) {

            console.error("Profile loading error:", error);

            showMessage(
                error.message || "Unable to load your profile.",
                "error"
            );

            submitButton.disabled = true;
            return;
        }
    }

    // Form submission

    form.addEventListener("submit", function (event) {

        event.preventDefault();

        const fullName = getValue("fullName");
        const email = getValue("email").toLowerCase();
        const college = getValue("college");
        const registration = getValue("registration");
        const course = getValue("course");
        const year = getValue("year");
        const graduation = getValue("graduation");

        // Validate required student details

        if (
            !fullName ||
            !email ||
            !college ||
            !registration ||
            !course ||
            !year ||
            !graduation
        ) {
            showMessage("Please fill in all required fields.");
            return;
        }

        // Validate email

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(email)) {
            showMessage("Please enter a valid email address.");
            return;
        }

        // Password validation only during registration

        let password = "";

        if (!isEditMode) {

            password = passwordInput.value;

            const confirmPassword = confirmPasswordInput.value;

            if (!password || !confirmPassword) {
                showMessage("Please enter and confirm your password.");
                return;
            }

            if (password.length < 8) {
                showMessage("Password must be at least 8 characters long.");
                return;
            }

            if (password !== confirmPassword) {
                showMessage("Passwords do not match.");
                return;
            }

            if (!terms.checked) {
                showMessage(
                    "Please accept the Terms of Service and Privacy Policy."
                );
                return;
            }
        }

        // Prepare account details

        const accountDetails = {
            fullName,
            email,
            college,
            registration,
            course,
            year,
            graduation
        };

        // Add password only during registration

        if (!isEditMode) {
            accountDetails.password = password;
        }

        try {

            sessionStorage.setItem(
                "skillmateSignupDraft",
                JSON.stringify(accountDetails)
            );

            // Remove old skill draft only during registration

            if (!isEditMode) {
                sessionStorage.removeItem("skillmateSkillDraft");
            }

            showMessage(
                "Details saved! Moving to the next step...",
                "success"
            );

            submitButton.disabled = true;
            submitButton.textContent = "Please wait...";

            // Move to Skills page

            setTimeout(function () {

                if (isEditMode) {
                    window.location.href = "./Skills.html?mode=edit";
                } else {
                    window.location.href = "./Skills.html";
                }

            }, 500);

        } catch (error) {

            showMessage(
                "Unable to continue. Please check your browser storage settings."
            );

            submitButton.disabled = false;
        }

    });

});
