document.addEventListener("DOMContentLoaded", async function () {

    // -----------------------------------------
    // ELEMENTS
    // -----------------------------------------

    const $ = id => document.getElementById(id);

    const API_USERS = "http://127.0.0.1:5000/api/users";
    const API_CONNECTIONS = "http://127.0.0.1:5000/api/connections";

    const card = $("studentCard");
    const cardStage = $("cardStage");

    // -----------------------------------------
    // STORAGE
    // -----------------------------------------

    function readStorage(key) {
        try {
            const data = JSON.parse(localStorage.getItem(key));
            return Array.isArray(data) ? data : [];
        } catch {
            return [];
        }
    }

    function saveStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error("Storage error:", error);
            return false;
        }
    }

    let savedPeople = readStorage("skillmateSavedPeople");
    let passedPeople = readStorage("skillmatePassedPeople");

    // -----------------------------------------
    // VARIABLES
    // -----------------------------------------

    let currentUser = null;
    let students = [];
    let filteredStudents = [];

    let sentRequests = [];
    let acceptedConnections = [];

    let currentIndex = 0;
    let activeSkill = "";
    let searchTerm = "";
    let swipeLocked = false;
    let toastTimer;

    // -----------------------------------------
    // HELPER FUNCTIONS
    // -----------------------------------------

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function getInitials(name) {
        return (name || "Student")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part[0].toUpperCase())
            .join("");
    }

    function showToast(message) {
        const toast = $("toast");

        if (!toast) return;

        toast.textContent = message;
        toast.classList.add("show");

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
    }

    // -----------------------------------------
    // LOAD LOGGED-IN USER FROM MONGODB
    // -----------------------------------------

    async function loadCurrentUser() {

        const response = await fetch(`${API_USERS}/me`, {
            method: "GET",
            credentials: "include"
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error("Please login first.");
        }

        currentUser = result.user;

        sessionStorage.setItem(
            "skillmateCurrentUser",
            JSON.stringify(currentUser)
        );
    }

    // -----------------------------------------
    // LOAD STUDENTS FROM MONGODB
    // -----------------------------------------

    async function loadStudents() {

        const response = await fetch(API_USERS, {
            method: "GET",
            credentials: "include"
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Unable to load students."
            );
        }

        const users = Array.isArray(result.users)
            ? result.users
            : [];

        students = users
            .filter(student =>
                student._id !== currentUser._id
            )
            .map(student => {

                const knownSkills = Array.isArray(student.knownSkills)
                    ? student.knownSkills
                    : [];

                const teachSkills = Array.isArray(student.teachSkills)
                    ? student.teachSkills
                    : [];

                const interests = Array.isArray(student.interests)
                    ? student.interests
                    : [];

                return {
                    id: student._id,
                    name: student.fullName || "Student",
                    initials: getInitials(student.fullName),
                    course: [
                        student.course,
                        student.year
                    ].filter(Boolean).join(" · ") || "Student",
                    college: student.college || "College not provided",
                    bio: student.bio || "No bio added yet.",
                    skills: knownSkills,
                    teaches: teachSkills,
                    interests: interests,
                    profilePhoto: student.profilePhoto || ""
                };
            });
    }

    // -----------------------------------------
    // LOAD CONNECTIONS FROM MONGODB
    // -----------------------------------------

    async function loadConnections() {

        const [sentResponse, acceptedResponse] = await Promise.all([

            fetch(`${API_CONNECTIONS}/requests/sent`, {
                credentials: "include"
            }),

            fetch(API_CONNECTIONS, {
                credentials: "include"
            })

        ]);

        const sentResult = await sentResponse.json();
        const acceptedResult = await acceptedResponse.json();

        if (!sentResponse.ok || !sentResult.success) {
            throw new Error("Unable to load sent requests.");
        }

        if (!acceptedResponse.ok || !acceptedResult.success) {
            throw new Error("Unable to load connections.");
        }

        sentRequests = (sentResult.requests || []).map(request => {
            return request.receiver?._id || request.receiver;
        });

        acceptedConnections = [];

        (acceptedResult.connections || []).forEach(connection => {

            const sender = connection.sender;
            const receiver = connection.receiver;

            const senderId = sender?._id || sender;
            const receiverId = receiver?._id || receiver;

            if (senderId === currentUser._id) {
                acceptedConnections.push(receiverId);
            } else if (receiverId === currentUser._id) {
                acceptedConnections.push(senderId);
            }
        });
    }

    // -----------------------------------------
    // MATCH SCORE
    // -----------------------------------------

    function calculateMatch(student) {

        const mySkills = (currentUser.knownSkills || [])
            .map(skill => skill.toLowerCase());

        const theirSkills = student.skills
            .map(skill => skill.toLowerCase());

        const theirTeachingSkills = student.teaches
            .map(skill => skill.toLowerCase());

        const sharedSkills = theirSkills.filter(skill =>
            mySkills.includes(skill)
        ).length;

        const complementarySkills = theirTeachingSkills.filter(skill =>
            mySkills.includes(skill)
        ).length;

        if (mySkills.length === 0) {
            return 70;
        }

        const score = 70 +
            sharedSkills * 5 +
            complementarySkills * 4;

        return Math.min(99, score);
    }

    // -----------------------------------------
    // FILTER STUDENTS
    // -----------------------------------------

    function applyFilters() {

        filteredStudents = students.filter(student => {

            if (passedPeople.includes(student.id)) {
                return false;
            }

            const matchesSearch =
                !searchTerm ||
                student.name.toLowerCase().includes(searchTerm) ||
                student.course.toLowerCase().includes(searchTerm) ||
                student.college.toLowerCase().includes(searchTerm) ||
                student.skills.some(skill =>
                    skill.toLowerCase().includes(searchTerm)
                );

            const matchesSkill =
                !activeSkill ||
                student.skills.some(skill =>
                    skill.toLowerCase() === activeSkill.toLowerCase()
                );

            return matchesSearch && matchesSkill;
        });

        currentIndex = 0;

        renderProfile();
        updateRemainingCount();
    }

    // -----------------------------------------
    // UPDATE PROFILE COUNTER
    // -----------------------------------------

    function updateRemainingCount() {

        const counter = $("remainingCount");

        if (counter) {
            counter.textContent = filteredStudents.length;
        }

        const profileCounter = $("profileCounter");

        if (profileCounter) {
            profileCounter.textContent =
                filteredStudents.length > 0
                    ? `${currentIndex + 1} of ${filteredStudents.length}`
                    : "0 of 0";
        }
    }

    // -----------------------------------------
    // RENDER PROFILE
    // -----------------------------------------

    function renderProfile() {

        if (!card) return;

        if (currentIndex >= filteredStudents.length) {

            card.classList.add("hidden");
            $("emptyCard")?.classList.remove("hidden");
            $("actionButtons")?.classList.add("hidden");

            updateRemainingCount();
            return;
        }

        const student = filteredStudents[currentIndex];

        card.classList.remove("hidden");
        $("emptyCard")?.classList.add("hidden");
        $("actionButtons")?.classList.remove("hidden");

        card.style.transform = "";
        card.style.opacity = "1";

        // Name and basic details

        if ($("studentName")) {
            $("studentName").textContent = student.name;
        }

        if ($("studentCourse")) {
            $("studentCourse").textContent = student.course;
        }

        if ($("studentCollege")) {
            $("studentCollege").textContent = student.college;
        }

        if ($("studentBio")) {
            $("studentBio").textContent = student.bio;
        }

        // Avatar

        const avatar = $("studentAvatar");

        if (avatar) {

            avatar.textContent = student.profilePhoto
                ? ""
                : student.initials;

            avatar.style.backgroundImage = student.profilePhoto
                ? `url("${student.profilePhoto}")`
                : "";

            avatar.style.backgroundSize = "cover";
            avatar.style.backgroundPosition = "center";
        }

        // Match percentage

        const score = calculateMatch(student);

        if ($("matchPercentage")) {
            $("matchPercentage").textContent = `${score}%`;
        }

        if ($("matchMessage")) {
            $("matchMessage").textContent =
                score >= 85
                    ? "Great compatibility!"
                    : score >= 75
                        ? "You could work well together."
                        : "Explore this connection.";
        }

        // Skills and interests

        renderTags("knownSkills", student.skills);
        renderTags("teachSkills", student.teaches);
        renderTags("interests", student.interests);

        // Save button

        const saveButton = $("saveButton");

        if (saveButton) {

            const saved = savedPeople.includes(student.id);

            saveButton.classList.toggle("saved", saved);

            saveButton.textContent = saved ? "♥" : "♡";

            saveButton.title = saved
                ? "Remove from saved people"
                : "Save student";
        }

        // Connection button

        const connectButton = $("connectButton");

        if (connectButton) {

            const requested = sentRequests.includes(student.id);
            const connected = acceptedConnections.includes(student.id);

            connectButton.disabled = requested || connected;

            if (connected) {
                connectButton.textContent = "Connected ✓";
            } else if (requested) {
                connectButton.textContent = "Requested ✓";
            } else {
                connectButton.textContent = "Connect";
            }
        }

        updateRemainingCount();
    }

    // -----------------------------------------
    // RENDER TAGS
    // -----------------------------------------

    function renderTags(elementId, items) {

        const container = $(elementId);

        if (!container) return;

        container.innerHTML = items.length
            ? items.map(item =>
                `<span class="skill-chip">${escapeHTML(item)}</span>`
            ).join("")
            : '<span class="empty-note">Not provided</span>';
    }

    // -----------------------------------------
    // SAVE STUDENT
    // -----------------------------------------

    function toggleSave() {

        const student = filteredStudents[currentIndex];

        if (!student) return;

        if (savedPeople.includes(student.id)) {

            savedPeople = savedPeople.filter(id =>
                id !== student.id
            );

            showToast("Student removed from saved people.");

        } else {

            savedPeople.push(student.id);

            showToast("Student saved successfully.");
        }

        if (!saveStorage("skillmateSavedPeople", savedPeople)) {
            showToast("Unable to save student.");
            return;
        }

        renderProfile();
    }

    // -----------------------------------------
    // SEND CONNECTION REQUEST
    // -----------------------------------------

    async function connectStudent() {

        const student = filteredStudents[currentIndex];

        if (!student || swipeLocked) return;

        if (
            sentRequests.includes(student.id) ||
            acceptedConnections.includes(student.id)
        ) {
            return;
        }

        const button = $("connectButton");

        if (button) {
            button.disabled = true;
            button.textContent = "Sending...";
        }

        try {

            const response = await fetch(
                `${API_CONNECTIONS}/request/${student.id}`,
                {
                    method: "POST",
                    credentials: "include"
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Unable to send request."
                );
            }

            sentRequests.push(student.id);

            showToast(`Connection request sent to ${student.name}.`);

            nextProfile();

        } catch (error) {

            console.error("Connection request error:", error);

            showToast(error.message);

            if (button) {
                button.disabled = false;
                button.textContent = "Connect";
            }
        }
    }

    // -----------------------------------------
    // PASS STUDENT
    // -----------------------------------------

    function passStudent() {

        const student = filteredStudents[currentIndex];

        if (!student || swipeLocked) return;

        passedPeople.push(student.id);

        saveStorage("skillmatePassedPeople", passedPeople);

        showToast("Student skipped.");

        nextProfile();
    }

    // -----------------------------------------
    // NEXT PROFILE
    // -----------------------------------------

    function nextProfile() {

        if (swipeLocked) return;

        swipeLocked = true;

        if (card) {
            card.style.transition = "0.3s ease";
            card.style.transform = "translateX(120%) rotate(15deg)";
            card.style.opacity = "0";
        }

        setTimeout(() => {

            currentIndex++;

            swipeLocked = false;

            renderProfile();

        }, 300);
    }

    // -----------------------------------------
    // RESTART DISCOVERY
    // -----------------------------------------

    function restartDiscovery() {

        passedPeople = [];

        saveStorage("skillmatePassedPeople", passedPeople);

        applyFilters();

        showToast("Discovery restarted.");
    }

    // -----------------------------------------
    // RESET FILTERS
    // -----------------------------------------

    function resetFilters() {

        searchTerm = "";
        activeSkill = "";

        if ($("searchInput")) {
            $("searchInput").value = "";
        }

        if ($("skillFilter")) {
            $("skillFilter").value = "";
        }

        applyFilters();
    }

    // -----------------------------------------
    // SEARCH
    // -----------------------------------------

    $("searchInput")?.addEventListener("input", event => {

        searchTerm = event.target.value.trim().toLowerCase();

        applyFilters();
    });

    // -----------------------------------------
    // SKILL FILTER
    // -----------------------------------------

    $("skillFilter")?.addEventListener("change", event => {

        activeSkill = event.target.value;

        applyFilters();
    });

    // -----------------------------------------
    // RESET FILTER BUTTON
    // -----------------------------------------

    $("resetFilters")?.addEventListener("click", resetFilters);

    // -----------------------------------------
    // BUTTON EVENTS
    // -----------------------------------------

    $("saveButton")?.addEventListener("click", toggleSave);

    $("connectButton")?.addEventListener("click", connectStudent);

    $("passButton")?.addEventListener("click", passStudent);

    $("restartButton")?.addEventListener("click", restartDiscovery);

    // -----------------------------------------
    // SWIPE GESTURES
    // -----------------------------------------

    let touchStartX = 0;
    let touchEndX = 0;

    cardStage?.addEventListener("touchstart", event => {

        touchStartX = event.changedTouches[0].screenX;

    }, { passive: true });

    cardStage?.addEventListener("touchend", event => {

        touchEndX = event.changedTouches[0].screenX;

        const difference = touchEndX - touchStartX;

        if (Math.abs(difference) < 80) return;

        if (difference > 0) {
            connectStudent();
        } else {
            passStudent();
        }

    }, { passive: true });

    // -----------------------------------------
    // MOUSE SWIPE
    // -----------------------------------------

    let mouseStartX = 0;
    let mouseDown = false;

    cardStage?.addEventListener("mousedown", event => {

        mouseDown = true;
        mouseStartX = event.clientX;

    });

    cardStage?.addEventListener("mouseup", event => {

        if (!mouseDown) return;

        mouseDown = false;

        const difference = event.clientX - mouseStartX;

        if (Math.abs(difference) < 100) return;

        if (difference > 0) {
            connectStudent();
        } else {
            passStudent();
        }

    });

    // -----------------------------------------
    // INITIALIZE DISCOVER
    // -----------------------------------------

    try {

        await loadCurrentUser();

        await loadStudents();

        await loadConnections();

        // Search value from Dashboard URL

        const params = new URLSearchParams(window.location.search);

        const search = params.get("search");

        if (search && $("searchInput")) {
            $("searchInput").value = search;
            searchTerm = search.toLowerCase();
        }

        applyFilters();

    } catch (error) {

        console.error("Discover initialization error:", error);

        showToast(error.message || "Unable to load Discover.");

        if (error.message.includes("login")) {
            window.location.href = "./StudentLogin.html";
        }
    }

});