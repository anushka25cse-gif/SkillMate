document.addEventListener("DOMContentLoaded", () => {

    const $ = selector => document.querySelector(selector);
    const $$ = selector => [...document.querySelectorAll(selector)];

    // SkillMate API client (api.js) provides every server call.
    const api = SkillMate.api;

    // ---------------------------------------------------------
    // STUDENT + LIVE PROJECT DATA (from the SkillMate API)
    // ---------------------------------------------------------

    const user = SkillMate.getUser() || {};

    function getUserName() {
        return user.fullName || user.name || user.username || "SkillMate Student";
    }

    function getUserEmail() {
        return user.email || "";
    }

    let projects = [];
    let interests = [];   // project ids I already asked to join
    let editingProjectId = null;
    let activeTab = "all";
    let toastTimer;

    /** API project -> the card shape this page already renders. */
    function mapProject(project) {
        const members = Array.isArray(project.teamMembers)
            ? project.teamMembers.length
            : 1;

        return {
            id: project.id,
            title: project.title,
            category: project.category || "Other",
            emoji: project.emoji || "✦",
            description: project.description || "",
            skills: Array.isArray(project.requiredSkills)
                ? project.requiredSkills
                : [],
            members: members || 1,
            teamSize: project.teamSize || Math.max(members, 3),
            status: project.status || "Open",
            createdBy: project.creator ? project.creator.name : "SkillMate Student",
            isCreator: Boolean(project.isCreator),
            isMember: Boolean(project.isMember),
            hasPendingRequest: Boolean(project.hasPendingRequest),
            joinRequests: Array.isArray(project.joinRequests)
                ? project.joinRequests
                : []
        };
    }

    /** Projects I created, joined or asked to join. */
    function refreshInterests() {
        interests = projects
            .filter(project => project.isCreator || project.isMember || project.hasPendingRequest)
            .map(project => project.id);
    }

    // Initialize: session check, then live data, then render.
    async function initialize() {
        if (!SkillMate.requireAuth()) return;

        try {
            const payload = await api.listProjects({ sort: "recent" });

            projects = (payload.projects || []).map(mapProject);
            refreshInterests();
        } catch (error) {
            console.error("Projects could not be loaded:", error);

            if (error.status === 401) {
                SkillMate.clearSession();
                window.location.href = "./StudentLogin.html";
                return;
            }

            showToast(error.message || "Projects could not be loaded.");
        }

        refreshPage();
    }

    // -----------------------------------------
    // USER DETAILS
    // -----------------------------------------

    const topUserName = $("#topUserName");
    const topAvatar = $("#topAvatar");

    if (topUserName) {
        topUserName.textContent = getUserName().split(" ")[0];
    }

    if (topAvatar) {
        topAvatar.textContent = getUserName().charAt(0).toUpperCase();
    }

    // -----------------------------------------
    // PROJECTS PAGE SIDEBAR NAVIGATION FIX
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

            // Only update links that lead to Dashboard.html.
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
        // Escape everything that could be interpreted as markup. Project
        // titles, descriptions and skill names are student-controlled text.
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
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

    function getMyProjects() {
        // The API tells us whether the logged-in student created the project.
        return projects.filter(project => project.isCreator);
    }

    // -----------------------------------------
    // STATISTICS
    // -----------------------------------------

    function updateStats() {
        $("#totalProjects").textContent = projects.length;

        $("#openProjects").textContent = projects.filter(project =>
            !project.status ||
            [
                "open",
                "new project idea",
                "looking for teammates",
                "idea stage"
            ].includes(String(project.status).toLowerCase())
        ).length;

        $("#myProjectsCount").textContent = getMyProjects().length;
    }

    // -----------------------------------------
    // PROJECT CARDS
    // -----------------------------------------

    function createProjectCard(project) {
        const card = document.createElement("article");
        card.className = "project-card";

        const category = project.category || "Other";
        const skills = Array.isArray(project.skills) ? project.skills : [];
        const memberCount = Number(project.members) || 1;
        const teamSize = Number(project.teamSize) || memberCount || 3;
        const status = project.status || "Open";
        const alreadyInterested = interests.includes(project.id);

        const skillHTML = skills.slice(0, 4).map(skill =>
            `<span class="skill-tag">${escapeHTML(skill)}</span>`
        ).join("");

        card.innerHTML = `
            <div class="card-top">
                <span class="category-label">${escapeHTML(category)}</span>
                <span class="status-label">${escapeHTML(status)}</span>
            </div>

            <h3>${escapeHTML(project.title || "Untitled Project")}</h3>

            <p class="project-description">
                ${escapeHTML(project.description || "No description has been added yet.")}
            </p>

            <div class="skill-list">${skillHTML}</div>

            <div class="card-bottom">
                <div class="member-info">
                    <strong>${escapeHTML(project.createdBy || "SkillMate Student")}</strong>
                    ${memberCount} / ${teamSize} members
                </div>

                ${project.isCreator ? `
                <div class="creator-actions" style="display:flex;gap:8px;">
                    <button class="outline-button" data-edit="${escapeHTML(project.id)}"
                        type="button">Edit</button>
                    <button class="outline-button" data-delete="${escapeHTML(project.id)}"
                        type="button">Delete</button>
                </div>
                ` : `
                <button
                    class="interest-button ${alreadyInterested ? "interested" : ""}"
                    data-interest="${escapeHTML(project.id)}"
                    ${alreadyInterested ? "disabled" : ""}>
                    ${alreadyInterested ? "Interest sent ✓" : "Interested in this →"}
                </button>
                `}
            </div>
        `;

        return card;
    }

    // -----------------------------------------
    // SEARCH AND FILTER
    // -----------------------------------------

    function renderProjects() {
        const grid = $("#projectGrid");

        const searchTerm = $("#projectSearch").value.trim().toLowerCase();
        const category = $("#categoryFilter").value;

        let filtered = [...projects];

        if (activeTab === "mine") {
            filtered = getMyProjects();
        }

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

        $("#resultCount").textContent =
            `${filtered.length} ${filtered.length === 1 ? "project" : "projects"}`;

        if (filtered.length === 0) {
            const message = activeTab === "mine"
                ? "You haven't created any projects yet. Start by creating your first project!"
                : "No projects match your search. Try another keyword or category.";

            grid.innerHTML = `<div class="empty-state">${message}</div>`;
            return;
        }

        filtered.forEach(project => {
            grid.appendChild(createProjectCard(project));
        });
    }

    function refreshPage() {
        updateStats();
        renderProjects();
    }

    // -----------------------------------------
    // SEARCH EVENTS
    // -----------------------------------------

    $("#projectSearch").addEventListener("input", () => {
        $("#topSearch").value = $("#projectSearch").value;
        renderProjects();
    });

    $("#categoryFilter").addEventListener("change", renderProjects);

    $("#topSearch").addEventListener("input", event => {
        $("#projectSearch").value = event.target.value;
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
    // PROJECT INTEREST (ask to join a team)
    // -----------------------------------------

    $("#projectGrid").addEventListener("click", async event => {
        const button = event.target.closest("[data-interest]");
        if (!button) return;

        const projectId = button.dataset.interest;

        if (interests.includes(projectId)) return;

        button.disabled = true;

        try {
            const result = await api.joinProject(projectId);

            const index = projects.findIndex(project => project.id === projectId);

            if (index !== -1) {
                projects[index] = mapProject(result.project);
            }

            refreshInterests();

            button.textContent = "Interest sent ✓";
            button.classList.add("interested");

            showToast("Your request to join has been sent to the project creator.");
        } catch (error) {
            button.disabled = false;
            showToast(error.message || "Could not send your interest.");
        }
    });

    // -----------------------------------------
    // CREATE PROJECT MODAL
    // -----------------------------------------

    const modal = $("#projectModal");

    $("#openCreateModal").addEventListener("click", () => {
        editingProjectId = null;
        $("#projectForm").reset();
        modal.classList.remove("hidden");
        $("#projectTitle").focus();
    });

    $("#closeCreateModal").addEventListener("click", () => {
        editingProjectId = null;
        modal.classList.add("hidden");
    });

    modal.addEventListener("click", event => {
        if (event.target === modal) {
            editingProjectId = null;
            modal.classList.add("hidden");
        }
    });

    // -----------------------------------------
    // CREATE OR EDIT A PROJECT
    // -----------------------------------------

    $("#projectForm").addEventListener("submit", async event => {
        event.preventDefault();

        const title = $("#projectTitle").value.trim();
        const category = $("#projectCategory").value;
        const description = $("#projectDescription").value.trim();

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

        const payload = {
            title,
            category,
            description,
            requiredSkills: skills,
            teamSize: Number.isFinite(teamSize) && teamSize > 0 ? teamSize : 3
        };

        try {
            if (editingProjectId) {
                const result = await api.updateProject(editingProjectId, payload);

                projects = projects.map(project =>
                    project.id === editingProjectId
                        ? mapProject(result.project)
                        : project
                );

                showToast("Your project has been updated successfully!");
            } else {
                const result = await api.createProject({
                    ...payload,
                    emoji: "✦",
                    status: "Open"
                });

                projects.unshift(mapProject(result.project));

                showToast("Your project has been created successfully!");
            }
        } catch (error) {
            showToast(error.message || "The project could not be saved.");
            return;
        }

        editingProjectId = null;
        modal.classList.add("hidden");
        $("#projectForm").reset();
        activeTab = "all";

        $$(".tab-button").forEach(tab => {
            tab.classList.toggle("active", tab.dataset.tab === "all");
        });

        $("#projectSearch").value = "";
        $("#topSearch").value = "";
        $("#categoryFilter").value = "all";

        refreshInterests();
        refreshPage();
    });

    // -----------------------------------------
    // MOBILE SIDEBAR
    // -----------------------------------------

    $("#mobileMenu").addEventListener("click", () => {
        $("#sidebar").classList.toggle("open");
    });

    document.addEventListener("click", event => {
        const sidebar = $("#sidebar");
        const menuButton = $("#mobileMenu");

        if (
            window.innerWidth <= 850 &&
            sidebar.classList.contains("open") &&
            !sidebar.contains(event.target) &&
            !menuButton.contains(event.target)
        ) {
            sidebar.classList.remove("open");
        }
    });

    // -----------------------------------------
    // LOGOUT
    // -----------------------------------------

    $("#logoutBtn").addEventListener("click", async () => {
        const confirmed = confirm("Are you sure you want to log out?");

        if (confirmed) {
            await SkillMate.api.logout();

            window.location.href = "./Login.html";
        }
    });

    // -----------------------------------------
    // NOTIFICATIONS
    // -----------------------------------------

    $("#notificationBtn").addEventListener("click", () => {
        showToast("You're all caught up!");
    });

    // -----------------------------------------
    // EDIT / DELETE A PROJECT YOU CREATED
    // -----------------------------------------

    $("#projectGrid").addEventListener("click", event => {
        const editButton = event.target.closest("[data-edit]");
        const deleteButton = event.target.closest("[data-delete]");

        if (editButton) {
            const project = projects.find(
                item => item.id === editButton.dataset.edit
            );

            if (!project) return;

            editingProjectId = project.id;

            $("#projectTitle").value = project.title || "";
            $("#projectCategory").value = project.category || "";
            $("#projectDescription").value = project.description || "";
            $("#projectSkills").value = (project.skills || []).join(", ");
            $("#projectMembers").value = project.teamSize || 3;

            modal.classList.remove("hidden");
            $("#projectTitle").focus();

            showToast(`Editing "${project.title}".`);
            return;
        }

        if (deleteButton) {
            const projectId = deleteButton.dataset.delete;
            const project = projects.find(item => item.id === projectId);

            if (!project) return;

            const confirmed = confirm(
                `Delete "${project.title}"? This cannot be undone.`
            );

            if (!confirmed) return;

            api.deleteProject(projectId)
                .then(() => {
                    projects = projects.filter(item => item.id !== projectId);
                    refreshInterests();
                    refreshPage();
                    showToast("Project deleted.");
                })
                .catch(error => {
                    showToast(error.message || "The project could not be deleted.");
                });
        }
    });

    // -----------------------------------------
    // INITIAL PAGE LOAD
    // -----------------------------------------

    initialize();

});