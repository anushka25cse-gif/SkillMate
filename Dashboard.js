document.addEventListener("DOMContentLoaded", function () {
    const $ = selector => document.querySelector(selector);
    const $$ = selector => [...document.querySelectorAll(selector)];

    // ------------------------------------------------------------------
    // Live data from the SkillMate API
    // ------------------------------------------------------------------
    const api = SkillMate.api;

    let user = SkillMate.getUser() || {};
    let knownSkills = [];
    let teachSkills = [];

    let people = [];               // other students, best match first
    let savedPeople = [];          // student ids in "saved people"
    let savedRecords = new Map();  // student id -> saved-people record id
    let connections = [];          // student ids with a pending request I sent
    let acceptedConnections = [];  // student ids I am connected with
    let incomingRequests = [];     // { id, personId, status } received
    let projects = [];

    function syncUserSkills() {
        knownSkills = Array.isArray(user.knownSkills) ? user.knownSkills : [];
        teachSkills = Array.isArray(user.teachSkills) ? user.teachSkills : [];
    }

    syncUserSkills();

    /** Turn an API profile into the shape the existing templates expect. */
    function mapProfile(profile, index) {
        const colours = ["", "color-two", "color-three"];

        return {
            id: profile.id,
            name: profile.name,
            initials: SkillMate.initials(profile.name),
            course: SkillMate.courseLabel(profile),
            college: profile.college || "SkillMate",
            bio: profile.bio || "This student has not added a bio yet.",
            skills: Array.isArray(profile.skills) ? profile.skills : [],
            teaches: Array.isArray(profile.teachSkills) ? profile.teachSkills : [],
            interests: Array.isArray(profile.interests) ? profile.interests : [],
            score: typeof profile.matchScore === "number" ? profile.matchScore : 50,
            color: colours[index % colours.length]
        };
    }

    /** Turn an API project into the shape the existing templates expect. */
    function mapProject(project) {
        return {
            id: project.id,
            title: project.title,
            category: project.category || "Other",
            description: project.description || "",
            emoji: project.emoji || "✦",
            skills: Array.isArray(project.requiredSkills)
                ? project.requiredSkills
                : [],
            members: (project.teamMembers || []).length || 1,
            status: project.status || "Open",
            isCreator: Boolean(project.isCreator)
        };
    }

    function applyConnections(payload) {
        incomingRequests = (payload.received || [])
            .filter(request => request.status === "pending")
            .map(request => ({
                id: request.id,
                personId: request.personId,
                status: request.status
            }));

        connections = (payload.sent || [])
            .filter(request => request.status === "pending")
            .map(request => request.personId);

        acceptedConnections = (payload.accepted || []).map(
            request => request.personId
        );
    }

    async function loadDashboardData() {
        const [me, profiles, connectionPayload, savedPayload, projectPayload] =
            await Promise.all([
                api.me(),
                api.listProfiles({ limit: 100 }),
                api.listConnections(),
                api.listSavedPeople(),
                api.listProjects()
            ]);

        user = SkillMate.adaptUser(me) || user;
        syncUserSkills();

        people = (profiles.profiles || []).map(mapProfile);

        applyConnections(connectionPayload);

        const saved = savedPayload.saved || [];

        savedPeople = saved.map(item => item.savedStudentId);
        savedRecords = new Map(
            saved.map(item => [item.savedStudentId, item.id])
        );

        projects = (projectPayload.projects || []).map(mapProject);
    }

    let activeView = "overview";
    let toastTimer;
    let searchTerm = "";

    // General helper functions

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

    function userEmail() {
        return user.email || "";
    }

    function getPerson(id) {
        return people.find(person => person.id === id);
    }

    // Profile completion

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

    // Display the logged-in student's information

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

    // Calculate the match score for a student

    function matchScore(person) {
        // Compatibility is calculated by the API (utils/matching.js) so every
        // page shows the same percentage for the same pair of students.
        return typeof person.score === "number" ? person.score : 50;
    }

    // Create a full student card

    function personCard(person) {
        const saved = savedPeople.includes(person.id);
        const connected = connections.includes(person.id);
        const accepted = acceptedConnections.includes(person.id);

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
                    title="${saved ? "Remove from saved people" : "Save teammate"}">✓</button>

                <div class="person-avatar ${escapeHTML(person.color)}">
                    ${escapeHTML(person.initials)}
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
                    <span class="match-badge">${matchScore(person)}% match</span>

                    <button class="connect-button"
                        data-connect="${escapeHTML(person.id)}"
                        ${connected || accepted ? "disabled" : ""}>
                        ${connectLabel}
                    </button>
                </div>
            </article>
        `;
    }

    // Create a smaller student card for the Dashboard

    function smallPerson(person) {
        const saved = savedPeople.includes(person.id);
        const connected = connections.includes(person.id);
        const accepted = acceptedConnections.includes(person.id);

        let connectLabel = "Connect";

        if (accepted) {
            connectLabel = "Connected ✓";
        } else if (connected) {
            connectLabel = "Requested";
        }

        return `
            <div class="recommendation-item">
                <div class="person-avatar ${escapeHTML(person.color)}">
                    ${escapeHTML(person.initials)}
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

                <span class="match-score">${matchScore(person)}%</span>

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

    function renderRecommendations() {
        const container = $("#overviewRecommendations");
        if (!container) return;

        const sorted = [...people].sort(
            (a, b) => matchScore(b) - matchScore(a)
        );

        container.innerHTML = sorted.slice(0, 3).map(smallPerson).join("");
    }

    // Saved People

    function renderSaved() {
        const grid = $("#savedGrid");
        const empty = $("#savedEmpty");

        if (!grid || !empty) return;

        const peopleSaved = people.filter(person =>
            savedPeople.includes(person.id)
        );

        grid.innerHTML = peopleSaved.map(personCard).join("");

        empty.classList.toggle("hidden", peopleSaved.length > 0);
    }

    async function savePerson(id) {
        const recordId = savedRecords.get(id);

        try {
            if (savedPeople.includes(id)) {
                if (recordId) {
                    await api.removeSavedPerson(recordId);
                }

                savedPeople = savedPeople.filter(item => item !== id);
                savedRecords.delete(id);
                showToast("Removed from your saved teammates.");
            } else {
                const result = await api.savePerson(id);

                savedPeople.push(id);

                if (result.saved) {
                    savedRecords.set(id, result.saved.id);
                }

                showToast("Teammate saved to your shortlist.");
            }
        } catch (error) {
            showToast(error.message || "Could not update your saved people.");
            return;
        }

        renderUser();
        renderRecommendations();

        if (activeView === "saved") {
            renderSaved();
        }
    }

    // Projects

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
                        .map(skill => `<span class="skill-chip">${escapeHTML(skill)}</span>`)
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
            overview.innerHTML = projects.slice(0, 3).map(projectCard).join("");
        }

        if (fullGrid) {
            fullGrid.innerHTML = projects.map(projectCard).join("");
        }
    }

    /** Ask to join a project from the Dashboard overview. */
    async function requestToJoinProject(project) {
        try {
            const result = await api.joinProject(project.id);

            projects = projects.map(item =>
                item.id === result.project.id ? mapProject(result.project) : item
            );

            renderProjects();

            showToast(
                `Your request to join "${project.title}" has been sent to the project creator.`
            );
        } catch (error) {
            showToast(error.message || "Could not send your join request.");
        }
    }

    // Connection Requests

    function getRequestsByStatus(status) {
        return incomingRequests.filter(request => request.status === status);
    }

    function renderRequestList(containerId, emptyId, requests, type) {
        const container = document.getElementById(containerId);
        const empty = document.getElementById(emptyId);

        if (!container || !empty) return;

        const validRequests = requests.map(request => {
            const person = getPerson(
                typeof request === "string" ? request : request.personId
            );

            return person ? { request, person } : null;
        }).filter(Boolean);

        empty.classList.toggle("hidden", validRequests.length > 0);

        container.innerHTML = validRequests.map(({ request, person }) => {
            const requestId = typeof request === "string"
                ? request
                : request.id;

            let buttons = "";
            let statusText = "";

            if (type === "received") {
                statusText = "Wants to connect with you";

                buttons = `
                    <button class="request-action accept-request"
                        data-accept="${escapeHTML(requestId)}">Accept</button>

                    <button class="request-action decline-request"
                        data-decline="${escapeHTML(requestId)}">Decline</button>
                `;
            } else if (type === "sent") {
                statusText = "Connection request sent";
            } else {
                statusText = "You are now connected";
            }

            return `
                <div class="connection-row">
                    <div class="person-avatar ${escapeHTML(person.color)}">
                        ${escapeHTML(person.initials)}
                    </div>

                    <div class="connection-person-info">
                        <strong>${escapeHTML(person.name)}</strong>
                        <p>${escapeHTML(person.course)}</p>
                        <small>${statusText}</small>
                    </div>

                    <div class="request-actions">${buttons}</div>
                </div>
            `;
        }).join("");
    }

    function renderConnectionRequests() {
        const received = getRequestsByStatus("pending");

        const sent = connections.filter(id =>
            !acceptedConnections.includes(id)
        );

        setText("receivedRequestCount", received.length, "0");
        setText("sentRequestCount", sent.length, "0");
        setText("acceptedRequestCount", acceptedConnections.length, "0");
        setText("requestCount", received.length + sent.length, "0");

        renderRequestList(
            "receivedRequestsList",
            "receivedRequestsEmpty",
            received,
            "received"
        );

        renderRequestList(
            "sentRequestsList",
            "sentRequestsEmpty",
            sent,
            "sent"
        );

        renderRequestList(
            "acceptedRequestsList",
            "acceptedRequestsEmpty",
            acceptedConnections,
            "accepted"
        );
    }

    async function acceptRequest(requestId) {
        const request = incomingRequests.find(item =>
            item.id === requestId && item.status === "pending"
        );

        if (!request) return;

        try {
            await api.acceptConnection(requestId);
        } catch (error) {
            showToast(error.message || "Could not accept this request.");
            return;
        }

        const personId = request.personId;

        incomingRequests = incomingRequests.filter(item => item.id !== requestId);

        if (!acceptedConnections.includes(personId)) {
            acceptedConnections.push(personId);
        }

        connections = connections.filter(id => id !== personId);

        renderConnectionRequests();
        renderRecommendations();
        renderSaved();
        renderConnections();

        showToast("Connection accepted! You are now connected.");
    }

    async function declineRequest(requestId) {
        const request = incomingRequests.find(item =>
            item.id === requestId && item.status === "pending"
        );

        if (!request) return;

        try {
            await api.rejectConnection(requestId);
        } catch (error) {
            showToast(error.message || "Could not decline this request.");
            return;
        }

        incomingRequests = incomingRequests.filter(item =>
            item.id !== requestId
        );

        renderConnectionRequests();

        showToast("Connection request declined.");
    }

    function renderConnections() {
        const container = $("#connectionList");
        if (!container) return;

        const pendingPeople = connections
            .filter(id => !acceptedConnections.includes(id))
            .map(getPerson)
            .filter(Boolean);

        const acceptedPeople = acceptedConnections
            .map(getPerson)
            .filter(Boolean);

        if (!pendingPeople.length && !acceptedPeople.length) {
            container.innerHTML = "";
            return;
        }

        container.innerHTML = `
            <h3 class="subheading">Your connection activity</h3>

            ${pendingPeople.map(person => `
                <div class="connection-row">
                    <div class="person-avatar ${escapeHTML(person.color)}">
                        ${escapeHTML(person.initials)}
                    </div>

                    <div>
                        <strong>${escapeHTML(person.name)}</strong>
                        <p>Connection request sent · Awaiting response</p>
                    </div>
                </div>
            `).join("")}

            ${acceptedPeople.map(person => `
                <div class="connection-row">
                    <div class="person-avatar ${escapeHTML(person.color)}">
                        ${escapeHTML(person.initials)}
                    </div>

                    <div>
                        <strong>${escapeHTML(person.name)}</strong>
                        <p>Connection accepted ✓</p>
                    </div>
                </div>
            `).join("")}
        `;
    }

    async function connectPerson(id) {
        const person = getPerson(id);
        if (!person) return;

        if (connections.includes(id) || acceptedConnections.includes(id)) {
            showToast(`You already have a connection request with ${person.name}.`);
            return;
        }

        try {
            await api.sendConnectionRequest(id);
        } catch (error) {
            showToast(error.message || "Could not send the connection request.");
            return;
        }

        connections.push(id);

        renderRecommendations();
        renderConnectionRequests();

        if (activeView === "saved") {
            renderSaved();
        }

        showToast(`Connection request sent to ${person.name}.`);
    }

    // Request tabs

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

    // Dashboard navigation

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

        // Open the separate Projects page

        if (view === "projects") {
            window.location.href = "./Projects.html";
            return;
        }

        // Open the separate Skill Exchange page

        if (view === "skills") {
            window.location.href = "./SkillExchange.html";
            return;
        }

        // Open the separate Feedback page

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

    // Create a project from the Dashboard

    async function createProject(event) {
        event.preventDefault();

        const title = $("#projectTitle")?.value.trim();
        const category = $("#projectCategory")?.value;
        const description = $("#projectDescription")?.value.trim();

        if (!title || !category || !description) {
            showToast("Please complete all project fields.");
            return;
        }

        const project = {
            title,
            category,
            description,
            emoji: "✦",
            requiredSkills: knownSkills.slice(0, 3),
            teamSize: 3,
            status: "New project idea"
        };

        try {
            const result = await api.createProject(project);

            projects.unshift(mapProject(result.project));
        } catch (error) {
            showToast(error.message || "Could not create the project.");
            return;
        }

        $("#projectForm")?.reset();
        $("#projectModal")?.classList.add("hidden");

        renderProjects();

        showToast("Your project idea has been added!");

        setView("overview");
    }

    // Feedback form

    async function submitFeedback(event) {
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

        try {
            await api.submitFeedback({
                rating: Number(rating.value),
                category,
                comments: [liked, improve, suggestions]
                    .filter(Boolean)
                    .join(" | ")
            });
        } catch (error) {
            showToast(
                error.message || "Feedback could not be saved. Please try again."
            );
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

    // Sidebar navigation

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

    $("#editProfileBtn")?.addEventListener("click", () => {
        window.location.href = "./CompleteProfile.html";
    });

    $("#profileEditAction")?.addEventListener("click", () => {
        window.location.href = "./CompleteProfile.html";
    });

    $("#topProfileBtn")?.addEventListener("click", () => {
        setView("profile");
    });

    $("#logoutBtn")?.addEventListener("click", async () => {
        const confirmed = confirm("Are you sure you want to log out?");

        if (confirmed) {
            await SkillMate.api.logout();

            window.location.href = "./Login.html";
        }
    });

    // Mobile sidebar

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

    // Global search

    $("#globalSearch")?.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            searchTerm = event.target.value.trim();

            if (searchTerm) {
                window.location.href =
                    "./Discover.html?search=" + encodeURIComponent(searchTerm);
            }
        }
    });

    // Keyboard shortcuts

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

    // Notifications

    $("#notificationBtn")?.addEventListener("click", () => {
        const receivedCount = getRequestsByStatus("pending").length;

        const sentCount = connections.filter(id =>
            !acceptedConnections.includes(id)
        ).length;

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

    // Actions for buttons created dynamically

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
            const project = projects.find(
                item => item.id === projectButton.dataset.project
            );

            if (project) {
                requestToJoinProject(project);
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

    // Create project modal

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

    // Feedback submission

    $("#feedbackForm")?.addEventListener("submit", submitFeedback);

    // Projects and requests are reloaded from the server, so cross-tab
    // localStorage events are no longer the source of truth.

    // Initial Dashboard setup: check the session, load live data, then render.

    async function initialiseDashboard() {
        if (!SkillMate.requireAuth()) return;

        try {
            await loadDashboardData();
        } catch (error) {
            console.error("Dashboard data could not be loaded:", error);
            showToast(
                error.status === 401
                    ? "Your session has expired. Please sign in again."
                    : (error.message || "Your dashboard data could not be loaded.")
            );

            if (error.status === 401) {
                SkillMate.clearSession();
                setTimeout(() => {
                    window.location.href = "./StudentLogin.html";
                }, 1500);
            }

            return;
        }

        renderUser();
        renderRecommendations();
        renderProjects();
        renderSaved();
        renderConnections();
        renderConnectionRequests();

        switchRequestTab("received");

        // Open the section passed in the URL.
        // Example: Dashboard.html?view=messages

        const requestedView = new URLSearchParams(window.location.search).get("view");

        setView(requestedView || "overview");
    }

    initialiseDashboard();
});