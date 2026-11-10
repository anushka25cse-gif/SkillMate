document.addEventListener("DOMContentLoaded", async function () {

    const $ = selector => document.querySelector(selector);
    const $$ = selector => [...document.querySelectorAll(selector)];

    const API = "http://127.0.0.1:5000/api";
    const PROJECTS_API = `${API}/projects`;
    const USERS_API = `${API}/users`;
    const CONNECTIONS_API = `${API}/connections`;
    const SAVED_PEOPLE_API = `${API}/saved-people`;

    // -----------------------------------------
    // STORAGE HELPERS
    // -----------------------------------------

    function readJSON(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key));
            return value ?? fallback;
        } catch (error) {
            return fallback;
        }
    }

    function saveJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error("Storage error:", error);
            return false;
        }
    }

    // -----------------------------------------
    // CURRENT USER
    // -----------------------------------------

    let user = {};

    try {
        const response = await fetch(`${USERS_API}/me`, {
            method: "GET",
            credentials: "include"
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            alert("Please login first.");
            window.location.href = "./StudentLogin.html";
            return;
        }

        user = result.user;

        sessionStorage.setItem(
            "skillmateCurrentUser",
            JSON.stringify(user)
        );

    } catch (error) {
        console.error("Profile loading error:", error);
        alert("Cannot connect to SkillMate server. Please start the backend.");
        return;
    }

    const knownSkills = Array.isArray(user.knownSkills)
        ? user.knownSkills
        : [];

    const teachSkills = Array.isArray(user.teachSkills)
        ? user.teachSkills
        : [];

let savedPeople = [];

    let students = [];
    let projects = [];

    let incomingRequests = [];
    let sentRequests = [];
    let acceptedConnections = [];

    let activeView = "overview";
    let toastTimer;
    let searchTerm = "";

    // -----------------------------------------
    // GENERAL HELPERS
    // -----------------------------------------

    function initials(name) {
        return (name || "Student")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part[0].toUpperCase())
            .join("");
    }

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
        const toast = $("#toast");
        if (!toast) return;

        toast.textContent = message;
        toast.classList.add("show");

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
    }

    function setText(id, value, fallback = "Not provided") {
        const element = document.getElementById(id);

        if (element) {
            element.textContent = value || fallback;
        }
    }

    function userName() {
        return user.fullName || user.name || "Student";
    }

    function getPerson(id) {
        return students.find(person => person.id === String(id));
    }

    // -----------------------------------------
    // CONVERT MONGODB USER INTO STUDENT PROFILE
    // -----------------------------------------

    function formatStudent(student) {
        if (!student) return null;

        const name = student.fullName || student.name || "Student";

        return {
            id: String(student._id),
            name,
            initials: initials(name),

            course: [
                student.course,
                student.year ? `Year ${student.year}` : ""
            ].filter(Boolean).join(" · ") || "Student",

            college: student.college || "College not provided",

            bio: student.bio || "No bio added yet.",

            skills: Array.isArray(student.knownSkills)
                ? student.knownSkills
                : [],

            teaches: Array.isArray(student.teachSkills)
                ? student.teachSkills
                : [],

            interests: Array.isArray(student.interests)
                ? student.interests
                : [],

            profilePhoto: student.profilePhoto || "",

            score: 75,

            color: ""
        };
    }

    // -----------------------------------------
    // LOAD REAL STUDENTS FROM MONGODB
    // -----------------------------------------

    async function loadStudents() {
        try {
            const response = await fetch(USERS_API, {
                method: "GET",
                credentials: "include"
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Could not load students."
                );
            }

            students = (result.users || [])
                .filter(student =>
                    String(student._id) !== String(user._id)
                )
                .map(formatStudent);

        } catch (error) {
            console.error("Student loading error:", error);
            showToast("Could not load student profiles.");
        }
    }

    // -----------------------------------------
    // LOAD CONNECTION DATA FROM MONGODB
    // -----------------------------------------

    async function loadConnectionData() {
        try {
            const [
                receivedResponse,
                sentResponse,
                acceptedResponse
            ] = await Promise.all([

                fetch(`${CONNECTIONS_API}/requests/received`, {
                    credentials: "include"
                }),

                fetch(`${CONNECTIONS_API}/requests/sent`, {
                    credentials: "include"
                }),

                fetch(CONNECTIONS_API, {
                    credentials: "include"
                })

            ]);

            const receivedResult = await receivedResponse.json();
            const sentResult = await sentResponse.json();
            const acceptedResult = await acceptedResponse.json();

            if (
                !receivedResponse.ok ||
                !sentResponse.ok ||
                !acceptedResponse.ok ||
                !receivedResult.success ||
                !sentResult.success ||
                !acceptedResult.success
            ) {
                throw new Error(
                    "Could not load connection information."
                );
            }

            incomingRequests = receivedResult.requests || [];
            sentRequests = sentResult.requests || [];
            acceptedConnections = acceptedResult.connections || [];

        } catch (error) {
            console.error("Connection loading error:", error);
            showToast("Could not load connection requests.");
        }
    }
    // -----------------------------------------
// LOAD SAVED PEOPLE FROM BACKEND JSON
// -----------------------------------------

async function loadSavedPeople() {
    try {
        const response = await fetch(SAVED_PEOPLE_API, {
            method: "GET",
            credentials: "include"
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Could not load saved people."
            );
        }

        savedPeople = Array.isArray(result.savedPeople)
            ? result.savedPeople.map(String)
            : [];

        // Migrate previously saved people from localStorage
        const oldSavedPeople = readJSON("skillmateSavedPeople", []);

        if (Array.isArray(oldSavedPeople)) {
            for (const personId of oldSavedPeople) {

                const id = String(personId);

                if (!savedPeople.includes(id)) {
                    const saveResponse = await fetch(
                        `${SAVED_PEOPLE_API}/${id}`,
                        {
                            method: "POST",
                            credentials: "include"
                        }
                    );

                    const saveResult = await saveResponse.json();

                    if (!saveResponse.ok || !saveResult.success) {
                        throw new Error("Could not migrate saved people.");
                    }

                    savedPeople = saveResult.savedPeople.map(String);
                }
            }

            localStorage.removeItem("skillmateSavedPeople");
        }

    } catch (error) {
        console.error("Saved people loading error:", error);
        showToast("Could not load saved people.");
    }
}

    // -----------------------------------------
    // GET OTHER PERSON IN A CONNECTION
    // -----------------------------------------

    function getConnectionPerson(connection) {
        const sender = connection.sender;
        const receiver = connection.receiver;

        if (!sender || !receiver) return null;

        const otherPerson =
            String(sender._id) === String(user._id)
                ? receiver
                : sender;

        return formatStudent(otherPerson);
    }

    function hasSentRequest(personId) {
        return sentRequests.some(request =>
            String(request.receiver?._id) === String(personId)
        );
    }

    function isAccepted(personId) {
        return acceptedConnections.some(connection => {

            const senderId = String(connection.sender?._id);
            const receiverId = String(connection.receiver?._id);

            return (
                senderId === String(personId) ||
                receiverId === String(personId)
            );
        });
    }

    // -----------------------------------------
    // PROFILE COMPLETION
    // -----------------------------------------

    function getProfilePercent() {
        const checks = [
            Boolean(userName() !== "Student"),
            Boolean(user.email),
            Boolean(user.college),
            knownSkills.length >= 2,
            teachSkills.length >= 1,
            Boolean(user.bio),
            Boolean(user.profilePhoto),
            Boolean(user.interests && (
                Array.isArray(user.interests)
                    ? user.interests.length
                    : user.interests
            )),
            Boolean(user.proficiency),
            Boolean(user.availability),
            Boolean(user.collaboration)
        ];

        return Math.round(
            checks.filter(Boolean).length / checks.length * 100
        );
    }

    function renderSkillCloud(id, items) {
        const container = document.getElementById(id);
        if (!container) return;

        container.innerHTML = items.length
            ? items.map(skill =>
                `<span class="skill-chip">${escapeHTML(skill)}</span>`
            ).join("")
            : '<span class="empty-note">No skills added yet.</span>';
    }

    // -----------------------------------------
    // DISPLAY CURRENT USER
    // -----------------------------------------

    function renderUser() {
        const name = userName();
        const firstName = name.split(/\s+/)[0];
        const avatarText = initials(name);
        const photo = user.profilePhoto || "";

        setText("welcomeName", firstName);
        setText("topName", firstName);
        setText("profileName", name);
        setText("fullProfileName", name);

        setText(
            "profileCourse",
            [user.course, user.year].filter(Boolean).join(" · "),
            "SkillMate student"
        );

        setText(
            "fullProfileCourse",
            [user.course, user.year].filter(Boolean).join(" · "),
            "SkillMate student"
        );

        setText("profileCollege", user.college);

        setText(
            "profileBio",
            user.bio,
            "Add a short bio to let people know what you're passionate about."
        );

        setText(
            "fullProfileBio",
            user.bio,
            "Add a short bio to tell your story."
        );

        ["topAvatar", "profileAvatar", "fullProfileAvatar"].forEach(id => {
            const element = document.getElementById(id);
            if (!element) return;

            element.textContent = photo ? "" : avatarText;

            if (photo) {
                element.style.backgroundImage = `url("${photo}")`;
                element.style.backgroundSize = "cover";
                element.style.backgroundPosition = "center";
            }
        });

        setText("detailEmail", user.email);
        setText("detailCollege", user.college);
        setText("detailRegistration", user.registration);
        setText("detailGraduation", user.graduation);
        setText("detailAvailability", user.availability);
        setText("detailCollaboration", user.collaboration);

        const percentage = getProfilePercent();

        setText("profilePercent", `${percentage}%`);

        const progress = $("#profileProgress");

        if (progress) {
            progress.style.width = `${percentage}%`;
        }

        const tagContainer = $("#profileTags");

        if (tagContainer) {
            const tags = knownSkills.slice(0, 3);

            tagContainer.innerHTML = tags.length
                ? tags.map(skill =>
                    `<span class="skill-chip">${escapeHTML(skill)}</span>`
                ).join("")
                : '<span class="skill-chip">Add your skills</span>';
        }

        const interests = Array.isArray(user.interests)
            ? user.interests
            : String(user.interests || "")
                .split(",")
                .map(item => item.trim())
                .filter(Boolean);

        renderSkillCloud("detailInterests", interests);
        renderSkillCloud("myKnownSkills", knownSkills);
        renderSkillCloud("myTeachSkills", teachSkills);
        renderSkillCloud("fullKnownSkills", knownSkills);
        renderSkillCloud("fullTeachSkills", teachSkills);

        setText("knownCount", knownSkills.length, "0");
        setText("teachCount", teachSkills.length, "0");
        setText("savedCount", savedPeople.length, "0");
    }

    // -----------------------------------------
    // MATCH SCORE
    // -----------------------------------------

    function matchScore(person) {
        const mine = new Set(
            knownSkills.map(skill => skill.toLowerCase())
        );

        const theirSkills = person.skills.map(
            skill => skill.toLowerCase()
        );

        const shared = theirSkills.filter(
            skill => mine.has(skill)
        ).length;

        const complementary = person.teaches.filter(
            skill => mine.has(skill.toLowerCase())
        ).length;

        if (!mine.size) return person.score;

        const calculated = Math.min(
            99,
            72 + shared * 5 + complementary * 4
        );

        return Math.max(
            65,
            Math.min(person.score, calculated)
        );
    }

    // -----------------------------------------
    // STUDENT CARD
    // -----------------------------------------

    function personCard(person) {
        const saved = savedPeople.includes(person.id);
        const connected = hasSentRequest(person.id);
        const accepted = isAccepted(person.id);

        let connectLabel = "Connect →";

        if (accepted) {
            connectLabel = "Connected ✓";
        } else if (connected) {
            connectLabel = "Requested ✓";
        }

        return `
            <article class="person-card">

                <div class="person-card-cover"></div>

                <button class="save-button ${saved ? "saved" : ""}"
    data-save="${escapeHTML(person.id)}"
    aria-label="${saved ? "Remove saved teammate" : "Save teammate"}"
    title="${saved ? "Remove from saved people" : "Save teammate"}">
    ${saved ? "❤️" : "♡"}
</button>

                <div class="person-avatar ${escapeHTML(person.color)}"
                    ${person.profilePhoto
                        ? `style="background-image:url('${escapeHTML(person.profilePhoto)}');background-size:cover;background-position:center;color:transparent"`
                        : ""}>
                    ${person.profilePhoto ? "" : escapeHTML(person.initials)}
                </div>

                <h3>${escapeHTML(person.name)}</h3>

                <div class="person-role">
                    ${escapeHTML(person.course)} · ${escapeHTML(person.college)}
                </div>

                <p class="person-bio">${escapeHTML(person.bio)}</p>

                <div class="person-skills">
                    ${person.skills.slice(0, 4).map(skill =>
                        `<span class="skill-chip">${escapeHTML(skill)}</span>`
                    ).join("")}
                </div>

                <div class="person-card-footer">

                    <span class="match-badge">
                        ${matchScore(person)}% match
                    </span>

                    <button class="connect-button"
                        data-connect="${escapeHTML(person.id)}"
                        ${connected || accepted ? "disabled" : ""}>
                        ${connectLabel}
                    </button>

                </div>

            </article>
        `;
    }

    // -----------------------------------------
    // SMALL STUDENT CARD
    // -----------------------------------------

    function smallPerson(person) {
        const saved = savedPeople.includes(person.id);
        const connected = hasSentRequest(person.id);
        const accepted = isAccepted(person.id);

        let connectLabel = "Connect";

        if (accepted) {
            connectLabel = "Connected ✓";
        } else if (connected) {
            connectLabel = "Requested";
        }

        return `
            <div class="recommendation-item">

                <div class="person-avatar ${escapeHTML(person.color)}"
                    ${person.profilePhoto
                        ? `style="background-image:url('${escapeHTML(person.profilePhoto)}');background-size:cover;background-position:center;color:transparent"`
                        : ""}>
                    ${person.profilePhoto ? "" : escapeHTML(person.initials)}
                </div>

                <div class="person-info">

                    <h3>${escapeHTML(person.name)}</h3>

                    <p>${escapeHTML(person.course)}</p>

                    <div class="person-skills">
                        ${person.skills.slice(0, 2).map(skill =>
                            `<span class="skill-chip">${escapeHTML(skill)}</span>`
                        ).join("")}
                    </div>

                </div>

                <span class="match-score">
                    ${matchScore(person)}%
                </span>

                <div class="person-actions">

                    <button class="save-button ${saved ? "saved" : ""}"
                        data-save="${escapeHTML(person.id)}"
                        aria-label="${saved ? "Remove saved teammate" : "Save teammate"}"
                        title="${saved ? "Remove from saved people" : "Save teammate"}">✓</button>

                    <button class="connect-button"
                        data-connect="${escapeHTML(person.id)}"
                        ${connected || accepted ? "disabled" : ""}>
                        ${connectLabel}
                    </button>

                </div>

            </div>
        `;
    }

    // -----------------------------------------
    // RECOMMENDATIONS
    // -----------------------------------------

    function renderRecommendations() {
        const container = $("#overviewRecommendations");
        if (!container) return;

        const sorted = [...students].sort(
            (a, b) => matchScore(b) - matchScore(a)
        );

        container.innerHTML = sorted
            .slice(0, 3)
            .map(smallPerson)
            .join("");
    }

    // -----------------------------------------
    // SAVED PEOPLE
    // -----------------------------------------

    function renderSaved() {
        const grid = $("#savedGrid");
        const empty = $("#savedEmpty");

        if (!grid || !empty) return;

        const people = students.filter(person =>
            savedPeople.includes(person.id)
        );

        grid.innerHTML = people.map(personCard).join("");

        empty.classList.toggle("hidden", people.length > 0);
    }

    async function savePerson(id) {

    const personId = String(id);

    const isSaved = savedPeople.includes(personId);

    try {

        const response = await fetch(
            `${SAVED_PEOPLE_API}/${personId}`,
            {
                method: isSaved ? "DELETE" : "POST",
                credentials: "include"
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Could not update saved people."
            );
        }

        savedPeople = Array.isArray(result.savedPeople)
            ? result.savedPeople.map(String)
            : [];

        if (isSaved) {
            showToast("Removed from your saved teammates.");
        } else {
            showToast("Teammate saved to your shortlist.");
        }

        renderUser();
        renderRecommendations();

        if (activeView === "saved") {
            renderSaved();
        }

    } catch (error) {

        console.error("Save person error:", error);

        showToast(
            error.message || "Could not update saved people."
        );

    }
}

    // -----------------------------------------
    // LOAD PROJECTS FROM MONGODB
    // -----------------------------------------

    async function loadProjects() {
        try {
            const response = await fetch(PROJECTS_API, {
                method: "GET",
                credentials: "include"
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Could not load projects."
                );
            }

            projects = (result.projects || []).map(project => ({
                ...project,
                id: project._id,
                members: Array.isArray(project.members)
                    ? project.members.length
                    : 0,
                status: project.status || "Open"
            }));

            renderProjects();

        } catch (error) {
            console.error("Project loading error:", error);
            showToast("Could not load projects from the server.");
        }
    }

    // -----------------------------------------
    // PROJECT CARD
    // -----------------------------------------

    function projectCard(project) {
        return `
            <article class="project-card">

                <div class="project-card-top">

                    <span class="project-emoji">
                        ${escapeHTML(project.emoji || "✦")}
                    </span>

                    <span class="project-status">
                        ${escapeHTML(project.status || "Open idea")}
                    </span>

                </div>

                <div class="project-category">
                    ${escapeHTML(project.category || "Other")}
                </div>

                <h3>${escapeHTML(project.title || "Untitled Project")}</h3>

                <p>${escapeHTML(project.description || "")}</p>

                <div class="person-skills">
                    ${(Array.isArray(project.skills) ? project.skills : [])
                        .slice(0, 3)
                        .map(skill =>
                            `<span class="skill-chip">${escapeHTML(skill)}</span>`
                        )
                        .join("")}
                </div>

                <div class="project-meta">
                    <span>${Number(project.members) || 1} collaborators</span>
                    <span>Teamwork starts here</span>
                </div>

                <button class="outline-button"
                    data-project="${escapeHTML(project.id)}">
                    Interested in this →
                </button>

            </article>
        `;
    }

    function renderProjects() {
        const overview = $("#overviewProjects");
        const fullGrid = $("#projectsGrid");

        if (overview) {
            overview.innerHTML = projects
                .slice(0, 3)
                .map(projectCard)
                .join("");
        }

        if (fullGrid) {
            fullGrid.innerHTML = projects
                .map(projectCard)
                .join("");
        }
    }

    // -----------------------------------------
    // CONNECTION REQUESTS
    // -----------------------------------------

    function renderRequestList(
        containerId,
        emptyId,
        requests,
        type
    ) {
        const container = document.getElementById(containerId);
        const empty = document.getElementById(emptyId);

        if (!container || !empty) return;

        const validRequests = requests.map(request => {

            let person = null;

            if (type === "received" && request.sender) {
                person = formatStudent(request.sender);
            }

            else if (type === "sent" && request.receiver) {
                person = formatStudent(request.receiver);
            }

            else if (type === "accepted") {
                person = getConnectionPerson(request);
            }

            return person ? { request, person } : null;

        }).filter(Boolean);

        empty.classList.toggle(
            "hidden",
            validRequests.length > 0
        );

        container.innerHTML = validRequests.map(({ request, person }) => {

            let buttons = "";
            let statusText = "";

            if (type === "received") {

                statusText = "Wants to connect with you";

                buttons = `
                    <button class="request-action accept-request"
                        data-accept="${escapeHTML(request._id)}">
                        Accept
                    </button>

                    <button class="request-action decline-request"
                        data-decline="${escapeHTML(request._id)}">
                        Decline
                    </button>
                `;

            } else if (type === "sent") {

                statusText = "Connection request sent";

            } else {

                statusText = "You are now connected ✓";

            }

            return `
                <div class="connection-row">

                    <div class="person-avatar"
                        ${person.profilePhoto
                            ? `style="background-image:url('${escapeHTML(person.profilePhoto)}');background-size:cover;background-position:center;color:transparent"`
                            : ""}>
                        ${person.profilePhoto
                            ? ""
                            : escapeHTML(person.initials)}
                    </div>

                    <div class="connection-person-info">

                        <strong>${escapeHTML(person.name)}</strong>

                        <p>${escapeHTML(person.course)}</p>

                        <small>${statusText}</small>

                    </div>

                    <div class="request-actions">
                        ${buttons}
                    </div>

                </div>
            `;

        }).join("");
    }

    function renderConnectionRequests() {

        setText(
            "receivedRequestCount",
            incomingRequests.length,
            "0"
        );

        setText(
            "sentRequestCount",
            sentRequests.length,
            "0"
        );

        setText(
            "acceptedRequestCount",
            acceptedConnections.length,
            "0"
        );

        setText(
            "requestCount",
            incomingRequests.length + sentRequests.length,
            "0"
        );

        renderRequestList(
            "receivedRequestsList",
            "receivedRequestsEmpty",
            incomingRequests,
            "received"
        );

        renderRequestList(
            "sentRequestsList",
            "sentRequestsEmpty",
            sentRequests,
            "sent"
        );

        renderRequestList(
            "acceptedRequestsList",
            "acceptedRequestsEmpty",
            acceptedConnections,
            "accepted"
        );
    }

    // -----------------------------------------
    // ACCEPT CONNECTION REQUEST
    // -----------------------------------------

    async function acceptRequest(requestId) {

        try {
            const response = await fetch(
                `${CONNECTIONS_API}/${requestId}/accept`,
                {
                    method: "PATCH",
                    credentials: "include"
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Could not accept request."
                );
            }

            await loadConnectionData();

            renderConnectionRequests();
            renderRecommendations();
            renderSaved();
            renderConnections();

            showToast("Connection accepted successfully!");

        } catch (error) {
            console.error("Accept request error:", error);
            showToast(error.message || "Could not accept the request.");
        }
    }

    // -----------------------------------------
    // REJECT CONNECTION REQUEST
    // -----------------------------------------

    async function declineRequest(requestId) {

        try {
            const response = await fetch(
                `${CONNECTIONS_API}/${requestId}/reject`,
                {
                    method: "PATCH",
                    credentials: "include"
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Could not reject the request."
                );
            }

            await loadConnectionData();

            renderConnectionRequests();
            renderRecommendations();
            renderSaved();

            showToast("Connection request declined.");

        } catch (error) {
            console.error("Reject request error:", error);
            showToast(error.message || "Could not decline the request.");
        }
    }

    // -----------------------------------------
    // CONNECTION ACTIVITY
    // -----------------------------------------

    function renderConnections() {

        const container = $("#connectionList");
        if (!container) return;

        const allConnections = acceptedConnections
            .map(connection => ({
                connection,
                person: getConnectionPerson(connection)
            }))
            .filter(item => item.person);

        if (!allConnections.length) {
            container.innerHTML = `
                <p class="empty-note">
                    You don't have any accepted connections yet.
                </p>
            `;
            return;
        }

        container.innerHTML = `
            <h3 class="subheading">Your connections</h3>

            ${allConnections.map(({ person }) => `
                <div class="connection-row">

                    <div class="person-avatar"
                        ${person.profilePhoto
                            ? `style="background-image:url('${escapeHTML(person.profilePhoto)}');background-size:cover;background-position:center;color:transparent"`
                            : ""}>
                        ${person.profilePhoto
                            ? ""
                            : escapeHTML(person.initials)}
                    </div>

                    <div>
                        <strong>${escapeHTML(person.name)}</strong>
                        <p>Connection accepted ✓</p>
                    </div>

                </div>
            `).join("")}
        `;
    }

    // -----------------------------------------
    // SEND CONNECTION REQUEST
    // -----------------------------------------

    async function connectPerson(id) {

        const person = getPerson(id);

        if (!person) return;

        if (hasSentRequest(id) || isAccepted(id)) {
            showToast("You already have a connection with this student.");
            return;
        }

        try {
            const response = await fetch(
                `${CONNECTIONS_API}/request/${id}`,
                {
                    method: "POST",
                    credentials: "include"
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Could not send connection request."
                );
            }

            await loadConnectionData();

            renderRecommendations();
            renderConnectionRequests();
            renderConnections();

            if (activeView === "saved") {
                renderSaved();
            }

            showToast(`Connection request sent to ${person.name}.`);

        } catch (error) {
            console.error("Connection request error:", error);
            showToast(error.message || "Could not send connection request.");
        }
    }

    // -----------------------------------------
    // REQUEST TABS
    // -----------------------------------------

    function switchRequestTab(tab) {

        $$(".request-tab").forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.requestTab === tab
            );
        });

        ["received", "sent", "accepted"].forEach(name => {

            const panel = document.getElementById(`${name}Requests`);

            if (panel) {
                panel.classList.toggle("hidden", name !== tab);
            }

        });
    }

    // -----------------------------------------
    // DASHBOARD NAVIGATION
    // -----------------------------------------

    function setView(view) {

        const viewAliases = {
            "skill-exchange": "skills",
            "skill_exchange": "skills",
            "skill-swap": "skills",
            "skill_swap": "skills",
            "skillexchange": "skills",
            "requests": "connections",
            "connection-requests": "connections",
            "connection_requests": "connections"
        };

        view = String(view || "overview").toLowerCase();
        view = viewAliases[view] || view;

        if (view === "projects") {
            window.location.href = "./Projects.html";
            return;
        }

        if (view === "skills") {
            window.location.href = "./SkillExchange.html";
            return;
        }

        if (view === "feedback") {
            window.location.href = "./Feedback.html";
            return;
        }

        const allowed = [
            "overview",
            "saved",
            "connections",
            "messages",
            "profile"
        ];

        if (!allowed.includes(view)) {
            view = "overview";
        }

        activeView = view;

        $$(".view-section").forEach(section => {
            section.classList.add("hidden");
        });

        const target = document.getElementById(`${view}View`);

        if (target) {
            target.classList.remove("hidden");
        }

        $$(".nav-item[data-view]").forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.view === view
            );
        });

        const labels = {
            overview: "Overview",
            saved: "Saved People",
            connections: "Connection Requests",
            messages: "Messages",
            profile: "My Profile"
        };

        setText("breadcrumbTitle", labels[view] || "Overview");

        $("#sidebar")?.classList.remove("open");

        if (view === "saved") {
            renderSaved();
        }

        if (view === "connections") {
            renderConnectionRequests();
        }

        if (view === "messages") {
            renderConnections();
        }

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }

    // -----------------------------------------
    // CREATE PROJECT
    // -----------------------------------------

    async function createProject(event) {

        event.preventDefault();

        const title = $("#projectTitle")?.value.trim();
        const category = $("#projectCategory")?.value;
        const description = $("#projectDescription")?.value.trim();

        if (!title || !category || !description) {
            showToast("Please complete all project fields.");
            return;
        }

        const submitButton = $("#projectForm")?.querySelector(
            '[type="submit"]'
        );

        if (submitButton) {
            submitButton.disabled = true;
        }

        try {

            const response = await fetch(PROJECTS_API, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({
                    title,
                    category,
                    description,
                    skills: knownSkills.slice(0, 3),
                    teamSize: 3
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Project creation failed."
                );
            }

            $("#projectForm")?.reset();
            $("#projectModal")?.classList.add("hidden");

            await loadProjects();

            showToast("Your project has been saved successfully!");

            setView("overview");

        } catch (error) {
            console.error("Project creation error:", error);
            showToast(error.message || "Could not create the project.");

        } finally {

            if (submitButton) {
                submitButton.disabled = false;
            }

        }
    }

    // -----------------------------------------
    // FEEDBACK FORM
    // -----------------------------------------

    function submitFeedback(event) {

        event.preventDefault();

        const form = $("#feedbackForm");
        if (!form) return;

        const rating = form.querySelector(
            'input[name="feedbackRating"]:checked'
        );

        const category = $("#feedbackCategory")?.value;
        const liked = $("#feedbackLiked")?.value.trim();
        const improve = $("#feedbackImprove")?.value.trim();
        const suggestions = $("#feedbackSuggestions")?.value.trim();

        if (!rating || !category) {
            showToast("Please select a rating and feedback category.");
            return;
        }

        if (!liked && !improve && !suggestions) {
            showToast("Please write at least one feedback comment.");
            return;
        }

        const feedback = {
            id: `feedback-${Date.now()}`,
            user: userName(),
            email: user.email || "",
            rating: Number(rating.value),
            category,
            liked,
            improve,
            suggestions,
            submittedAt: new Date().toISOString()
        };

        const allFeedback = readJSON("skillmateFeedback", []);

        if (!Array.isArray(allFeedback)) {
            showToast("Could not read the saved feedback.");
            return;
        }

        allFeedback.push(feedback);

        if (!saveJSON("skillmateFeedback", allFeedback)) {
            showToast("Feedback could not be saved. Please try again.");
            return;
        }

        form.reset();

        const success = $("#feedbackSuccess");
        success?.classList.remove("hidden");

        showToast("Thank you! Your feedback has been submitted.");

        success?.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
    }

    // -----------------------------------------
    // SIDEBAR NAVIGATION
    // -----------------------------------------

    $$(".nav-item[data-view]").forEach(button => {

        button.addEventListener("click", event => {
            event.preventDefault();
            setView(button.dataset.view);
        });

    });

    $$("[data-go]").forEach(button => {

        button.addEventListener("click", event => {

            event.preventDefault();

            const destination = button.dataset.go;

            if (destination === "discover") {
                window.location.href = "./Discover.html";
                return;
            }

            setView(destination);

        });

    });

    // -----------------------------------------
    // EDIT PROFILE
    // -----------------------------------------

    $("#editProfileBtn")?.addEventListener("click", () => {
        window.location.href = "./ProfileDetails.html?mode=edit";
    });

    $("#profileEditAction")?.addEventListener("click", () => {
        window.location.href = "./ProfileDetails.html?mode=edit";
    });

    $("#topProfileBtn")?.addEventListener("click", () => {
        setView("profile");
    });

    // -----------------------------------------
    // LOGOUT
    // -----------------------------------------

    $("#logoutBtn")?.addEventListener("click", async () => {

        const logoutButton = $("#logoutBtn");

        logoutButton.disabled = true;
        logoutButton.innerHTML = "<span>↪</span> Logging out...";

        try {

            const response = await fetch(
                `${USERS_API}/logout`,
                {
                    method: "POST",
                    credentials: "include"
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {

                alert(result.message || "Unable to logout. Please try again.");

                logoutButton.disabled = false;
                logoutButton.innerHTML = "<span>↪</span> Logout";

                return;
            }

            sessionStorage.removeItem("skillmateCurrentUser");

            window.location.replace("./StudentLogin.html");

        } catch (error) {

            console.error("Logout Error:", error);

            alert("Cannot connect to SkillMate server. Please try again.");

            logoutButton.disabled = false;
            logoutButton.innerHTML = "<span>↪</span> Logout";

        }

    });

    // -----------------------------------------
    // MOBILE SIDEBAR
    // -----------------------------------------

    $("#mobileMenu")?.addEventListener("click", () => {
        $("#sidebar")?.classList.toggle("open");
    });

    document.addEventListener("click", event => {

        const sidebar = $("#sidebar");
        const menuButton = $("#mobileMenu");

        if (
            window.innerWidth <= 850 &&
            sidebar?.classList.contains("open") &&
            !sidebar.contains(event.target) &&
            !menuButton?.contains(event.target)
        ) {
            sidebar.classList.remove("open");
        }

    });

    // -----------------------------------------
    // GLOBAL SEARCH
    // -----------------------------------------

    $("#globalSearch")?.addEventListener("keydown", event => {

        if (event.key === "Enter") {

            searchTerm = event.target.value.trim();

            if (searchTerm) {

                window.location.href =
                    "./Discover.html?search=" +
                    encodeURIComponent(searchTerm);

            }

        }

    });

    // -----------------------------------------
    // KEYBOARD SHORTCUTS
    // -----------------------------------------

    document.addEventListener("keydown", event => {

        if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "k"
        ) {
            event.preventDefault();
            $("#globalSearch")?.focus();
        }

        if (event.key === "Escape") {
            $("#projectModal")?.classList.add("hidden");
            $("#sidebar")?.classList.remove("open");
        }

    });

    // -----------------------------------------
    // NOTIFICATIONS
    // -----------------------------------------

    $("#notificationBtn")?.addEventListener("click", () => {

        const receivedCount = incomingRequests.length;
        const sentCount = sentRequests.length;

        if (receivedCount || sentCount) {

            showToast(
                `You have ${receivedCount} received and ${sentCount} sent request(s).`
            );

        } else {

            showToast(
                "You're all caught up! Discover teammates to start connecting."
            );

        }

    });

    // -----------------------------------------
    // DYNAMIC BUTTON ACTIONS
    // -----------------------------------------

    document.addEventListener("click", event => {

        const saveButton = event.target.closest("[data-save]");
        const connectButton = event.target.closest("[data-connect]");
        const projectButton = event.target.closest("[data-project]");
        const acceptButton = event.target.closest("[data-accept]");
        const declineButton = event.target.closest("[data-decline]");
        const requestTab = event.target.closest("[data-request-tab]");

        if (saveButton) {
            savePerson(saveButton.dataset.save);
        }

        if (connectButton && !connectButton.disabled) {
            connectPerson(connectButton.dataset.connect);
        }

        if (projectButton) {

            const project = projects.find(item =>
                item.id === projectButton.dataset.project
            );

            if (project) {
                showToast(
                    `Interested in "${project.title}"! Open Projects to send a join request.`
                );
            }

        }

        if (acceptButton) {
            acceptRequest(acceptButton.dataset.accept);
        }

        if (declineButton) {
            declineRequest(declineButton.dataset.decline);
        }

        if (requestTab) {
            switchRequestTab(requestTab.dataset.requestTab);
        }

    });

    // -----------------------------------------
    // CREATE PROJECT MODAL
    // -----------------------------------------

    $("#createProjectBtn")?.addEventListener("click", () => {
        $("#projectModal")?.classList.remove("hidden");
        $("#projectTitle")?.focus();
    });

    $("#closeProjectModal")?.addEventListener("click", () => {
        $("#projectModal")?.classList.add("hidden");
    });

    $("#projectModal")?.addEventListener("click", event => {

        if (event.target === $("#projectModal")) {
            $("#projectModal").classList.add("hidden");
        }

    });

    $("#projectForm")?.addEventListener("submit", createProject);

    // -----------------------------------------
    // FEEDBACK SUBMISSION
    // -----------------------------------------

    $("#feedbackForm")?.addEventListener("submit", submitFeedback);

    // -----------------------------------------
    // INITIAL DASHBOARD SETUP
    // -----------------------------------------

   await loadSavedPeople();

renderUser();

await loadStudents();
await loadConnectionData();

renderRecommendations();

await loadProjects();

renderSaved();
    renderConnections();
    renderConnectionRequests();

    switchRequestTab("received");

    // -----------------------------------------
    // OPEN VIEW FROM URL
    // -----------------------------------------

    const requestedView = new URLSearchParams(
        window.location.search
    ).get("view");

    setView(requestedView || "overview");

});