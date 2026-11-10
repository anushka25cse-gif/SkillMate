
document.addEventListener("DOMContentLoaded", function () {

    const $ = selector => document.querySelector(selector);

    // Session and profile data come from api.js (SkillMate.getUser()).


// Get the logged-in student's information (api.js caches it after login)
const user = SkillMate.getUser() || {};

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

    // LIVE STUDENT MATCHES FROM THE SKILLMATE API.
    // "teaches" means what the student can teach.
    // "wants" means what the student wants to learn.

    const api = SkillMate.api;

    let students = [];
    let pendingMatches = null;   // matches loaded but not yet rendered

    const avatarColours = ["", "avatar-two", "avatar-three", "avatar-four", "avatar-five", "avatar-six"];

    /** API match -> the card shape this page already renders. */
    function mapMatch(match, index) {
        return {
            id: match.student.id,
            name: match.student.name,
            initials: match.student.initials || SkillMate.initials(match.student.name),
            course: SkillMate.courseLabel(match.student),
            bio: match.student.bio || "",
            teaches: Array.isArray(match.teaches) ? match.teaches : [],
            wants: Array.isArray(match.wants) ? match.wants : [],
            score: typeof match.score === "number" ? match.score : 50,
            match: {
                theyCanTeachYou: match.theyCanTeachYou || [],
                youCanTeachThem: match.youCanTeachThem || [],
                isMutual: Boolean(match.isMutual)
            },
            alreadyRequested: Boolean(match.alreadyRequested),
            color: avatarColours[index % avatarColours.length]
        };
    }

    /** Load mutual skill matches and my exchange requests from the server. */
    async function loadExchangeData() {
        const [matches, exchange] = await Promise.all([
            api.skillMatches(true),
            api.listSkillExchanges()
        ]);

        students = (matches.matches || []).map(mapMatch);
        requests = (exchange.sent || [])
            .concat(exchange.received || [])
            .map(mapRequest);
    }

    // Learning goals and exchange requests live on the server.
    let learningSkills = Array.isArray(user.learningSkills)
        ? user.learningSkills
        : [];

    let requests = [];

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

    /** API exchange request -> the row shape this page already renders. */
    function mapRequest(request) {
        const sentByMe = request.direction === "sent";
        const other = sentByMe ? request.matchedStudent : request.student;

        return {
            id: request.id,
            studentId: other ? other.id : "",
            studentName: other ? other.name : "Student",
            status: request.status,
            // Reframed from the viewer's point of view.
            skillsTheyTeach: sentByMe ? request.skillsToLearn : request.skillsToTeach,
            skillsYouTeach: sentByMe ? request.skillsToTeach : request.skillsToLearn,
            direction: request.direction,
            createdAt: request.createdAt || null
        };
    }

    // Save learning goals
    async function saveLearningSkills() {
        // Learning goals belong to the student's profile on the server.
        if (!user.id) {
            showToast("Please sign in again to save your learning goals.");
            return;
        }

        try {
            const result = await api.updateProfile(user.id, {
                learningSkills
            });

            user.learningSkills = [...learningSkills];

            if (result.user) {
                SkillMate.saveUser(result.user);
            }

            showToast("Your learning goals have been saved!");
        } catch (error) {
            showToast(error.message || "Your learning goals could not be saved.");
            return;
        }

        renderMatches();
        updateStatistics();
    }

    // Find mutual skill matches (the API already calculated the overlap)
    function getMutualMatch(student) {
        if (student && student.match) {
            return student.match;
        }

        // Fallback: compute locally from the two skill lists.
        const theyCanTeachYou = student.teaches.filter(skill =>
            hasSkill(learningSkills, skill)
        );

        const youCanTeachThem = student.wants.filter(skill =>
            hasSkill(skillsToShare, skill)
        );

        return { theyCanTeachYou, youCanTeachThem };
    }

    // Check whether a request has already been sent
    function hasSentRequest(studentId) {
        if (studentId) {
            const student = students.find(item => item.id === studentId);

            if (student && student.alreadyRequested) return true;
        }

        return requests.some(request =>
            request.studentId === studentId &&
            request.status !== "declined" &&
            request.status !== "cancelled"
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

        // The API already calculated the compatibility percentage; the local
        // calculation only remains for students loaded without one.
        const matchPercentage = typeof student.score === "number"
            ? student.score
            : (totalPossible > 0
                ? Math.min(100, Math.round(
                    (matchedCount / totalPossible) * 100
                ))
                : 0);

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
    async function sendExchangeRequest(studentId) {
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

        try {
            const result = await api.createSkillExchange({
                matchedStudentId: studentId,
                skillsToTeach: match.youCanTeachThem,
                skillsToLearn: match.theyCanTeachYou
            });

            requests.unshift(mapRequest(result.request));
            student.alreadyRequested = true;

            showToast("Your skill exchange request has been sent!");
        } catch (error) {
            showToast(error.message || "Your request could not be sent.");
            return;
        }

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
        logoutButton.addEventListener("click", async function (event) {
            event.preventDefault();

            const confirmed = confirm("Are you sure you want to log out?");

            if (confirmed) {
                await SkillMate.api.logout();

                window.location.href = "./Login.html";
            }
        });
    }

    // Initial page setup: session check, live data, then render.
    async function initialisePage() {
        if (!SkillMate.requireAuth()) return;

        renderUser();

        try {
            await loadExchangeData();
        } catch (error) {
            console.error("Skill exchange data could not be loaded:", error);

            if (error.status === 401) {
                SkillMate.clearSession();
                window.location.href = "./StudentLogin.html";
                return;
            }

            showToast(error.message || "Your skill matches could not be loaded.");
        }

        renderAll();
    }

    initialisePage();

});
