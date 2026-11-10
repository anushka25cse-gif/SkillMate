document.addEventListener("DOMContentLoaded", async function () {

    const $ = selector => document.querySelector(selector);

    const API = "http://127.0.0.1:5000/api";

    const USERS_API = `${API}/users`;
    const SKILL_API = `${API}/skill-exchange`;

    let currentUser = null;
    let allUsers = [];
    let profiles = [];
    let learningSkills = [];

    let sentRequests = [];
    let receivedRequests = [];

    let skillsToShare = [];
    let toastTimer;


    // -----------------------------------------
    // SKILL CATEGORIES
    // -----------------------------------------

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


    // -----------------------------------------
    // API HELPER
    // -----------------------------------------

    async function apiRequest(url, options = {}) {

        const response = await fetch(url, {
            ...options,

            credentials: "include",

            headers: {
                "Content-Type": "application/json",
                ...options.headers
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Something went wrong.");
        }

        return data;
    }


    // -----------------------------------------
    // HELPER FUNCTIONS
    // -----------------------------------------

    function normalizeSkill(skill) {
        return String(skill).trim().toLowerCase();
    }

    function hasSkill(list, skill) {
        return list.some(
            item => normalizeSkill(item) === normalizeSkill(skill)
        );
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
        return String(name || "Student")
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


    // -----------------------------------------
    // LOAD LOGGED-IN STUDENT
    // -----------------------------------------

    async function loadCurrentUser() {

        const data = await apiRequest(`${USERS_API}/me`);

        currentUser = data.user;

        if (!currentUser) {
            throw new Error("Unable to find your student profile.");
        }

        const nameElement = $("#topUserName");
        const avatarElement = $("#topAvatar");

        if (nameElement) {
            nameElement.textContent =
                currentUser.fullName.split(" ")[0];
        }

        if (avatarElement) {
            avatarElement.textContent =
                getInitials(currentUser.fullName);
        }
    }


    // -----------------------------------------
    // LOAD ALL REGISTERED STUDENTS
    // -----------------------------------------

    async function loadStudents() {

        const data = await apiRequest(USERS_API);

        allUsers = (data.users || []).filter(
            user => user._id !== currentUser._id
        );
    }


    // -----------------------------------------
    // LOAD SKILL EXCHANGE DATA
    // -----------------------------------------

    async function loadSkillData() {

        const [
            profileData,
            allProfileData,
            requestData
        ] = await Promise.all([

            apiRequest(`${SKILL_API}/mine`),

            apiRequest(SKILL_API),

            apiRequest(`${SKILL_API}/requests/mine`)

        ]);

        const myProfile = profileData.profile;

        // Learning skills come from JSON
        learningSkills = myProfile
            ? myProfile.learnSkills || []
            : [];

        // Teaching skills come directly from MongoDB
        skillsToShare = myProfile
            ? myProfile.teachSkills || []
            : currentUser.teachSkills || [];

        // All student profiles
        profiles = allProfileData.profiles || [];

        // Sent and received requests
        sentRequests = requestData.sent || [];

        receivedRequests = requestData.received || [];
    }


    // -----------------------------------------
    // GET STUDENT INFORMATION
    // -----------------------------------------

    function getStudentProfile(studentId) {

        const user = allUsers.find(
            item => item._id === studentId
        );

        const profile = profiles.find(
            item => item.studentId === studentId
        );

        if (!user || !profile) return null;

        return {
            id: user._id,
            name: user.fullName || "Student",
            initials: getInitials(user.fullName),

            course: `${user.course || "Course"} · Year ${user.year || "N/A"}`,

            bio: user.bio || "Interested in learning and sharing skills.",

            teaches: profile.teachSkills || [],
            wants: profile.learnSkills || [],

            color: ""
        };
    }


    // -----------------------------------------
    // RENDER SKILL CHOICES
    // -----------------------------------------

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

                            const selected = hasSkill(
                                learningSkills,
                                skill
                            );

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

        const standardSkills = skillGroups.flatMap(
            group => group.skills
        );

        const customSkills = learningSkills.filter(
            skill => !hasSkill(standardSkills, skill)
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


    // -----------------------------------------
    // RENDER SELECTED LEARNING SKILLS
    // -----------------------------------------

    function renderSelectedSkills() {

        const container = $("#selectedSkillsList");

        if (!container) return;

        $("#selectedCount").textContent =
            `${learningSkills.length} selected`;

        $("#learningCount").textContent =
            learningSkills.length;

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


    // -----------------------------------------
    // ADD OR REMOVE LEARNING SKILLS
    // -----------------------------------------

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


    // -----------------------------------------
    // ADD CUSTOM SKILL
    // -----------------------------------------

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


    // -----------------------------------------
    // SAVE LEARNING SKILLS
    // -----------------------------------------

    async function saveLearningSkills() {

        try {

            const data = await apiRequest(SKILL_API, {

                method: "POST",

                // Only learning skills are saved in JSON
                body: JSON.stringify({
                    learnSkills: learningSkills
                })

            });

            learningSkills = data.profile.learnSkills || [];

            await loadSkillData();

            showToast("Your learning goals have been saved!");

            renderAll();

        } catch (error) {

            console.error(error);

            showToast(error.message);
        }
    }


    // -----------------------------------------
    // FIND MUTUAL SKILL MATCHES
    // -----------------------------------------

    function getMutualMatch(student) {

        const theyCanTeachYou = student.teaches.filter(
            skill => hasSkill(learningSkills, skill)
        );

        const youCanTeachThem = student.wants.filter(
            skill => hasSkill(skillsToShare, skill)
        );

        return {
            theyCanTeachYou,
            youCanTeachThem
        };
    }


    // -----------------------------------------
    // CHECK EXISTING REQUEST
    // -----------------------------------------

    function getExistingRequest(studentId) {

        return sentRequests.find(
            request => request.receiverId === studentId
        );
    }


    // -----------------------------------------
    // CREATE MATCH CARD
    // -----------------------------------------

    function createMatchCard(student) {

        const match = getMutualMatch(student);

        const totalPossible =
            learningSkills.length + skillsToShare.length;

        const matchedCount =
            match.theyCanTeachYou.length +
            match.youCanTeachThem.length;

        const matchPercentage = totalPossible > 0
            ? Math.min(
                100,
                Math.round((matchedCount / totalPossible) * 100)
            )
            : 0;

        const existingRequest = getExistingRequest(student.id);

        let buttonText = "Connect for skill exchange";

        if (existingRequest) {

            buttonText =
                existingRequest.status === "Accepted"
                    ? "Exchange request accepted ✓"
                    : existingRequest.status === "Rejected"
                        ? "Request rejected"
                        : "Exchange request sent ✓";
        }

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

                        <span class="match-column-title">
                            They can teach
                        </span>

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

                        <span class="match-column-title">
                            They want to learn
                        </span>

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
                    ${existingRequest ? "disabled" : ""}>

                    ${buttonText}

                </button>

            </article>

        `;
    }


    // -----------------------------------------
    // DISPLAY MATCHING STUDENTS
    // -----------------------------------------

    function renderMatches() {

        const grid = $("#mentorGrid");

        const empty = $("#mentorEmpty");

        const searchInput = $("#mentorSearch");

        if (!grid || !empty) return;

        const searchTerm = searchInput
            ? searchInput.value.trim().toLowerCase()
            : "";

        const mutualMatches = profiles
            .filter(profile => profile.studentId !== currentUser._id)
            .map(profile => getStudentProfile(profile.studentId))
            .filter(student => {

                if (!student) return false;

                const match = getMutualMatch(student);

                const isMutual =
                    match.theyCanTeachYou.length > 0 &&
                    match.youCanTeachThem.length > 0;

                const searchableText = [
                    student.name,
                    student.course,
                    ...student.teaches,
                    ...student.wants
                ].join(" ").toLowerCase();

                return (
                    isMutual &&
                    searchableText.includes(searchTerm)
                );
            });

        grid.innerHTML = mutualMatches
            .map(createMatchCard)
            .join("");

        empty.classList.toggle(
            "hidden",
            mutualMatches.length > 0
        );

        const summary = $("#matchSummary");

        if (summary) {

            if (
                learningSkills.length === 0 ||
                skillsToShare.length === 0
            ) {

                summary.textContent =
                    "Add skills you can teach and skills you want to learn to find mutual matches.";

            } else {

                summary.textContent =
                    `${mutualMatches.length} student(s) match your learning and teaching skills.`;
            }
        }

        updateStatistics();
    }


    // -----------------------------------------
    // SEND SKILL EXCHANGE REQUEST
    // -----------------------------------------

    async function sendExchangeRequest(studentId) {

        const student = getStudentProfile(studentId);

        if (!student) return;

        const match = getMutualMatch(student);

        if (
            match.theyCanTeachYou.length === 0 ||
            match.youCanTeachThem.length === 0
        ) {

            showToast("A mutual skill match is required.");

            return;
        }

        if (getExistingRequest(studentId)) {

            showToast("A request already exists.");

            return;
        }

        try {

            await apiRequest(`${SKILL_API}/requests`, {

                method: "POST",

                body: JSON.stringify({
                    receiverId: studentId
                })

            });

            await loadSkillData();

            showToast("Skill exchange request sent successfully!");

            renderAll();

        } catch (error) {

            console.error(error);

            showToast(error.message);
        }
    }


    // -----------------------------------------
    // ACCEPT OR REJECT INCOMING REQUEST
    // -----------------------------------------

    async function updateRequest(requestId, status) {

        try {

            const data = await apiRequest(
                `${SKILL_API}/requests/${requestId}`,
                {
                    method: "PATCH",

                    body: JSON.stringify({
                        status
                    })
                }
            );

            await loadSkillData();

            showToast(data.message);

            renderAll();

        } catch (error) {

            console.error(error);

            showToast(error.message);
        }
    }


    // -----------------------------------------
    // DISPLAY SENT AND RECEIVED REQUESTS
    // -----------------------------------------

    function renderMyRequests() {

        const container = $("#myRequestsList");

        const count = $("#requestCount");

        if (!container || !count) return;

        const totalRequests =
            sentRequests.length + receivedRequests.length;

        count.textContent =
            `${totalRequests} ${totalRequests === 1 ? "request" : "requests"}`;

        let html = "";


        // INCOMING REQUESTS

        html += `
            <h3 class="request-section-heading">
                Incoming Requests (${receivedRequests.length})
            </h3>
        `;

        const pendingIncoming = receivedRequests.filter(
            request => request.status === "Pending"
        );

        if (receivedRequests.length === 0) {

            html += `
                <div class="request-empty">
                    You haven't received any skill exchange requests.
                </div>
            `;

        } else {

            html += receivedRequests.slice().reverse().map(request => {

                const student = allUsers.find(
                    user => user._id === request.senderId
                );

                const studentName = student
                    ? student.fullName
                    : "Student";

                const status = request.status || "Pending";

                const statusClass =
                    status === "Accepted"
                        ? "accepted"
                        : status === "Rejected"
                            ? "rejected"
                            : "";

                return `

                    <div class="request-row">

                        <div class="request-person">

                            <div class="mentor-avatar">
                                ${escapeHTML(getInitials(studentName))}
                            </div>

                            <div>

                                <strong>
                                    ${escapeHTML(studentName)}
                                </strong>

                                <small>
                                    Sent you a skill exchange request
                                </small>

                            </div>

                        </div>

                        ${
                            status === "Pending"
                                ? `
                                    <div class="request-actions">

                                        <button
                                            type="button"
                                            class="request-button"
                                            data-accept-request="${escapeHTML(request.id)}">

                                            Accept

                                        </button>

                                        <button
                                            type="button"
                                            class="request-button"
                                            data-reject-request="${escapeHTML(request.id)}">

                                            Reject

                                        </button>

                                    </div>
                                `
                                : `
                                    <span class="request-status ${statusClass}">
                                        ${escapeHTML(status)}
                                    </span>
                                `
                        }

                    </div>

                `;

            }).join("");
        }


        // SENT REQUESTS

        html += `
            <h3 class="request-section-heading">
                Sent Requests (${sentRequests.length})
            </h3>
        `;

        if (sentRequests.length === 0) {

            html += `
                <div class="request-empty">
                    Your sent skill exchange requests will appear here.
                </div>
            `;

        } else {

            html += sentRequests.slice().reverse().map(request => {

                const student = allUsers.find(
                    user => user._id === request.receiverId
                );

                const studentName = student
                    ? student.fullName
                    : "Student";

                const status = request.status || "Pending";

                const statusClass =
                    status === "Accepted"
                        ? "accepted"
                        : status === "Rejected"
                            ? "rejected"
                            : "";

                return `

                    <div class="request-row">

                        <div class="request-person">

                            <div class="mentor-avatar">
                                ${escapeHTML(getInitials(studentName))}
                            </div>

                            <div>

                                <strong>
                                    ${escapeHTML(studentName)}
                                </strong>

                                <small>
                                    Skill exchange request
                                </small>

                            </div>

                        </div>

                        <span class="request-status ${statusClass}">
                            ${escapeHTML(status)}
                        </span>

                    </div>

                `;

            }).join("");
        }

        container.innerHTML = html;
    }


    // -----------------------------------------
    // DISPLAY MY TEACHING SKILLS
    // -----------------------------------------

    function renderMySkills() {

        const container = $("#mySkillsList");

        if (!container) return;

        $("#teachingCount").textContent =
            skillsToShare.length;

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


    // -----------------------------------------
    // UPDATE STATISTICS
    // -----------------------------------------

    function updateStatistics() {

        $("#learningCount").textContent =
            learningSkills.length;

        $("#teachingCount").textContent =
            skillsToShare.length;

        const mutualCount = profiles.filter(profile => {

            if (profile.studentId === currentUser._id) {
                return false;
            }

            const student = getStudentProfile(profile.studentId);

            if (!student) return false;

            const match = getMutualMatch(student);

            return (
                match.theyCanTeachYou.length > 0 &&
                match.youCanTeachThem.length > 0
            );

        }).length;

        $("#matchCount").textContent = mutualCount;
    }


    // -----------------------------------------
    // RENDER ALL SECTIONS
    // -----------------------------------------

    function renderAll() {

        renderSkillChoices();

        renderSelectedSkills();

        renderMySkills();

        renderMatches();

        renderMyRequests();

        updateStatistics();
    }


    // -----------------------------------------
    // EVENT LISTENERS
    // -----------------------------------------

    $("#skillChoices").addEventListener("click", function (event) {

        const button = event.target.closest("[data-skill]");

        if (!button) return;

        toggleSkill(button.dataset.skill);
    });


    $("#selectedSkillsList").addEventListener("click", function (event) {

        const button = event.target.closest("[data-remove-skill]");

        if (!button) return;

        toggleSkill(button.dataset.removeSkill);
    });


    $("#addCustomSkill").addEventListener("click", addCustomSkill);


    $("#customSkillInput").addEventListener("keydown", function (event) {

        if (event.key === "Enter") {

            event.preventDefault();

            addCustomSkill();
        }
    });


    $("#saveLearningSkills").addEventListener(
        "click",
        saveLearningSkills
    );


    $("#mentorSearch").addEventListener(
        "input",
        renderMatches
    );


    $("#mentorGrid").addEventListener("click", function (event) {

        const button = event.target.closest("[data-request-student]");

        if (!button || button.disabled) return;

        sendExchangeRequest(button.dataset.requestStudent);
    });


    // ACCEPT INCOMING REQUEST

    $("#myRequestsList").addEventListener("click", function (event) {

        const acceptButton = event.target.closest("[data-accept-request]");

        if (acceptButton) {

            updateRequest(
                acceptButton.dataset.acceptRequest,
                "Accepted"
            );

            return;
        }

        const rejectButton = event.target.closest("[data-reject-request]");

        if (rejectButton) {

            updateRequest(
                rejectButton.dataset.rejectRequest,
                "Rejected"
            );
        }
    });


    // -----------------------------------------
    // MOBILE SIDEBAR
    // -----------------------------------------

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


    // -----------------------------------------
    // LOGOUT
    // -----------------------------------------

    const logoutButton = $("#logoutBtn");

    if (logoutButton) {

        logoutButton.addEventListener("click", async function (event) {

            event.preventDefault();

            const confirmed = confirm(
                "Are you sure you want to log out?"
            );

            if (!confirmed) return;

            try {

                await apiRequest(`${USERS_API}/logout`, {
                    method: "POST"
                });

                sessionStorage.removeItem("skillmateCurrentUser");

                localStorage.removeItem("skillmateCurrentUser");

                window.location.href = "./Login.html";

            } catch (error) {

                showToast(error.message);
            }
        });
    }


    // -----------------------------------------
    // INITIAL PAGE SETUP
    // -----------------------------------------

    async function initializePage() {

        try {

            await loadCurrentUser();

            await loadStudents();

            await loadSkillData();

            renderAll();

        } catch (error) {

            console.error("SkillExchange loading error:", error);

            showToast(error.message);

            if (
                error.message.toLowerCase().includes("login")
            ) {

                window.location.href = "./Login.html";
            }
        }
    }

    initializePage();

});