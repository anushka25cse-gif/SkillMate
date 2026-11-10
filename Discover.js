document.addEventListener("DOMContentLoaded", function () {

    // ELEMENTS
    const $ = (id) => document.getElementById(id);

    const card = $("studentCard");
    const cardStage = $("cardStage");

    // STORAGE (local UI state only: which cards have already been swiped)
    function readStorage(key) {
        try {
            const data = JSON.parse(localStorage.getItem(key));
            return Array.isArray(data) ? data : [];
        } catch {
            return [];
        }
    }

    function saveStorage(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    let passedPeople = readStorage("skillmatePassedPeople");

    // LIVE STUDENT PROFILES FROM THE SKILLMATE API

    const api = SkillMate.api;

    let students = [];

    /** API profile -> the card shape this page already renders. */
    function mapProfile(profile) {
        return {
            id: profile.id,
            name: profile.name,
            initials: SkillMate.initials(profile.name),
            course: profile.course || "",
            year: profile.year ? String(profile.year) : "",
            college: profile.college || "SkillMate",
            bio: profile.bio || "This student has not added a bio yet.",
            skills: Array.isArray(profile.skills) ? profile.skills : [],
            teaches: Array.isArray(profile.teachSkills) ? profile.teachSkills : [],
            interests: Array.isArray(profile.interests) ? profile.interests : [],
            score: typeof profile.matchScore === "number" ? profile.matchScore : 50,
            isSaved: Boolean(profile.saved),
            connected: ["pending_sent", "accepted"].includes(
                profile.relationship ? profile.relationship.status : ""
            )
        };
    }

    /** Load every discoverable student once. */
    async function loadStudents() {
        const payload = await api.listProfiles({
            limit: 100,
            sort: "match"
        });

        students = (payload.profiles || []).map(mapProfile);
    }

    let currentProfiles = [];
    let currentIndex = 0;
    let toastTimer;
    let swipeLocked = false;

    // HELPER FUNCTIONS
    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function showToast(message) {
        const toast = $("toast");

        toast.textContent = message;
        toast.classList.add("show");

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            toast.classList.remove("show");
        }, 2600);
    }

    function calculateMatch(student) {
        // The SkillMate API calculates compatibility for every pair of
        // students (Backend/utils/matching.js), so all pages agree.
        return typeof student.score === "number" ? student.score : 50;
    }

    // FILTER PROFILES
    function applyFilters() {
        const search = $("searchInput").value.trim().toLowerCase();
        const skill = $("skillFilter").value;

        currentProfiles = students.filter(student => {

            const alreadyPassed = passedPeople.includes(student.id);

            const matchesSearch =
                !search ||
                [
                    student.name,
                    student.course,
                    student.college,
                    student.bio,
                    ...student.skills,
                    ...student.teaches,
                    ...student.interests
                ].join(" ").toLowerCase().includes(search);

            const matchesSkill =
                skill === "all" ||
                student.skills.some(item =>
                    item.toLowerCase() === skill.toLowerCase()
                ) ||
                student.teaches.some(item =>
                    item.toLowerCase() === skill.toLowerCase()
                );

            return !alreadyPassed && matchesSearch && matchesSkill;
        });

        currentIndex = 0;
        renderProfile();
    }

    // RENDER SKILL TAGS
    function renderTags(elementId, items, className = "") {
        $(elementId).innerHTML = items.length
            ? items.map(item =>
                `<span class="skill-chip ${className}">
                    ${escapeHTML(item)}
                </span>`
            ).join("")
            : '<span class="skill-chip">Not provided</span>';
    }

    // UPDATE PROFILE CARD
    function renderProfile() {

        const total = currentProfiles.length;
        const remaining = total - currentIndex;

        $("remainingCount").textContent = remaining;

        $("profileCounter").textContent =
            total > 0
                ? `${String(currentIndex + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`
                : "00 / 00";

        const student = currentProfiles[currentIndex];

        if (!student) {
            card.classList.add("hidden");
            $("saveButton").classList.add("hidden");
            $("emptyCard").classList.remove("hidden");
            $("actionButtons").classList.add("hidden");
            $("swipeHint").classList.add("hidden");
            return;
        }

        card.classList.remove("hidden");
        $("saveButton").classList.remove("hidden");
        $("emptyCard").classList.add("hidden");
        $("actionButtons").classList.remove("hidden");
        $("swipeHint").classList.remove("hidden");

        // Student details
        $("studentAvatar").textContent = student.initials;
        $("studentName").textContent = student.name;
        $("studentCourse").textContent =
            `${student.course} · ${student.year}`;

        $("studentCollege").textContent = student.college;
        $("studentBio").textContent = student.bio;

        // Match percentage
        const score = calculateMatch(student);
        $("matchPercentage").textContent = `${score}%`;

        $("matchMessage").textContent =
            score >= 90
                ? "Excellent compatibility! Your skills could complement each other."
                : score >= 80
                    ? "A strong potential match for learning and collaboration."
                    : "An opportunity to discover different skills and fresh ideas.";

        // Skill groups
        renderTags("knownSkills", student.skills);
        renderTags("teachSkills", student.teaches, "teach");
        renderTags("interests", student.interests, "interest");

        // Save button state
        const isSaved = Boolean(student.isSaved);

        $("saveButton").classList.toggle("saved", isSaved);
        $("saveButton").textContent = isSaved ? "✓" : "♧";

        $("saveButton").title = isSaved
            ? "Remove from saved people"
            : "Save student";

        $("saveButton").setAttribute(
            "aria-label",
            isSaved ? "Remove saved student" : "Save student"
        );

        // Connect button state
        const isConnected = Boolean(student.connected);

        $("connectButton").disabled = isConnected;
        $("connectButton").innerHTML = isConnected
            ? '<span class="action-symbol">✓</span><span>Requested</span>'
            : '<span class="action-symbol">✓</span><span>Connect</span>';
    }

    // MOVE TO NEXT PROFILE
    function nextProfile() {
        currentIndex++;
        renderProfile();
    }

    // PASS PROFILE
    function passProfile() {
        const student = currentProfiles[currentIndex];

        if (!student || swipeLocked) return;

        swipeLocked = true;

        passedPeople.push(student.id);
        saveStorage("skillmatePassedPeople", passedPeople);

        card.style.transform = "translateX(-120%) rotate(-12deg)";
        card.style.opacity = "0";

        setTimeout(() => {
            card.style.transition = "none";
            card.style.transform = "";
            card.style.opacity = "";

            nextProfile();

            requestAnimationFrame(() => {
                card.style.transition = "";
                swipeLocked = false;
            });

        }, 260);
    }

    // CONNECT WITH STUDENT
    async function connectProfile() {
        const student = currentProfiles[currentIndex];

        if (!student || swipeLocked) return;

        if (student.connected) {
            showToast("You have already sent a request to this student.");
            return;
        }

        swipeLocked = true;

        try {
            await api.sendConnectionRequest(student.id);

            student.connected = true;
        } catch (error) {
            swipeLocked = false;
            showToast(
                error.message || "The connection request could not be sent."
            );
            return;
        }

        card.style.transform = "translateX(120%) rotate(12deg)";
        card.style.opacity = "0";

        showToast(`Connection request sent to ${student.name}!`);

        setTimeout(() => {
            card.style.transition = "none";
            card.style.transform = "";
            card.style.opacity = "";

            nextProfile();

            requestAnimationFrame(() => {
                card.style.transition = "";
                swipeLocked = false;
            });

        }, 260);
    }

    // SAVE OR UNSAVE STUDENT
    async function toggleSave() {
        const student = currentProfiles[currentIndex];

        if (!student) return;

        try {
            if (student.isSaved) {
                const saved = await api.listSavedPeople();
                const record = (saved.saved || []).find(
                    item => item.savedStudentId === student.id
                );

                if (record) {
                    await api.removeSavedPerson(record.id);
                }

                student.isSaved = false;
                showToast("Student removed from your saved people.");
            } else {
                await api.savePerson(student.id);

                student.isSaved = true;
                showToast("Student added to your saved people.");
            }
        } catch (error) {
            showToast(error.message || "Your saved people could not be updated.");
            return;
        }

        renderProfile();
    }

    // BUTTON EVENTS
    $("passButton").addEventListener("click", passProfile);

    $("connectButton").addEventListener("click", connectProfile);

    $("saveButton").addEventListener("click", toggleSave);


    // SWIPE GESTURES
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let isDragging = false;

    const swipeThreshold = 100;

    card.addEventListener("pointerdown", function (event) {

        if (
            event.target.closest("button") ||
            !currentProfiles[currentIndex] ||
            swipeLocked
        ) {
            return;
        }

        startX = event.clientX;
        startY = event.clientY;
        currentX = 0;

        isDragging = true;

        card.classList.add("dragging");
        card.setPointerCapture(event.pointerId);
    });

    card.addEventListener("pointermove", function (event) {

        if (!isDragging) return;

        currentX = event.clientX - startX;

        const currentY = event.clientY - startY;

        // Ignore mostly vertical movement.
        if (Math.abs(currentY) > Math.abs(currentX) * 1.5) {
            return;
        }

        card.style.transform =
            `translateX(${currentX}px) rotate(${currentX / 20}deg)`;

        const opacity = Math.max(
            0.65,
            1 - Math.abs(currentX) / 500
        );

        card.style.opacity = opacity;
    });

    function finishSwipe() {

        if (!isDragging) return;

        isDragging = false;
        card.classList.remove("dragging");

        if (currentX > swipeThreshold) {
            card.style.transform = "";
            card.style.opacity = "";
            connectProfile();
        } else if (currentX < -swipeThreshold) {
            card.style.transform = "";
            card.style.opacity = "";
            passProfile();
        } else {
            card.style.transform = "";
            card.style.opacity = "";
        }

        currentX = 0;
    }

    card.addEventListener("pointerup", finishSwipe);
    card.addEventListener("pointercancel", finishSwipe);


    // SEARCH AND FILTER EVENTS
    $("searchInput").addEventListener("input", applyFilters);

    $("skillFilter").addEventListener("change", applyFilters);

    $("resetFilters").addEventListener("click", function () {

        $("searchInput").value = "";
        $("skillFilter").value = "all";

        applyFilters();

        showToast("Filters have been reset.");
    });


    // RESTART DISCOVERY
    $("restartButton").addEventListener("click", function () {

        passedPeople = [];

        saveStorage("skillmatePassedPeople", passedPeople);

        applyFilters();

        showToast("You can explore the profiles again!");
    });


    // INITIALISE PAGE
    async function initialisePage() {
        if (!SkillMate.requireAuth()) return;

        try {
            await loadStudents();
        } catch (error) {
            console.error("Student profiles could not be loaded:", error);

            if (error.status === 401) {
                SkillMate.clearSession();
                window.location.href = "./StudentLogin.html";
                return;
            }

            showToast(error.message || "Student profiles could not be loaded.");
            return;
        }

        applyFilters();
    }

    initialisePage();

});
