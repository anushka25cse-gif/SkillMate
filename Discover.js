document.addEventListener("DOMContentLoaded", function () {

    // ELEMENTS
    const $ = (id) => document.getElementById(id);

    const card = $("studentCard");
    const cardStage = $("cardStage");

    // STORAGE
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

    let savedPeople = readStorage("skillmateSavedPeople");
    let connections = readStorage("skillmateConnections");
    let passedPeople = readStorage("skillmatePassedPeople");

    // DEMO STUDENT PROFILES
    const students = [
        {
            id: "p1",
            name: "Riya Kapoor",
            initials: "RK",
            course: "CSE",
            year: "Year 2",
            college: "BML Munjal University",
            bio: "Building thoughtful digital experiences through design and code. I enjoy turning creative ideas into useful products.",
            skills: ["UI/UX Design", "Figma", "Web Development"],
            teaches: ["Figma", "UI/UX Design"],
            interests: ["Product Design", "Hackathons"],
            score: 94
        },
        {
            id: "p2",
            name: "Aarav Sharma",
            initials: "AS",
            course: "CSE",
            year: "Year 2",
            college: "BML Munjal University",
            bio: "AI enthusiast who enjoys experimenting with technology and building smart solutions to real-world problems.",
            skills: ["Python", "Machine Learning", "Data Analytics"],
            teaches: ["Python", "Machine Learning"],
            interests: ["Artificial Intelligence", "Research"],
            score: 91
        },
        {
            id: "p3",
            name: "Mehak Verma",
            initials: "MV",
            course: "Design",
            year: "Year 2",
            college: "BML Munjal University",
            bio: "Creative thinker passionate about branding, visual storytelling and making digital experiences more engaging.",
            skills: ["Graphic Design", "Figma", "Content Writing"],
            teaches: ["Graphic Design", "Figma"],
            interests: ["Art", "Branding"],
            score: 88
        },
        {
            id: "p4",
            name: "Kabir Malhotra",
            initials: "KM",
            course: "CSE",
            year: "Year 1",
            college: "BML Munjal University",
            bio: "Web developer learning to build useful digital tools. Always excited to work on new ideas with a team.",
            skills: ["JavaScript", "Web Development", "HTML & CSS"],
            teaches: ["Web Development", "JavaScript"],
            interests: ["Startups", "Web Apps"],
            score: 86
        },
        {
            id: "p5",
            name: "Sana Ali",
            initials: "SA",
            course: "CSE",
            year: "Year 2",
            college: "BML Munjal University",
            bio: "Interested in data, problem-solving and projects that create a positive impact on people's lives.",
            skills: ["Python", "SQL", "Data Analytics"],
            teaches: ["SQL", "Python"],
            interests: ["Analytics", "Social Impact"],
            score: 84
        },
        {
            id: "p6",
            name: "Dev Mehta",
            initials: "DM",
            course: "CSE",
            year: "Year 1",
            college: "BML Munjal University",
            bio: "Exploring software development, learning Java and looking forward to collaborating on exciting projects.",
            skills: ["Java", "C / C++", "Problem Solving"],
            teaches: ["Java", "C / C++"],
            interests: ["Coding", "Competitive Programming"],
            score: 81
        }
    ];

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
        // Uses the student's profile skills when available.
        let currentUser = {};

        try {
            currentUser =
                JSON.parse(sessionStorage.getItem("skillmateCurrentUser")) ||
                JSON.parse(localStorage.getItem("skillmateCurrentUser")) ||
                {};
        } catch {
            currentUser = {};
        }

        const mySkills = Array.isArray(currentUser.knownSkills)
            ? currentUser.knownSkills.map(skill => skill.toLowerCase())
            : [];

        const theirSkills = student.skills.map(skill => skill.toLowerCase());

        if (mySkills.length === 0) {
            return student.score;
        }

        const common = theirSkills.filter(skill => mySkills.includes(skill));

        const complementary = student.teaches.filter(skill =>
            mySkills.includes(skill.toLowerCase())
        );

        return Math.min(
            99,
            Math.max(65, 75 + common.length * 4 + complementary.length * 5)
        );
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
        const isSaved = savedPeople.includes(student.id);

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
        const isConnected = connections.includes(student.id);

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
    function connectProfile() {
        const student = currentProfiles[currentIndex];

        if (!student || swipeLocked) return;

        if (connections.includes(student.id)) {
            showToast("You have already sent a request to this student.");
            return;
        }

        swipeLocked = true;

        connections.push(student.id);
        saveStorage("skillmateConnections", connections);

        card.style.transform = "translateX(120%) rotate(12deg)";
        card.style.opacity = "0";

        showToast(`Connection request saved for ${student.name}!`);

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
    function toggleSave() {
        const student = currentProfiles[currentIndex];

        if (!student) return;

        if (savedPeople.includes(student.id)) {
            savedPeople = savedPeople.filter(id => id !== student.id);
            showToast("Student removed from your saved people.");
        } else {
            savedPeople.push(student.id);
            showToast("Student added to your saved people.");
        }

        saveStorage("skillmateSavedPeople", savedPeople);
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
    applyFilters();

});
