document.addEventListener("DOMContentLoaded", async () => {

    const $ = selector => document.querySelector(selector);
    const $$ = selector => [...document.querySelectorAll(selector)];

    const API_URL = "http://127.0.0.1:5000/api/projects";
    const USER_API_URL = "http://127.0.0.1:5000/api/users";

    let projects = [];
    let myProjects = [];
    let currentUser = null;
    let activeTab = "all";
    let toastTimer;

    // -----------------------------------------
    // CURRENT USER - FETCH FROM BACKEND
    // -----------------------------------------

    function getUserName() {
        return currentUser?.fullName || "SkillMate Student";
    }

    function getUserId() {
        return String(currentUser?._id || currentUser?.id || "");
    }

    async function loadCurrentUser() {

        const response = await fetch(`${USER_API_URL}/me`, {
            method: "GET",
            credentials: "include"
        });

        const result = await response.json();

        if (!response.ok || !result.success || !result.user) {
            throw new Error("Unable to identify the logged-in user.");
        }

        currentUser = result.user;

        // Update sessionStorage with the latest backend user
        sessionStorage.setItem(
            "skillmateCurrentUser",
            JSON.stringify(currentUser)
        );

        // Update topbar details
        if ($("#topUserName")) {
            $("#topUserName").textContent =
                getUserName().split(" ")[0];
        }

        if ($("#topAvatar")) {
            $("#topAvatar").textContent =
                getUserName().charAt(0).toUpperCase();
        }
    }

    // -----------------------------------------
    // SIDEBAR NAVIGATION
    // -----------------------------------------

    const dashboardDestinations = [
        { label: "overview", view: "overview" },
        { label: "skill exchange", view: "skills" },
        { label: "saved people", view: "saved" },
        { label: "connection requests", view: "connections" },
        { label: "messages", view: "messages" },
        { label: "my profile", view: "profile" },
        { label: "edit profile", view: "profile" },
        { label: "feedback", view: "feedback" }
    ];

    const sidebar = $("#sidebar");

    if (sidebar) {

        sidebar.querySelectorAll("a").forEach(link => {

            const href = link.getAttribute("href") || "";

            if (!/Dashboard\.html(?:$|[?#])/i.test(href)) return;

            const label = link.textContent
                .trim()
                .toLowerCase()
                .replace(/\s+/g, " ");

            const destination = dashboardDestinations.find(item =>
                label.includes(item.label)
            );

            if (destination) {
                link.href =
                    `./Dashboard.html?view=${encodeURIComponent(destination.view)}`;
            }
        });
    }

    // -----------------------------------------
    // GENERAL HELPERS
    // -----------------------------------------

    function escapeHTML(value) {

        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[character]);
    }

    function showToast(message) {

        const toast = $("#toast");

        if (!toast) return;

        toast.textContent = message;
        toast.classList.add("show");

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            toast.classList.remove("show");
        }, 2600);
    }

    function getProjectId(project) {
        return String(project._id || project.id || "");
    }

    function getCreatorId(project) {

        if (project.createdBy && typeof project.createdBy === "object") {
            return String(project.createdBy._id || project.createdBy.id || "");
        }

        return String(project.createdBy || "");
    }

    function getCreatorName(project) {

        if (project.createdBy && typeof project.createdBy === "object") {
            return project.createdBy.fullName || "SkillMate Student";
        }

        return project.createdBy || "SkillMate Student";
    }

    function getMemberCount(project) {

        return Array.isArray(project.members)
            ? project.members.length
            : Number(project.members) || 1;
    }

    // -----------------------------------------
    // CHECK TEAM MEMBERSHIP
    // -----------------------------------------

    function isTeamMember(project) {

        const userId = getUserId();

        if (!userId || !Array.isArray(project.members)) {
            return false;
        }

        return project.members.some(member => {

            const memberId =
                typeof member === "object"
                    ? member?._id || member?.id
                    : member;

            return String(memberId || "") === userId;
        });
    }

    // -----------------------------------------
    // CHECK PROJECT CREATOR
    // -----------------------------------------

    function isProjectCreator(project) {

        const userId = getUserId();
        const creatorId = getCreatorId(project);

        return Boolean(
            userId &&
            creatorId &&
            creatorId === userId
        );
    }

    // -----------------------------------------
    // LOAD PROJECTS FROM MONGODB
    // -----------------------------------------

    async function loadProjects() {

        try {

            const response = await fetch(API_URL, {
                method: "GET",
                credentials: "include"
            });

            const result = await response.json();

            if (!response.ok || !result.success) {

                if (response.status === 401) {
                    throw new Error("Your session has expired. Please log in again.");
                }

                throw new Error(result.message || "Unable to load projects.");
            }

            projects = Array.isArray(result.projects)
                ? result.projects
                : [];

            // Load projects where the current user is a member
            const myResponse = await fetch(`${API_URL}/mine`, {
                method: "GET",
                credentials: "include"
            });

            const myResult = await myResponse.json();

            if (!myResponse.ok || !myResult.success) {
                throw new Error(
                    myResult.message || "Unable to load your projects."
                );
            }

            myProjects = Array.isArray(myResult.projects)
                ? myResult.projects
                : [];

            refreshPage();

        } catch (error) {

            console.error("Load Projects Error:", error);

            showToast(error.message);

            projects = [];
            myProjects = [];

            refreshPage();

            if (error.message.includes("session has expired")) {

                setTimeout(() => {
                    window.location.href = "./StudentLogin.html";
                }, 1200);
            }
        }
    }

    // -----------------------------------------
    // PROJECT STATISTICS
    // -----------------------------------------

    function updateStats() {

        if ($("#totalProjects")) {
            $("#totalProjects").textContent = projects.length;
        }

        if ($("#openProjects")) {
            $("#openProjects").textContent =
                projects.filter(project => project.status === "Open").length;
        }

        if ($("#myProjectsCount")) {
            $("#myProjectsCount").textContent = myProjects.length;
        }
    }

    // -----------------------------------------
    // PROJECT CARDS
    // -----------------------------------------

    function createProjectCard(project) {

        const card = document.createElement("article");

        card.className = "project-card";

        const category = project.category || "Other";

        const skills = Array.isArray(project.skills)
            ? project.skills
            : [];

        const memberCount = getMemberCount(project);

        const teamSize = Number(project.teamSize) || 3;

        const status = project.status || "Open";

        const projectId = getProjectId(project);

        const currentUserId = getUserId();

        const alreadyInterested =
            Array.isArray(project.interestedUsers) &&
            project.interestedUsers.some(user => {

                const interestedUserId =
                    typeof user === "object"
                        ? user?._id || user?.id
                        : user;

                return String(interestedUserId || "") === currentUserId;
            });

        const isMember = isTeamMember(project);

        const isCreator = isProjectCreator(project);

        const skillHTML = skills.slice(0, 4).map(skill =>
            `<span class="skill-tag">${escapeHTML(skill)}</span>`
        ).join("");

        let buttonText = "Interested in this →";
        let buttonDisabled = false;

        if (isMember) {

            buttonText = "Team Member ✓";
            buttonDisabled = true;

        } else if (alreadyInterested) {

            buttonText = "Interest sent ✓";
            buttonDisabled = true;

        } else if (status === "Closed" || memberCount >= teamSize) {

            buttonText = "Team Full";
            buttonDisabled = true;
        }

        card.innerHTML = `

            <div class="card-top">

                <span class="category-label">
                    ${escapeHTML(category)}
                </span>

                <span class="status-label">
                    ${escapeHTML(status)}
                </span>

            </div>

            <h3>${escapeHTML(project.title || "Untitled Project")}</h3>

            <p class="project-description">
                ${escapeHTML(project.description || "No description added yet.")}
            </p>

            <div class="skill-list">
                ${skillHTML}
            </div>

            <div class="card-bottom">

                <div class="member-info">

                    <strong>
                        ${escapeHTML(getCreatorName(project))}
                    </strong>

                    ${memberCount} / ${teamSize} members

                </div>

                <button
                    class="interest-button ${alreadyInterested ? "interested" : ""}"
                    data-interest="${escapeHTML(projectId)}"
                    ${buttonDisabled ? "disabled" : ""}>

                    ${buttonText}

                </button>

            </div>

            ${isCreator ? `

                <button
                    class="manage-requests-button"
                    data-manage-requests="${escapeHTML(projectId)}"
                    style="
                        width: 100%;
                        margin-top: 12px;
                        padding: 11px;
                        border: none;
                        border-radius: 8px;
                        background: #713b64;
                        color: white;
                        cursor: pointer;
                        font-weight: 600;
                    ">

                    Manage Requests

                </button>

                <button
                    data-manage-team="${escapeHTML(projectId)}"
                    style="
                        width: 100%;
                        margin-top: 9px;
                        padding: 11px;
                        border: none;
                        border-radius: 8px;
                        background: #4d627f;
                        color: white;
                        cursor: pointer;
                        font-weight: 600;
                    ">

                    Manage Team

                </button>

            ` : ""}

            ${isMember && !isCreator ? `

                <button
                    data-leave-project="${escapeHTML(projectId)}"
                    style="
                        width: 100%;
                        margin-top: 12px;
                        padding: 11px;
                        border: none;
                        border-radius: 8px;
                        background: #c94a4a;
                        color: white;
                        cursor: pointer;
                        font-weight: 600;
                    ">

                    Leave Project

                </button>

            ` : ""}

        `;

        return card;
    }

    // -----------------------------------------
    // SEARCH AND FILTER
    // -----------------------------------------

    function renderProjects() {

        const grid = $("#projectGrid");

        if (!grid) return;

        const searchTerm =
            ($("#projectSearch")?.value || "").trim().toLowerCase();

        const category =
            $("#categoryFilter")?.value || "all";

        let filtered = activeTab === "mine"
            ? [...myProjects]
            : [...projects];

        if (category !== "all") {

            filtered = filtered.filter(project =>
                project.category === category
            );
        }

        if (searchTerm) {

            filtered = filtered.filter(project => {

                const searchableText = [
                    project.title,
                    project.category,
                    project.description,
                    ...(Array.isArray(project.skills) ? project.skills : [])
                ].join(" ").toLowerCase();

                return searchableText.includes(searchTerm);
            });
        }

        grid.innerHTML = "";

        if ($("#resultCount")) {

            $("#resultCount").textContent =
                `${filtered.length} ${filtered.length === 1 ? "project" : "projects"}`;
        }

        if (filtered.length === 0) {

            const message = activeTab === "mine"
                ? "You are not working on any projects yet. Explore projects and join a team!"
                : "No projects match your search. Try another keyword or category.";

            grid.innerHTML = `
                <div class="empty-state">
                    ${message}
                </div>
            `;

            return;
        }

        filtered.forEach(project => {
            grid.appendChild(createProjectCard(project));
        });
    }

    // -----------------------------------------
    // REFRESH PAGE
    // -----------------------------------------

    function refreshPage() {
        updateStats();
        renderProjects();
    }

    // -----------------------------------------
    // SEARCH EVENTS
    // -----------------------------------------

    $("#projectSearch")?.addEventListener("input", () => {

        if ($("#topSearch")) {
            $("#topSearch").value = $("#projectSearch").value;
        }

        renderProjects();
    });

    $("#categoryFilter")?.addEventListener("change", renderProjects);

    $("#topSearch")?.addEventListener("input", event => {

        if ($("#projectSearch")) {
            $("#projectSearch").value = event.target.value;
        }

        renderProjects();
    });

    // -----------------------------------------
    // PROJECT TABS
    // -----------------------------------------

    $$(".tab-button").forEach(button => {

        button.addEventListener("click", () => {

            $$(".tab-button").forEach(tab => {
                tab.classList.remove("active");
            });

            button.classList.add("active");

            activeTab = button.dataset.tab;

            renderProjects();
        });
    });

    // -----------------------------------------
    // PROJECT INTEREST
    // -----------------------------------------

    $("#projectGrid")?.addEventListener("click", async event => {

        const button = event.target.closest("[data-interest]");

        if (!button) return;

        const projectId = button.dataset.interest;

        button.disabled = true;
        button.textContent = "Sending...";

        try {

            const response = await fetch(
                `${API_URL}/${encodeURIComponent(projectId)}/interest`,
                {
                    method: "POST",
                    credentials: "include"
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to send interest.");
            }

            showToast(result.message);

            await loadProjects();

        } catch (error) {

            console.error("Project Interest Error:", error);

            showToast(error.message);

            button.disabled = false;
            button.textContent = "Interested in this →";
        }
    });

    // -----------------------------------------
    // REQUESTS MODAL
    // -----------------------------------------

    function createRequestsModal() {

        if ($("#requestsModal")) return;

        const modalElement = document.createElement("div");

        modalElement.id = "requestsModal";

        modalElement.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(20, 15, 25, 0.65);
            display: none;
            align-items: center;
            justify-content: center;
            padding: 20px;
            z-index: 9999;
        `;

        modalElement.innerHTML = `

            <div style="
                background: white;
                width: 100%;
                max-width: 550px;
                max-height: 80vh;
                overflow-y: auto;
                border-radius: 14px;
                padding: 24px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            ">

                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 20px;
                ">

                    <h2 id="requestsModalTitle" style="margin: 0;">
                        Join Requests
                    </h2>

                    <button
                        id="closeRequestsModal"
                        style="
                            border: none;
                            background: none;
                            font-size: 25px;
                            cursor: pointer;
                        ">

                        &times;

                    </button>

                </div>

                <div id="requestsList">
                    Loading requests...
                </div>

            </div>
        `;

        document.body.appendChild(modalElement);

        $("#closeRequestsModal").addEventListener("click", () => {
            modalElement.style.display = "none";
        });

        modalElement.addEventListener("click", event => {

            if (event.target === modalElement) {
                modalElement.style.display = "none";
            }
        });
    }

    // -----------------------------------------
    // LOAD JOIN REQUESTS
    // -----------------------------------------

    async function openRequests(projectId) {

        createRequestsModal();

        const modalElement = $("#requestsModal");
        const requestsList = $("#requestsList");

        modalElement.style.display = "flex";

        requestsList.innerHTML = "Loading requests...";

        try {

            const response = await fetch(
                `${API_URL}/${encodeURIComponent(projectId)}/requests`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to load requests.");
            }

            const requests = Array.isArray(result.requests)
                ? result.requests
                : [];

            if (requests.length === 0) {

                requestsList.innerHTML = `
                    <p style="text-align:center; padding:25px;">
                        No students have requested to join this project yet.
                    </p>
                `;

                return;
            }

            requestsList.innerHTML = requests.map(user => {

                const userId = user._id || user.id;

                const skills = Array.isArray(user.knownSkills)
                    ? user.knownSkills
                    : [];

                return `

                    <div style="
                        border: 1px solid #e8e1e8;
                        border-radius: 10px;
                        padding: 16px;
                        margin-bottom: 12px;
                    ">

                        <h3 style="margin: 0 0 6px;">
                            ${escapeHTML(user.fullName || "Student")}
                        </h3>

                        <p style="margin: 4px 0;">
                            ${escapeHTML(user.email || "")}
                        </p>

                        <p style="margin: 4px 0;">
                            ${escapeHTML(user.course || "")}
                        </p>

                        <p style="margin: 8px 0;">
                            <strong>Skills:</strong>

                            ${skills.length
                                ? skills.map(skill => escapeHTML(skill)).join(", ")
                                : "Not provided"}

                        </p>

                        <div style="
                            display: flex;
                            gap: 10px;
                            margin-top: 14px;
                        ">

                            <button
                                data-accept="${escapeHTML(userId)}"
                                data-project="${escapeHTML(projectId)}"
                                style="
                                    flex: 1;
                                    padding: 10px;
                                    border: none;
                                    border-radius: 7px;
                                    background: #26834a;
                                    color: white;
                                    cursor: pointer;
                                ">

                                Accept

                            </button>

                            <button
                                data-reject="${escapeHTML(userId)}"
                                data-project="${escapeHTML(projectId)}"
                                style="
                                    flex: 1;
                                    padding: 10px;
                                    border: none;
                                    border-radius: 7px;
                                    background: #c94a4a;
                                    color: white;
                                    cursor: pointer;
                                ">

                                Reject

                            </button>

                        </div>

                    </div>

                `;

            }).join("");

        } catch (error) {

            console.error("Load Requests Error:", error);

            requestsList.innerHTML = `
                <p style="color: #c94a4a;">
                    ${escapeHTML(error.message)}
                </p>
            `;
        }
    }

    // -----------------------------------------
    // MANAGE REQUESTS BUTTON
    // -----------------------------------------

    $("#projectGrid")?.addEventListener("click", event => {

        const button = event.target.closest("[data-manage-requests]");

        if (!button) return;

        openRequests(button.dataset.manageRequests);
    });

    // -----------------------------------------
    // ACCEPT / REJECT REQUESTS
    // -----------------------------------------

    document.addEventListener("click", async event => {

        const acceptButton = event.target.closest("[data-accept]");
        const rejectButton = event.target.closest("[data-reject]");

        if (!acceptButton && !rejectButton) return;

        const button = acceptButton || rejectButton;

        const projectId = button.dataset.project;

        const userId = acceptButton
            ? acceptButton.dataset.accept
            : rejectButton.dataset.reject;

        const action = acceptButton ? "accept" : "reject";

        button.disabled = true;
        button.textContent = "Processing...";

        try {

            const response = await fetch(
                `${API_URL}/${encodeURIComponent(projectId)}/requests/${encodeURIComponent(userId)}/${action}`,
                {
                    method: "POST",
                    credentials: "include"
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || `Unable to ${action} request.`
                );
            }

            showToast(
                result.message || `Request ${action}ed successfully!`
            );

            await openRequests(projectId);

            await loadProjects();

        } catch (error) {

            console.error(`${action} Request Error:`, error);

            showToast(error.message);

            button.disabled = false;
            button.textContent = action === "accept" ? "Accept" : "Reject";
        }
    });

    // -----------------------------------------
    // MANAGE TEAM MODAL
    // -----------------------------------------

    function createTeamModal() {

        if ($("#teamModal")) return;

        const modalElement = document.createElement("div");

        modalElement.id = "teamModal";

        modalElement.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(20, 15, 25, 0.65);
            display: none;
            align-items: center;
            justify-content: center;
            padding: 20px;
            z-index: 10000;
        `;

        modalElement.innerHTML = `

            <div style="
                background: white;
                width: 100%;
                max-width: 550px;
                max-height: 80vh;
                overflow-y: auto;
                border-radius: 14px;
                padding: 24px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            ">

                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 20px;
                ">

                    <h2 id="teamModalTitle" style="margin: 0;">
                        Manage Team
                    </h2>

                    <button
                        id="closeTeamModal"
                        style="
                            border: none;
                            background: none;
                            font-size: 25px;
                            cursor: pointer;
                        ">

                        &times;

                    </button>

                </div>

                <div id="teamList">
                    Loading team members...
                </div>

            </div>
        `;

        document.body.appendChild(modalElement);

        $("#closeTeamModal").addEventListener("click", () => {
            modalElement.style.display = "none";
        });

        modalElement.addEventListener("click", event => {

            if (event.target === modalElement) {
                modalElement.style.display = "none";
            }
        });
    }

    // -----------------------------------------
    // OPEN MANAGE TEAM
    // -----------------------------------------

    async function openTeam(projectId) {

        createTeamModal();

        const modalElement = $("#teamModal");
        const teamList = $("#teamList");

        modalElement.style.display = "flex";

        teamList.innerHTML = "Loading team members...";

        try {

            const project = projects.find(item =>
                getProjectId(item) === String(projectId)
            );

            if (!project) {
                throw new Error("Project not found.");
            }

            if (!isProjectCreator(project)) {
                throw new Error("Only the team leader can manage members.");
            }

            const members = Array.isArray(project.members)
                ? project.members
                : [];

            if (members.length === 0) {

                teamList.innerHTML = `
                    <p style="text-align:center; padding:25px;">
                        No team members found.
                    </p>
                `;

                return;
            }

            teamList.innerHTML = members.map(member => {

                const memberId =
                    typeof member === "object"
                        ? member?._id || member?.id
                        : member;

                const memberName =
                    typeof member === "object"
                        ? member.fullName || "Student"
                        : "Student";

                const memberEmail =
                    typeof member === "object"
                        ? member.email || ""
                        : "";

                const isLeader =
                    String(memberId) === getCreatorId(project);

                return `

                    <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 12px;
                        border: 1px solid #e8e1e8;
                        border-radius: 10px;
                        padding: 14px;
                        margin-bottom: 12px;
                    ">

                        <div style="min-width: 0;">

                            <h3 style="margin: 0 0 5px;">
                                ${escapeHTML(memberName)}
                            </h3>

                            <p style="
                                margin: 0;
                                color: #777;
                                overflow-wrap: anywhere;
                            ">
                                ${escapeHTML(memberEmail)}
                            </p>

                            ${isLeader ? `

                                <span style="
                                    display: inline-block;
                                    margin-top: 7px;
                                    color: #713b64;
                                    font-size: 13px;
                                    font-weight: 600;
                                ">

                                    Team Leader

                                </span>

                            ` : ""}

                        </div>

                        ${!isLeader ? `

                            <button
                                data-remove-member="${escapeHTML(memberId)}"
                                data-project="${escapeHTML(projectId)}"
                                style="
                                    padding: 9px 13px;
                                    border: none;
                                    border-radius: 7px;
                                    background: #c94a4a;
                                    color: white;
                                    cursor: pointer;
                                    font-weight: 600;
                                    flex-shrink: 0;
                                ">

                                Remove

                            </button>

                        ` : ""}

                    </div>

                `;

            }).join("");

        } catch (error) {

            console.error("Manage Team Error:", error);

            teamList.innerHTML = `
                <p style="color: #c94a4a;">
                    ${escapeHTML(error.message)}
                </p>
            `;
        }
    }

    // -----------------------------------------
    // MANAGE TEAM BUTTON
    // -----------------------------------------

    $("#projectGrid")?.addEventListener("click", event => {

        const button = event.target.closest("[data-manage-team]");

        if (!button) return;

        openTeam(button.dataset.manageTeam);
    });

    // -----------------------------------------
    // REMOVE TEAM MEMBER
    // -----------------------------------------

    document.addEventListener("click", async event => {

        const button = event.target.closest("[data-remove-member]");

        if (!button) return;

        const projectId = button.dataset.project;
        const memberId = button.dataset.removeMember;

        const confirmed = confirm(
            "Are you sure you want to remove this student from your project team?"
        );

        if (!confirmed) return;

        button.disabled = true;
        button.textContent = "Removing...";

        try {

            const response = await fetch(
                `${API_URL}/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}`,
                {
                    method: "DELETE",
                    credentials: "include"
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Unable to remove team member."
                );
            }

            showToast(
                result.message || "Team member removed successfully."
            );

            await loadProjects();

            await openTeam(projectId);

        } catch (error) {

            console.error("Remove Team Member Error:", error);

            showToast(error.message);

            button.disabled = false;
            button.textContent = "Remove";
        }
    });

    // -----------------------------------------
    // LEAVE PROJECT
    // -----------------------------------------

    $("#projectGrid")?.addEventListener("click", async event => {

        const button = event.target.closest("[data-leave-project]");

        if (!button) return;

        const projectId = button.dataset.leaveProject;

        const confirmed = confirm(
            "Are you sure you want to leave this project? You will no longer be a team member."
        );

        if (!confirmed) return;

        button.disabled = true;
        button.textContent = "Leaving...";

        try {

            const response = await fetch(
                `${API_URL}/${encodeURIComponent(projectId)}/leave`,
                {
                    method: "DELETE",
                    credentials: "include"
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Unable to leave project."
                );
            }

            showToast(
                result.message || "You have left the project."
            );

            await loadProjects();

        } catch (error) {

            console.error("Leave Project Error:", error);

            showToast(error.message);

            button.disabled = false;
            button.textContent = "Leave Project";
        }
    });

    // -----------------------------------------
    // CREATE PROJECT MODAL
    // -----------------------------------------

    const modal = $("#projectModal");

    $("#openCreateModal")?.addEventListener("click", () => {

        modal?.classList.remove("hidden");

        $("#projectTitle")?.focus();
    });

    $("#closeCreateModal")?.addEventListener("click", () => {
        modal?.classList.add("hidden");
    });

    modal?.addEventListener("click", event => {

        if (event.target === modal) {
            modal.classList.add("hidden");
        }
    });

    // -----------------------------------------
    // CREATE NEW PROJECT IN MONGODB
    // -----------------------------------------

    $("#projectForm")?.addEventListener("submit", async event => {

        event.preventDefault();

        const title = $("#projectTitle").value.trim();

        const category = $("#projectCategory").value;

        const description =
            $("#projectDescription").value.trim();

        const skills = $("#projectSkills").value
            .split(",")
            .map(skill => skill.trim())
            .filter(Boolean)
            .slice(0, 6);

        const teamSize = Number($("#projectMembers").value);

        if (!title || !category || !description) {
            showToast("Please complete all required fields.");
            return;
        }

        if (!Number.isInteger(teamSize) || teamSize < 1) {
            showToast("Please enter a valid team size.");
            return;
        }

        const submitButton =
            $("#projectForm").querySelector('[type="submit"]');

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Creating...";
        }

        try {

            const response = await fetch(API_URL, {

                method: "POST",

                credentials: "include",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    title,
                    category,
                    description,
                    skills,
                    teamSize
                })

            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Unable to create project."
                );
            }

            $("#projectForm").reset();

            modal?.classList.add("hidden");

            activeTab = "all";

            $$(".tab-button").forEach(tab => {
                tab.classList.toggle(
                    "active",
                    tab.dataset.tab === "all"
                );
            });

            if ($("#projectSearch")) {
                $("#projectSearch").value = "";
            }

            if ($("#topSearch")) {
                $("#topSearch").value = "";
            }

            if ($("#categoryFilter")) {
                $("#categoryFilter").value = "all";
            }

            await loadProjects();

            showToast("Your project has been created successfully!");

        } catch (error) {

            console.error("Create Project Error:", error);

            showToast(error.message);

        } finally {

            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Create Project";
            }
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
    // NOTIFICATIONS
    // -----------------------------------------

    $("#notificationBtn")?.addEventListener("click", () => {
        showToast("You're all caught up!");
    });

    // -----------------------------------------
    // INITIAL PAGE LOAD
    // -----------------------------------------

    createRequestsModal();
    createTeamModal();

    try {

        // First identify the actual logged-in student
        await loadCurrentUser();

        // Then load projects using that student's ID
        await loadProjects();

    } catch (error) {

        console.error("User Loading Error:", error);

        showToast("Please log in again.");

        setTimeout(() => {
            window.location.href = "./StudentLogin.html";
        }, 1200);
    }

});