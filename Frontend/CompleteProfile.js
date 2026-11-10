document.addEventListener("DOMContentLoaded", async function () {

    const API_URL = "http://127.0.0.1:5000/api/users";
    const DASHBOARD_URL = new URL("./Dashboard.html", window.location.href).href;

    const params = new URLSearchParams(window.location.search);
    const isEditMode = params.get("mode") === "edit";

    const form = document.getElementById("completeProfileForm");
    const message = document.getElementById("pageMessage");

    const profilePhotoInput = document.getElementById("profilePhoto");
    const avatarPreview = document.getElementById("avatarPreview");

    // -----------------------------------------
    // SESSION STORAGE
    // -----------------------------------------

    function readSession(key) {
        try {
            return JSON.parse(sessionStorage.getItem(key));
        } catch (error) {
            console.error("Session storage error:", error);
            return null;
        }
    }

    let signupDraft = readSession("skillmateSignupDraft");
    let skillDraft = readSession("skillmateSkillDraft");

    // -----------------------------------------
    // MESSAGE
    // -----------------------------------------

    function showMessage(text, type = "") {

        if (!message) return;

        message.textContent = text;
        message.className = "message";

        if (type) {
            message.classList.add(type);
        }
    }

    // -----------------------------------------
    // CHECK HTML ELEMENTS
    // -----------------------------------------

    if (!form || !message || !profilePhotoInput || !avatarPreview) {
        console.error("Required Complete Profile elements are missing.");
        return;
    }

    // -----------------------------------------
    // RECOVER DATA IN EDIT MODE
    // -----------------------------------------

    if (isEditMode && (!signupDraft || !skillDraft)) {

        try {

            showMessage("Loading your existing profile...");

            const response = await fetch(`${API_URL}/me`, {
                method: "GET",
                credentials: "include"
            });

            const result = await response.json();

            if (!response.ok || !result.success || !result.user) {
                throw new Error(
                    result.message || "Could not load your profile."
                );
            }

            const user = result.user;

            signupDraft = {
                fullName: user.fullName || "",
                email: user.email || "",
                college: user.college || "",
                registration: user.registration || "",
                course: user.course || "",
                year: user.year || "",
                graduation: user.graduation || ""
            };

            skillDraft = {
                knownSkills: user.knownSkills || [],
                teachSkills: user.teachSkills || [],
                bio: user.bio || "",
                interests: user.interests || [],
                profilePhoto: user.profilePhoto || "",
                proficiency: user.proficiency || "",
                availability: user.availability || "",
                collaboration: user.collaboration || ""
            };

            sessionStorage.setItem(
                "skillmateSignupDraft",
                JSON.stringify(signupDraft)
            );

            sessionStorage.setItem(
                "skillmateSkillDraft",
                JSON.stringify(skillDraft)
            );

        } catch (error) {

            console.error("Profile recovery error:", error);

            showMessage(error.message, "error");
            return;
        }
    }

    // -----------------------------------------
    // CHECK REQUIRED DATA
    // -----------------------------------------

    if (!signupDraft || !skillDraft) {

        showMessage(
            "Please complete your account details and skills first.",
            "error"
        );

        setTimeout(() => {
            window.location.replace("./ProfileDetails.html");
        }, 2000);

        return;
    }

    const knownSkills = Array.isArray(skillDraft.knownSkills)
        ? skillDraft.knownSkills
        : [];

    const teachSkills = Array.isArray(skillDraft.teachSkills)
        ? skillDraft.teachSkills
        : [];

    // -----------------------------------------
    // DISPLAY ACCOUNT DETAILS
    // -----------------------------------------

    function displayAccountDetails() {

        const name = signupDraft.fullName || "";

        document.getElementById("displayName").textContent = name;

        document.getElementById("displayEmail").textContent =
            signupDraft.email || "";

        document.getElementById("fullName").textContent = name;

        document.getElementById("email").textContent =
            signupDraft.email || "";

        document.getElementById("college").textContent =
            signupDraft.college || "—";

        document.getElementById("registration").textContent =
            signupDraft.registration || "—";

        document.getElementById("course").textContent =
            signupDraft.course || "—";

        document.getElementById("year").textContent =
            signupDraft.year || "—";

        document.getElementById("graduation").textContent =
            signupDraft.graduation || "—";

        const initials = name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part.charAt(0).toUpperCase())
            .join("");

        avatarPreview.textContent = initials || "SM";
    }

    // -----------------------------------------
    // DISPLAY SKILLS
    // -----------------------------------------

    function displaySkills(containerId, skills, countId) {

        const container = document.getElementById(containerId);
        const count = document.getElementById(countId);

        if (!container || !count) return;

        container.innerHTML = "";

        if (skills.length === 0) {

            container.textContent = "No skills selected";

        } else {

            skills.forEach(skill => {

                const tag = document.createElement("span");

                tag.className = "skill-chip";
                tag.textContent = skill;

                container.appendChild(tag);
            });
        }

        count.textContent = `${skills.length} skills selected`;
    }

    displayAccountDetails();

    displaySkills("knownSkills", knownSkills, "knownCount");
    displaySkills("teachSkills", teachSkills, "teachCount");

    // -----------------------------------------
    // PROFILE PHOTO
    // -----------------------------------------

    let profilePhoto = skillDraft.profilePhoto || "";

    if (profilePhoto) {

        avatarPreview.textContent = "";

        avatarPreview.style.backgroundImage =
            `url("${profilePhoto}")`;

        avatarPreview.style.backgroundSize = "cover";
        avatarPreview.style.backgroundPosition = "center";
    }

    // -----------------------------------------
    // PREFILL EDIT MODE
    // -----------------------------------------

    if (isEditMode) {

        const submitButton = form.querySelector(".submit-button");

        if (submitButton) {
            submitButton.innerHTML =
                'Update My Profile <span>→</span>';
        }

        document.getElementById("bio").value =
            skillDraft.bio || "";

        document.getElementById("interests").value =
            Array.isArray(skillDraft.interests)
                ? skillDraft.interests.join(", ")
                : "";

        document.getElementById("proficiency").value =
            skillDraft.proficiency || "";

        document.getElementById("availability").value =
            skillDraft.availability || "";

        document.getElementById("collaboration").value =
            skillDraft.collaboration || "";
    }

    // -----------------------------------------
    // PROFILE PHOTO HANDLING
    // -----------------------------------------

    profilePhotoInput.addEventListener("change", function () {

        const file = this.files[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {

            showMessage("Please select a valid image.", "error");

            this.value = "";
            return;
        }

        if (file.size > 2 * 1024 * 1024) {

            showMessage(
                "Please select an image smaller than 2 MB.",
                "error"
            );

            this.value = "";
            return;
        }

        const reader = new FileReader();

        reader.onload = function (event) {

            profilePhoto = event.target.result;

            avatarPreview.textContent = "";

            avatarPreview.style.backgroundImage =
                `url("${profilePhoto}")`;

            avatarPreview.style.backgroundSize = "cover";
            avatarPreview.style.backgroundPosition = "center";

            showMessage("");
        };

        reader.readAsDataURL(file);
    });

    // -----------------------------------------
    // FORM SUBMISSION
    // -----------------------------------------

    form.addEventListener("submit", async function (event) {

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        console.log("SkillMate form submission started.");

        const submitButton = form.querySelector(".submit-button");

        const bio = document.getElementById("bio").value.trim();

        const interests = document.getElementById("interests")
            .value
            .split(",")
            .map(item => item.trim())
            .filter(Boolean);

        const proficiency =
            document.getElementById("proficiency").value;

        const availability =
            document.getElementById("availability").value;

        const collaboration =
            document.getElementById("collaboration").value;

        // VALIDATE SKILLS

        if (knownSkills.length < 2) {

            showMessage(
                "Please select at least 2 known skills.",
                "error"
            );

            return;
        }

        if (teachSkills.length < 1) {

            showMessage(
                "Please select at least 1 skill you can teach.",
                "error"
            );

            return;
        }

        // VALIDATE PREFERENCES

        if (!proficiency || !availability || !collaboration) {

            showMessage(
                "Please complete all collaboration preferences.",
                "error"
            );

            return;
        }

        // PREPARE PROFILE DATA

        const profileData = {

            fullName: signupDraft.fullName,
            email: signupDraft.email,

            college: signupDraft.college,
            registration: signupDraft.registration,
            course: signupDraft.course,
            year: signupDraft.year,
            graduation: signupDraft.graduation,

            knownSkills: knownSkills,
            teachSkills: teachSkills,

            bio: bio,
            interests: interests,

            profilePhoto: profilePhoto,

            proficiency: proficiency,
            availability: availability,
            collaboration: collaboration
        };

        if (!isEditMode) {
            profileData.password = signupDraft.password;
        }

        // SEND REQUEST

        try {

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "Please wait...";
            }

            showMessage(
                isEditMode
                    ? "Updating your profile..."
                    : "Creating your account..."
            );

            const response = await fetch(
                isEditMode
                    ? `${API_URL}/me`
                    : `${API_URL}/register`,
                {
                    method: isEditMode ? "PUT" : "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    credentials: "include",

                    body: JSON.stringify(profileData)
                }
            );

            const result = await response.json();

            console.log("Backend status:", response.status);
            console.log("Backend response:", result);

            if (!response.ok || !result.success) {

                throw new Error(
                    result.message || "Profile operation failed."
                );
            }

            // SAVE UPDATED USER

            sessionStorage.setItem(
                "skillmateCurrentUser",
                JSON.stringify(result.user)
            );

            // CLEAR TEMPORARY DRAFTS

            sessionStorage.removeItem("skillmateSignupDraft");
            sessionStorage.removeItem("skillmateSkillDraft");

            // SUCCESS

            console.log("Profile saved successfully.");

            showMessage(
                isEditMode
                    ? "Profile updated successfully! Opening Dashboard..."
                    : "Account created successfully! Opening Dashboard...",
                "success"
            );

            // DIRECT DASHBOARD NAVIGATION

            console.log("Navigating to:", DASHBOARD_URL);

            window.location.replace(DASHBOARD_URL);

        } catch (error) {

            console.error("Profile submission error:", error);

            showMessage(
                error.message || "Something went wrong.",
                "error"
            );

            if (submitButton) {

                submitButton.disabled = false;

                submitButton.innerHTML = isEditMode
                    ? 'Update My Profile <span>→</span>'
                    : 'Complete My Profile <span>→</span>';
            }
        }

    }, true);

});