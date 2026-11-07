document.addEventListener("DOMContentLoaded", () => {

    const $ = selector => document.querySelector(selector);
    const $$ = selector => [...document.querySelectorAll(selector)];

    const PROJECTS_KEY = "skillmateProjects";
    const INTERESTS_KEY = "skillmateProjectInterests";

    // -----------------------------------------
    // STORAGE HELPERS
    // -----------------------------------------

    function readJSON(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key));
            return value ?? fallback;
        } catch {
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

    function readSessionJSON(key, fallback) {
        try {
            const value = JSON.parse(sessionStorage.getItem(key));
            return value ?? fallback;
        } catch {
            return fallback;
        }
    }

    // Read the same logged-in user used by Dashboard.js.
    const currentUser =
        readSessionJSON("skillmateCurrentUser", null) ||
        readJSON("skillmateCurrentUser", null);

    const signupDraft =
        readSessionJSON("skillmateSignupDraft", {}) ||
        readJSON("skillmateSignupDraft", {});

    const user = {
        ...signupDraft,
        ...(currentUser || {})
    };

    function getUserName() {
        return user.fullName || user.name || user.username || "SkillMate Student";
    }

    function getUserEmail() {
        return user.email || "";
    }

    // -----------------------------------------
    // DEMO PROJECTS
    // -----------------------------------------

    const demoProjects = [
        {
            id: "d1",
            title: "Campus Connect",
            category: "Web Development",
            emoji: "✦",
            description: "A student platform to discover campus events, clubs and people with shared interests.",
            skills: ["HTML & CSS", "JavaScript", "UI/UX Design"],
            members: 3,
            status: "Open"
        },
        {
            id: "d2",
            title: "Smart Study Buddy",
            category: "AI & Machine Learning",
            emoji: "✳",
            description: "An idea for a study companion that helps students organise learning and revision.",
            skills: ["Python", "Machine Learning", "UI/UX Design"],
            members: 3,
            status: "Open"
        },
        {
            id: "d3",
            title: "Green Campus Initiative",
            category: "Social Impact",
            emoji: "✳",
            description: "Explore creative ways to make campus life more sustainable and community-driven.",
            skills: ["Research", "Graphic Design", "Web Development"],
            members: 4,
            status: "Open"
        }
    ];

    // Load the projects saved by Dashboard.js.
    let projects = readJSON(PROJECTS_KEY, null);

    if (!Array.isArray(projects)) {
        projects = demoProjects;
        saveJSON(PROJECTS_KEY, projects);
    }

    let interests = readJSON(INTERESTS_KEY, []);
    if (!Array.isArray(interests)) interests = [];

    let activeTab = "all";
    let toastTimer;

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

    // Each Dashboard link on Projects.html is assigned
    // the exact Dashboard section it should open.

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

    function saveProjects() {
        return saveJSON(PROJECTS_KEY, projects);
    }

    function getMyProjects() {
        const email = getUserEmail().toLowerCase();
        const name = getUserName().toLowerCase();

        return projects.filter(project => {
            const creatorEmail = (project.createdByEmail || "").toLowerCase();
            const creatorName = (project.createdBy || "").toLowerCase();

            if (creatorEmail && email) {
                return creatorEmail === email;
            }

            return creatorName === name;
        });
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

                <button
                    class="interest-button ${alreadyInterested ? "interested" : ""}"
                    data-interest="${escapeHTML(project.id)}"
                    ${alreadyInterested ? "disabled" : ""}>
                    ${alreadyInterested ? "Interest sent ✓" : "Interested in this →"}
                </button>
            </div>
        `;

        return card;
    }

    // -----------------------------------------
    // SEARCH AND FILTER
    // -----------------------------------------

    function renderProjects() {
        const grid = $("#projectGrid");

        // Always read the latest shared project data.
        const latestProjects = readJSON(PROJECTS_KEY, projects);

        if (Array.isArray(latestProjects)) {
            projects = latestProjects;
        }

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
    // PROJECT INTEREST
    // -----------------------------------------

    $("#projectGrid").addEventListener("click", event => {
        const button = event.target.closest("[data-interest]");
        if (!button) return;

        const projectId = button.dataset.interest;

        if (!interests.includes(projectId)) {
            interests.push(projectId);

            if (!saveJSON(INTERESTS_KEY, interests)) {
                interests = interests.filter(id => id !== projectId);
                showToast("Could not save your interest. Please try again.");
                return;
            }

            button.textContent = "Interest sent ✓";
            button.classList.add("interested");
            button.disabled = true;

            showToast("Your interest has been saved!");
        }
    });

    // -----------------------------------------
    // CREATE PROJECT MODAL
    // -----------------------------------------

    const modal = $("#projectModal");

    $("#openCreateModal").addEventListener("click", () => {
        modal.classList.remove("hidden");
        $("#projectTitle").focus();
    });

    $("#closeCreateModal").addEventListener("click", () => {
        modal.classList.add("hidden");
    });

    modal.addEventListener("click", event => {
        if (event.target === modal) {
            modal.classList.add("hidden");
        }
    });

    // -----------------------------------------
    // CREATE NEW PROJECT
    // -----------------------------------------

    $("#projectForm").addEventListener("submit", event => {
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

        const newProject = {
            id: "custom-" + Date.now(),
            title,
            category,
            emoji: "✦",
            description,
            skills,
            members: 1,
            teamSize,
            status: "Open",
            createdBy: getUserName(),
            createdByEmail: getUserEmail()
        };

        projects.unshift(newProject);

        if (!saveProjects()) {
            projects.shift();
            showToast("Your project could not be saved. Please try again.");
            return;
        }

        $("#projectForm").reset();
        modal.classList.add("hidden");

        activeTab = "all";

        $$(".tab-button").forEach(tab => {
            tab.classList.toggle("active", tab.dataset.tab === "all");
        });

        $("#projectSearch").value = "";
        $("#topSearch").value = "";
        $("#categoryFilter").value = "all";

        refreshPage();
        showToast("Your project has been created successfully!");
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

    $("#logoutBtn").addEventListener("click", () => {
        const confirmed = confirm("Are you sure you want to log out?");

        if (confirmed) {
            localStorage.removeItem("skillmateCurrentUser");
            sessionStorage.removeItem("skillmateCurrentUser");

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
    // REFRESH WHEN SHARED STORAGE CHANGES
    // -----------------------------------------

    window.addEventListener("storage", event => {
        if (event.key === PROJECTS_KEY) {
            projects = readJSON(PROJECTS_KEY, []);
            refreshPage();
        }

        if (event.key === INTERESTS_KEY) {
            interests = readJSON(INTERESTS_KEY, []);
            renderProjects();
        }
    });

    // -----------------------------------------
    // INITIAL PAGE LOAD
    // -----------------------------------------

    refreshPage();

});