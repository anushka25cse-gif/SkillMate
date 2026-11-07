
document.addEventListener("DOMContentLoaded", function () {

    const $ = selector => document.querySelector(selector);

    // Storage keys
    const LEARNING_KEY = "skillmateLearningSkills";
    const REQUESTS_KEY = "skillmateSkillSwapRequests";
    const USER_KEY = "skillmateCurrentUser";

    // Read and save browser storage
    function readJSON(key, fallback) {
        try {
            const data = JSON.parse(localStorage.getItem(key));
            return data ?? fallback;
        } catch (error) {
            return fallback;
        }
    }

    function readSession(key, fallback) {
        try {
            const data = JSON.parse(sessionStorage.getItem(key));
            return data ?? fallback;
        } catch (error) {
            return fallback;
        }
    }

    function saveJSON(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error("Could not save data:", error);
            return false;
        }
    }

    
// Get the logged-in student's information
const sessionUser = readSession("skillmateCurrentUser", null);
const localUser = readJSON("skillmateCurrentUser", null);

// Read registered student profiles
const registeredUsers = readJSON("skillmateUsers", []);

// Use the logged-in profile if available.
// If it is missing and there is only one registered student,
// use that student's profile for this frontend demonstration.
const signupDraft = readSession("skillmateSignupDraft", {});

const user =
    sessionUser ||
    localUser ||
    (registeredUsers.length === 1 ? registeredUsers[0] : {}) ||
    {};

const studentName =
    user.fullName || user.name || user.username || "Student";

const studentEmail = user.email || "";

// Skills saved in the student's profile
const knownSkills = Array.isArray(user.knownSkills)
    ? user.knownSkills
    : [];

const profileTeachSkills = Array.isArray(user.teachSkills)
    ? user.teachSkills
    : [];

// Use explicitly selected teaching skills.
// If none are available, use known skills as a fallback.
const skillsToShare = [
    ...new Set(
        (profileTeachSkills.length > 0
            ? profileTeachSkills
            : knownSkills
        )
            .map(skill => String(skill).trim())
            .filter(Boolean)
    )
];

    // Skills available for learning
    const skillGroups = [
        {
            category: "Technology & Development",
            skills: [
                "Python",
                "Java",
                "C / C++",
                "JavaScript",
                "HTML & CSS",
                "Web Development",
                "App Development"
            ]
        },
        {
            category: "Design & Creativity",
            skills: [
                "UI/UX Design",
                "Figma",
                "Graphic Design",
                "Video Editing",
                "Photography",
                "Illustration"
            ]
        },
        {
            category: "Data & Artificial Intelligence",
            skills: [
                "Machine Learning",
                "Data Analytics",
                "SQL",
                "Data Science",
                "Artificial Intelligence"
            ]
        },
        {
            category: "Business & Communication",
            skills: [
                "Content Writing",
                "Public Speaking",
                "Marketing",
                "Project Management",
                "Communication"
            ]
        }
    ];

    // Demo student profiles.
    // "teaches" means what the student can teach.
    // "wants" means what the student wants to learn.

    const students = [
        {
            id: "student1",
            name: "Riya Kapoor",
            initials: "RK",
            course: "CSE · Year 2",
            bio: "Enjoys creating user-friendly designs and digital experiences.",
            teaches: ["Figma", "UI/UX Design", "Graphic Design"],
            wants: ["Python", "Machine Learning", "SQL"],
            color: ""
        },
        {
            id: "student2",
            name: "Aarav Sharma",
            initials: "AS",
            course: "CSE · Year 2",
            bio: "Interested in artificial intelligence and real-world projects.",
            teaches: ["Python", "Machine Learning", "Data Analytics", "SQL"],
            wants: ["Figma", "UI/UX Design", "Graphic Design"],
            color: "avatar-two"
        },
        {
            id: "student3",
            name: "Mehak Verma",
            initials: "MV",
            course: "Design · Year 2",
            bio: "Loves visual storytelling and creative projects.",
            teaches: ["Graphic Design", "Figma", "Illustration"],
            wants: ["Python", "Web Development", "JavaScript"],
            color: "avatar-three"
        },
        {
            id: "student4",
            name: "Kabir Malhotra",
            initials: "KM",
            course: "CSE · Year 1",
            bio: "A web development enthusiast who enjoys learning by building.",
            teaches: ["JavaScript", "HTML & CSS", "Web Development", "Java"],
            wants: ["UI/UX Design", "Figma", "Graphic Design"],
            color: "avatar-four"
        },
        {
            id: "student5",
            name: "Sana Ali",
            initials: "SA",
            course: "CSE · Year 2",
            bio: "Enjoys working with data and finding useful insights.",
            teaches: ["Python", "SQL", "Data Analytics", "Data Science"],
            wants: ["Figma", "UI/UX Design", "Content Writing"],
            color: "avatar-five"
        },
        {
            id: "student6",
            name: "Dev Mehta",
            initials: "DM",
            course: "CSE · Year 1",
            bio: "Interested in programming and software development.",
            teaches: ["Java", "C / C++", "Python"],
            wants: ["Web Development", "Graphic Design", "Video Editing"],
            color: "avatar-six"
        }
    ];

    // Load saved learning goals and exchange requests
    const savedLearningSkills = readJSON(LEARNING_KEY, null);

const profileLearningSkills = Array.isArray(user.learningSkills)
    ? user.learningSkills
    : [];

let learningSkills =
    Array.isArray(savedLearningSkills) && savedLearningSkills.length > 0
        ? savedLearningSkills
        : profileLearningSkills;

    let requests = readJSON(REQUESTS_KEY, []);

    if (!Array.isArray(requests)) {
        requests = [];
    }

    let toastTimer;

    // Helper functions
    function normalizeSkill(skill) {
        return String(skill).trim().toLowerCase();
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    function getInitials(name) {
        return String(name)
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part[0].toUpperCase())
            .join("");
    }

    function showToast(message) {
        const toast = $("#toast");

        if (!toast) return;

        toast.textContent = message;
        toast.classList.add("show");

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            toast.classList.remove("show");
        }, 2800);
    }

    function hasSkill(list, skill) {
        return list.some(
            item => normalizeSkill(item) === normalizeSkill(skill)
        );
    }

    // Display the current student's name
    function renderUser() {
        const nameElement = $("#topUserName");
        const avatarElement = $("#topAvatar");

        if (nameElement) {
            nameElement.textContent = studentName.split(" ")[0];
        }

        if (avatarElement) {
            avatarElement.textContent = getInitials(studentName);
        }
    }

    // Display available learning skills
    function renderSkillChoices() {
        const container = $("#skillChoices");

        if (!container) return;

        let html = "";

        skillGroups.forEach(group => {
            html += `
                <div class="skill-category">
                    <h3>${escapeHTML(group.category)}</h3>

                    <div class="skill-options">
                        ${group.skills.map(skill => {
                            const selected = hasSkill(learningSkills, skill);

                            return `
                                <button
                                    type="button"
                                    class="skill-option ${selected ? "selected" : ""}"
                                    data-skill="${escapeHTML(skill)}"
                                    aria-pressed="${selected}">

                                    <span>${escapeHTML(skill)}</span>
                                    <span class="skill-check">
                                        ${selected ? "✓" : "+"}
                                    </span>
                                </button>
                            `;
                        }).join("")}
                    </div>
                </div>
            `;
        });

        const standardSkills = skillGroups.flatMap(group => group.skills);

        const customSkills = learningSkills.filter(skill =>
            !hasSkill(standardSkills, skill)
        );

        if (customSkills.length > 0) {
            html += `
                <div class="skill-category">
                    <h3>Your added skills</h3>

                    <div class="skill-options">
                        ${customSkills.map(skill => `
                            <button
                                type="button"
                                class="skill-option selected"
                                data-skill="${escapeHTML(skill)}"
                                aria-pressed="true">

                                <span>${escapeHTML(skill)}</span>
                                <span class="skill-check">✓</span>
                            </button>
                        `).join("")}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    // Display selected learning skills
    function renderSelectedSkills() {
        const container = $("#selectedSkillsList");

        if (!container) return;

        $("#selectedCount").textContent =
            `${learningSkills.length} selected`;

        $("#learningCount").textContent = learningSkills.length;

        if (learningSkills.length === 0) {
            container.innerHTML = `
                <span class="selection-placeholder">
                    Select skills below to add them here.
                </span>
            `;
            return;
        }

        container.innerHTML = learningSkills.map(skill => `
            <span class="selected-skill">
                ${escapeHTML(skill)}

                <button
                    type="button"
                    class="remove-skill"
                    data-remove-skill="${escapeHTML(skill)}"
                    aria-label="Remove ${escapeHTML(skill)}">
                    ×
                </button>
            </span>
        `).join("");
    }

    // Add or remove a learning skill
    function toggleSkill(skill) {
        if (hasSkill(learningSkills, skill)) {
            learningSkills = learningSkills.filter(
                item => normalizeSkill(item) !== normalizeSkill(skill)
            );
        } else {
            learningSkills.push(skill);
        }

        renderAll();
    }

    // Add a custom learning skill
    function addCustomSkill() {
        const input = $("#customSkillInput");
        const skill = input.value.trim();

        if (!skill) {
            showToast("Please enter a skill first.");
            return;
        }

        if (hasSkill(learningSkills, skill)) {
            showToast("This skill is already selected.");
            return;
        }

        learningSkills.push(skill);
        input.value = "";

        renderAll();
        showToast("Skill added to your learning goals.");
    }

    // Save learning goals
    function saveLearningSkills() {
        if (!saveJSON(LEARNING_KEY, learningSkills)) {
            showToast("Your learning goals could not be saved.");
            return;
        }

        try {
            if (sessionUser) {
                sessionStorage.setItem(
                    USER_KEY,
                    JSON.stringify({
                        ...sessionUser,
                        learningSkills: learningSkills
                    })
                );
            }

            if (localUser) {
                localStorage.setItem(
                    USER_KEY,
                    JSON.stringify({
                        ...localUser,
                        learningSkills: learningSkills
                    })
                );
            }
        } catch (error) {
            console.error("Profile update error:", error);
        }

        user.learningSkills = [...learningSkills];

        showToast("Your learning goals have been saved!");

        renderMatches();
        updateStatistics();
    }

    // Find mutual skill matches
    function getMutualMatch(student) {

        // Skills the student can teach you
        const theyCanTeachYou = student.teaches.filter(skill =>
            hasSkill(learningSkills, skill)
        );

        // Skills you can teach the student
        const youCanTeachThem = student.wants.filter(skill =>
            hasSkill(skillsToShare, skill)
        );

        return {
            theyCanTeachYou,
            youCanTeachThem
        };
    }

    // Check whether a request has already been sent
    function hasSentRequest(studentId) {
        return requests.some(request =>
            request.studentId === studentId &&
            request.status !== "declined"
        );
    }

    // Create a mutual match card
    function createMatchCard(student) {
        const match = getMutualMatch(student);

        const totalPossible =
            learningSkills.length + skillsToShare.length;

        const matchedCount =
            match.theyCanTeachYou.length +
            match.youCanTeachThem.length;

        const matchPercentage = totalPossible > 0
            ? Math.min(100, Math.round(
                (matchedCount / totalPossible) * 100
            ))
            : 0;

        const alreadyRequested = hasSentRequest(student.id);

        const buttonText = alreadyRequested
            ? "Exchange request sent ✓"
            : "Connect for skill exchange";

        return `
            <article class="mentor-card">

                <div class="mentor-top">
                    <div class="mentor-avatar ${escapeHTML(student.color)}">
                        ${escapeHTML(student.initials)}
                    </div>

                    <div class="mentor-info">
                        <h3>${escapeHTML(student.name)}</h3>
                        <p>${escapeHTML(student.course)}</p>
                    </div>

                    <span class="match-score">
                        ${matchPercentage}% Match
                    </span>
                </div>

                <p class="mentor-bio">
                    ${escapeHTML(student.bio)}
                </p>

                <div class="match-skills">

                    <div class="match-column">
                        <span class="match-column-title">They can teach</span>

                        <div class="match-skill-list">
                            ${match.theyCanTeachYou.map(skill => `
                                <span class="mentor-skill">
                                    ${escapeHTML(skill)}
                                </span>
                            `).join("")}
                        </div>
                    </div>

                    <span class="swap-arrow">⇄</span>

                    <div class="match-column">
                        <span class="match-column-title">They want to learn</span>

                        <div class="match-skill-list">
                            ${match.youCanTeachThem.map(skill => `
                                <span class="mentor-skill offered-skill">
                                    ${escapeHTML(skill)}
                                </span>
                            `).join("")}
                        </div>
                    </div>

                </div>

                <button
                    type="button"
                    class="request-button"
                    data-request-student="${escapeHTML(student.id)}"
                    ${alreadyRequested ? "disabled" : ""}>

                    ${buttonText}

                </button>

            </article>
        `;
    }

    // Display only students who have a two-way match
    function renderMatches() {
        const grid = $("#mentorGrid");
        const empty = $("#mentorEmpty");
        const searchInput = $("#mentorSearch");

        if (!grid || !empty) return;

        const searchTerm = searchInput
            ? searchInput.value.trim().toLowerCase()
            : "";

        const mutualMatches = students.filter(student => {
            const match = getMutualMatch(student);

            // Both sides must have at least one matching skill
            const isMutual =
                match.theyCanTeachYou.length > 0 &&
                match.youCanTeachThem.length > 0;

            const searchableText = [
                student.name,
                student.course,
                ...student.teaches,
                ...student.wants
            ].join(" ").toLowerCase();

            return isMutual && searchableText.includes(searchTerm);
        });

        grid.innerHTML = mutualMatches
            .map(createMatchCard)
            .join("");

        empty.classList.toggle("hidden", mutualMatches.length > 0);

        const summary = $("#matchSummary");

        if (summary) {
            if (learningSkills.length === 0 || skillsToShare.length === 0) {
                summary.textContent =
                    "Add skills you can teach and skills you want to learn to find mutual matches.";
            } else {
                summary.textContent =
                    `${mutualMatches.length} student(s) match your learning and teaching skills.`;
            }
        }

        updateStatistics();
    }

    // Send a two-way skill exchange request
    function sendExchangeRequest(studentId) {
        const student = students.find(item => item.id === studentId);

        if (!student) return;

        const match = getMutualMatch(student);

        if (
            match.theyCanTeachYou.length === 0 ||
            match.youCanTeachThem.length === 0
        ) {
            showToast("A mutual skill match is required.");
            return;
        }

        if (hasSentRequest(studentId)) {
            showToast("You have already sent a request to this student.");
            return;
        }

        const newRequest = {
            id: "swap-" + Date.now(),
            studentId: student.id,
            studentName: student.name,
            studentEmail: studentEmail,
            yourName: studentName,

            // What they will teach you
            skillsTheyTeach: match.theyCanTeachYou,

            // What you can teach them
            skillsYouTeach: match.youCanTeachThem,

            status: "pending",
            createdAt: new Date().toISOString()
        };

        requests.push(newRequest);

        if (!saveJSON(REQUESTS_KEY, requests)) {
            requests.pop();
            showToast("Your request could not be saved.");
            return;
        }

        showToast("Your skill exchange request has been saved!");

        renderMatches();
        renderMyRequests();
    }

    // Display sent skill exchange requests
    function renderMyRequests() {
        const container = $("#myRequestsList");
        const count = $("#requestCount");

        if (!container || !count) return;

        count.textContent =
            `${requests.length} ${requests.length === 1 ? "request" : "requests"}`;

        if (requests.length === 0) {
            container.innerHTML = `
                <div class="request-empty">
                    Your skill exchange requests will appear here.
                </div>
            `;
            return;
        }

        container.innerHTML = requests.slice().reverse().map(request => {
            const statusClass = request.status === "accepted"
                ? "accepted"
                : "";

            const statusText = request.status === "accepted"
                ? "Accepted"
                : request.status === "declined"
                    ? "Declined"
                    : "Pending";

            const theyTeach = Array.isArray(request.skillsTheyTeach)
                ? request.skillsTheyTeach.join(", ")
                : request.skill || "Skill";

            const youTeach = Array.isArray(request.skillsYouTeach)
                ? request.skillsYouTeach.join(", ")
                : "Not specified";

            return `
                <div class="request-row">

                    <div class="request-person">
                        <div class="mentor-avatar">
                            ${escapeHTML(getInitials(request.studentName || "Student"))}
                        </div>

                        <div>
                            <strong>${escapeHTML(request.studentName)}</strong>
                            <small>
                                They teach: ${escapeHTML(theyTeach)}
                                <br>
                                You teach: ${escapeHTML(youTeach)}
                            </small>
                        </div>
                    </div>

                    <span class="request-status ${statusClass}">
                        ${escapeHTML(statusText)}
                    </span>

                </div>
            `;
        }).join("");
    }

    // Display your teaching skills
    function renderMySkills() {
        const container = $("#mySkillsList");

        if (!container) return;

        $("#teachingCount").textContent = skillsToShare.length;

        if (skillsToShare.length === 0) {
            container.innerHTML = `
                <div class="no-skills">
                    You haven't added any teaching skills yet.
                    Update your profile to show other students
                    what you can share.
                </div>
            `;
            return;
        }

        container.innerHTML = skillsToShare.map(skill => `
            <div class="my-skill-item">
                <span class="my-skill-icon">✓</span>

                <div>
                    <strong>${escapeHTML(skill)}</strong>
                    <small>Available to share</small>
                </div>
            </div>
        `).join("");
    }

    // Update page statistics
    function updateStatistics() {
        $("#learningCount").textContent = learningSkills.length;
        $("#teachingCount").textContent = skillsToShare.length;

        const mutualCount = students.filter(student => {
            const match = getMutualMatch(student);

            return (
                match.theyCanTeachYou.length > 0 &&
                match.youCanTeachThem.length > 0
            );
        }).length;

        $("#matchCount").textContent = mutualCount;
    }

    // Refresh all page sections
    function renderAll() {
        renderSkillChoices();
        renderSelectedSkills();
        renderMySkills();
        renderMatches();
        renderMyRequests();
        updateStatistics();
    }

    // Skill selection
    $("#skillChoices").addEventListener("click", function (event) {
        const button = event.target.closest("[data-skill]");

        if (!button) return;

        toggleSkill(button.dataset.skill);
    });

    // Remove a selected skill
    $("#selectedSkillsList").addEventListener("click", function (event) {
        const button = event.target.closest("[data-remove-skill]");

        if (!button) return;

        toggleSkill(button.dataset.removeSkill);
    });

    // Add custom skill
    $("#addCustomSkill").addEventListener("click", addCustomSkill);

    $("#customSkillInput").addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            addCustomSkill();
        }
    });

    // Save learning goals
    $("#saveLearningSkills").addEventListener("click", saveLearningSkills);

    // Search for matching students
    $("#mentorSearch").addEventListener("input", renderMatches);

    // Send exchange request
    $("#mentorGrid").addEventListener("click", function (event) {
        const button = event.target.closest("[data-request-student]");

        if (!button || button.disabled) return;

        sendExchangeRequest(button.dataset.requestStudent);
    });

    // Mobile sidebar
    const mobileMenu = $("#mobileMenu");
    const sidebar = $("#sidebar");

    if (mobileMenu && sidebar) {
        mobileMenu.addEventListener("click", function () {
            sidebar.classList.toggle("open");
        });

        document.addEventListener("click", function (event) {
            if (
                window.innerWidth <= 850 &&
                sidebar.classList.contains("open") &&
                !sidebar.contains(event.target) &&
                !mobileMenu.contains(event.target)
            ) {
                sidebar.classList.remove("open");
            }
        });
    }

    // Logout
    const logoutButton = $("#logoutBtn");

    if (logoutButton) {
        logoutButton.addEventListener("click", function (event) {
            event.preventDefault();

            const confirmed = confirm("Are you sure you want to log out?");

            if (confirmed) {
                localStorage.removeItem(USER_KEY);
                sessionStorage.removeItem(USER_KEY);

                window.location.href = "./Login.html";
            }
        });
    }

    // Refresh the page if saved information changes in another tab
    window.addEventListener("storage", function (event) {
        if (
            event.key === LEARNING_KEY ||
            event.key === REQUESTS_KEY ||
            event.key === USER_KEY
        ) {
            learningSkills = readJSON(LEARNING_KEY, []);
            requests = readJSON(REQUESTS_KEY, []);

            renderAll();
        }
    });

    // Initial page setup
    renderUser();
    renderAll();

});
