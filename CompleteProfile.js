
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("completeProfileForm");
    const message = document.getElementById("pageMessage");

    // SkillMate frontend API client (api.js) owns the server address.

    const readJSON = (key) => {
        try {
            return JSON.parse(sessionStorage.getItem(key) || "null");
        } catch {
            return null;
        }
    };

    const draft = readJSON("skillmateSignupDraft");
    const skillDraft = readJSON("skillmateSkillDraft");
    const existingUser = readJSON("skillmateCurrentUser");
    const sessionUser = SkillMate.getUser() || existingUser;

    const account = draft || existingUser;

    // The API needs the account id created at registration.
    const accountId = (sessionUser && sessionUser.id) || (account && account.id) || "";
    const knownSkills = skillDraft?.knownSkills ||
        existingUser?.knownSkills || [];
    const teachSkills = skillDraft?.teachSkills ||
        existingUser?.teachSkills || [];

    const setText = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value || "Not provided";
    };

    const showMessage = (text) => {
        message.textContent = text;
        message.classList.add("visible");
        message.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    if (!account) {
        showMessage(
            "Your account details could not be found. Please create your account first."
        );
        form.querySelector('button[type="submit"]').disabled = true;
        return;
    }

    const name = account.fullName || account.name || "";
    const email = account.email || "";

    setText("displayName", name);
    setText("displayEmail", email);
    setText("fullName", name);
    setText("email", email);
    setText("college", account.college);
    setText("registration", account.registration);
    setText("course", account.course);
    setText("year", account.year);
    setText("graduation", account.graduation);

    const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0].toUpperCase())
        .join("");

    const avatar = document.getElementById("avatarPreview");
    avatar.textContent = initials || "SM";

    const renderSkills = (containerId, skills) => {
        const container = document.getElementById(containerId);
        container.replaceChildren();

        [...new Set(Array.isArray(skills) ? skills : [])].forEach(skill => {
            const tag = document.createElement("span");
            tag.className = "skill-tag";
            tag.textContent = skill;
            container.appendChild(tag);
        });

        if (container.childElementCount === 0) {
            const empty = document.createElement("span");
            empty.className = "hint";
            empty.textContent = "No skills selected yet.";
            container.appendChild(empty);
        }
    };

    renderSkills("knownSkills", knownSkills);
    renderSkills("teachSkills", teachSkills);

    setText("knownCount", `${knownSkills.length} skills selected`);
    setText("teachCount", `${teachSkills.length} skills selected`);

    const photoInput = document.getElementById("profilePhoto");
    let photoData = existingUser?.profilePhoto || "";

    if (photoData) {
        avatar.style.backgroundImage = `url("${photoData}")`;
        avatar.textContent = "";
    }

    photoInput.addEventListener("change", () => {
        const file = photoInput.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            showMessage("Please select an image file.");
            photoInput.value = "";
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            showMessage("Please choose an image smaller than 2 MB.");
            photoInput.value = "";
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            photoData = reader.result;
            avatar.style.backgroundImage = `url("${photoData}")`;
            avatar.textContent = "";
            message.classList.remove("visible");
        };

        reader.onerror = () => {
            showMessage("The photo could not be loaded. Please try again.");
        };

        reader.readAsDataURL(file);
    });

    // Restore previously entered optional profile information.
    document.getElementById("bio").value = existingUser?.bio || "";
    document.getElementById("interests").value =
        Array.isArray(existingUser?.interests)
            ? existingUser.interests.join(", ")
            : (existingUser?.interests || "");

    document.getElementById("proficiency").value =
        existingUser?.proficiency || "";
    document.getElementById("availability").value =
        existingUser?.availability || "";
    document.getElementById("collaboration").value =
        existingUser?.collaboration || "";

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        message.classList.remove("visible");

        if (!account.email) {
            showMessage("Account email is missing. Please review your account details.");
            return;
        }

        if (knownSkills.length < 2 || teachSkills.length < 1) {
            showMessage(
                "Please return to the Skills page and select at least 2 skills you know and 1 skill you can teach."
            );
            return;
        }

        const proficiency = document.getElementById("proficiency").value;
        const availability = document.getElementById("availability").value;
        const collaboration = document.getElementById("collaboration").value;

        if (!proficiency || !availability || !collaboration) {
            showMessage("Please choose your proficiency, availability and collaboration style.");
            return;
        }

        const completedUser = {
            ...account,
            email: account.email.trim().toLowerCase(),
            knownSkills,
            teachSkills,
            profilePhoto: photoData,
            bio: document.getElementById("bio").value.trim(),
            interests: document.getElementById("interests").value
                .split(",")
                .map(item => item.trim())
                .filter(Boolean),
            proficiency,
            availability,
            collaboration,
            profileCompleted: true
        };

        // Save the finished profile in the SkillMate backend (User.json).
        if (!accountId) {
            showMessage(
                "Your session has expired. Please sign in again before completing your profile."
            );
            return;
        }

        let savedBackendUser = null;

        try {
            const result = await SkillMate.api.updateProfile(accountId, {
                skills: completedUser.knownSkills,
                teachSkills: completedUser.teachSkills,
                learningSkills: completedUser.interests,
                profileImage: completedUser.profilePhoto,
                bio: completedUser.bio,
                interests: completedUser.interests,
                proficiency: completedUser.proficiency,
                availability: completedUser.availability,
                collaboration: completedUser.collaboration,
                profileCompleted: true
            });

            savedBackendUser = result.user;
        } catch (backendError) {
            showMessage(
                backendError.message ||
                    "The server could not save your profile. Please try again."
            );
            return;
        }

        try {
            SkillMate.saveUser(savedBackendUser);

            sessionStorage.removeItem("skillmateSignupDraft");
            sessionStorage.removeItem("skillmateSkillDraft");

            window.location.href = "./Dashboard.html";
        } catch (error) {
            showMessage(
                "Unable to save your profile. Try a smaller photo or check your browser storage."
            );
        }
    });
});
