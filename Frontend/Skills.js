document.addEventListener("DOMContentLoaded", function () {
    const params = new URLSearchParams(window.location.search);
const isEditMode = params.get("mode") === "edit";
    const form = document.getElementById("skillsForm");
    const knownGrid = document.getElementById("knownSkills");
    const knownCount = document.getElementById("knownCount");
    const teachCount = document.getElementById("teachCount");
    const teachContainer = document.getElementById("teachSkills");
    const message = document.getElementById("skillsMessage");

    const customKnownInput = document.getElementById("customKnown");
    const addKnownButton = document.getElementById("addKnownSkill");
    const customKnownList = document.getElementById("customKnownList");

    const customTeachInput = document.getElementById("customTeach");
    const addTeachButton = document.getElementById("addTeachSkill");
    const customTeachList = document.getElementById("customTeachList");

    if (!form || !knownGrid || !teachContainer) {
        alert("Skills page elements could not be found. Please check Skills.html.");
        return;
    }

    let customKnownSkills = [];
    let customTeachSkills = [];
    let selectedTeachSkills = new Set();

    function showMessage(text, type = "error") {
        message.textContent = text;
        message.className = "form-message " + type;
        message.style.display = "block";
    }

    function clearMessage() {
        message.textContent = "";
        message.className = "form-message";
        message.style.display = "none";
    }

    function getKnownSkills() {
        const selected = [
            ...knownGrid.querySelectorAll(
                'input[name="knownSkills"]:checked'
            )
        ].map(input => input.value);

        const selectedCustom = [
            ...customKnownList.querySelectorAll(
                'input[name="customKnownSkills"]:checked'
            )
        ].map(input => input.value);

        return [...new Set([...selected, ...selectedCustom])];
    }

    function getTeachSkills() {
        const selected = [
            ...teachContainer.querySelectorAll(
                'input[name="teachSkills"]:checked'
            )
        ].map(input => input.value);

        const selectedCustom = [
            ...customTeachList.querySelectorAll(
                'input[name="customTeachSkills"]:checked'
            )
        ].map(input => input.value);

        return [...new Set([...selected, ...selectedCustom])];
    }

    function updateCounts() {
        knownCount.textContent = getKnownSkills().length;
        teachCount.textContent = getTeachSkills().length;
    }

    // Category filters: All skills, Coding, Design, etc.
    document.querySelectorAll("#knownCategories .category-btn")
        .forEach(button => {
            button.addEventListener("click", function () {
                document.querySelectorAll(
                    "#knownCategories .category-btn"
                ).forEach(item => item.classList.remove("active"));

                this.classList.add("active");

                const category = this.dataset.category;

                knownGrid.querySelectorAll(".skill-option")
                    .forEach(option => {
                        option.hidden =
                            category !== "all" &&
                            option.dataset.category !== category;
                    });
            });
        });

    // Render skills that the student can teach or swap.
function renderTeachOptions() {
    const knownSkills = getKnownSkills();

    const previousSelection = [
        ...new Set([
            ...selectedTeachSkills,
            ...getTeachSkills()
        ])
    ];

    selectedTeachSkills = new Set(previousSelection);

        teachContainer.innerHTML = "";

        if (knownSkills.length === 0) {
            teachContainer.innerHTML =
                '<p class="empty-teach">First select skills you know above. They will appear here.</p>';

            updateCounts();
            return;
        }

        knownSkills.forEach(skill => {
            const label = document.createElement("label");
            label.className = "teach-option";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.name = "teachSkills";
            checkbox.value = skill;
            checkbox.checked = selectedTeachSkills.has(skill);

            const text = document.createElement("span");
            text.textContent = skill;

            checkbox.addEventListener("change", function () {
                if (this.checked) {
                    selectedTeachSkills.add(skill);
                } else {
                    selectedTeachSkills.delete(skill);
                }

                updateCounts();
                clearMessage();
            });

            label.append(checkbox, text);
            teachContainer.appendChild(label);
        });

        updateCounts();
    }

    // Add a custom skill to "Skills I know".
    function addKnownSkill() {
        const skill = customKnownInput.value.trim();

        if (!skill) {
            showMessage("Please type a skill before clicking Add skill.");
            customKnownInput.focus();
            return;
        }

        const allKnown = [
            ...getKnownSkills(),
            ...customKnownSkills
        ];

        if (allKnown.some(item =>
            item.toLowerCase() === skill.toLowerCase()
        )) {
            showMessage("This skill is already on your list.");
            return;
        }

        customKnownSkills.push(skill);
        customKnownInput.value = "";
        clearMessage();

        renderCustomKnownSkills();
        renderTeachOptions();
    }

    function renderCustomKnownSkills() {
        customKnownList.innerHTML = "";

        customKnownSkills.forEach(skill => {
            const label = document.createElement("label");
            label.className = "custom-chip";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.name = "customKnownSkills";
            checkbox.value = skill;
            checkbox.checked = true;

            const text = document.createElement("span");
            text.textContent = skill;

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.textContent = "×";
            removeButton.setAttribute("aria-label", "Remove " + skill);

            checkbox.addEventListener("change", function () {
                renderTeachOptions();
                clearMessage();
            });

            removeButton.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();

                customKnownSkills = customKnownSkills.filter(
                    item => item !== skill
                );

                selectedTeachSkills.delete(skill);
                renderCustomKnownSkills();
                renderTeachOptions();
                clearMessage();
            });

            label.append(checkbox, text, removeButton);
            customKnownList.appendChild(label);
        });

        updateCounts();
    }

    // Add a custom skill directly to "Skills I can teach or swap".
    function addTeachSkill() {
        const skill = customTeachInput.value.trim();

        if (!skill) {
            showMessage("Please type a skill you can teach first.");
            customTeachInput.focus();
            return;
        }

        const allTeach = [
            ...getTeachSkills(),
            ...customTeachSkills
        ];

        if (allTeach.some(item =>
            item.toLowerCase() === skill.toLowerCase()
        )) {
            showMessage("This teaching skill is already on your list.");
            return;
        }

        customTeachSkills.push(skill);
        customTeachInput.value = "";
        clearMessage();

        renderCustomTeachSkills();
        updateCounts();
    }

    function renderCustomTeachSkills() {
        customTeachList.innerHTML = "";

        customTeachSkills.forEach(skill => {
            const label = document.createElement("label");
            label.className = "custom-chip";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.name = "customTeachSkills";
            checkbox.value = skill;
            checkbox.checked = true;

            const text = document.createElement("span");
            text.textContent = skill;

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.textContent = "×";
            removeButton.setAttribute("aria-label", "Remove " + skill);

            checkbox.addEventListener("change", function () {
                updateCounts();
                clearMessage();
            });

            removeButton.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();

                customTeachSkills = customTeachSkills.filter(
                    item => item !== skill
                );

                renderCustomTeachSkills();
                updateCounts();
                clearMessage();
            });

            label.append(checkbox, text, removeButton);
            customTeachList.appendChild(label);
        });
    }

    addKnownButton.addEventListener("click", addKnownSkill);
    addTeachButton.addEventListener("click", addTeachSkill);

    customKnownInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            addKnownSkill();
        }
    });

    customTeachInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            addTeachSkill();
        }
    });

    // Update counters and teaching choices when skills are selected.
    knownGrid.addEventListener("change", function (event) {
        if (event.target.matches('input[name="knownSkills"]')) {
            renderTeachOptions();
            clearMessage();
        }
    });

    // Save selected skills and continue to Complete Profile.
    form.addEventListener("submit", function (event) {
        event.preventDefault();
        clearMessage();

        const knownSkills = getKnownSkills();
        const teachSkills = getTeachSkills();

        if (knownSkills.length < 2) {
            showMessage("Please select or add at least 2 skills you know.");
            return;
        }

        if (teachSkills.length < 1) {
            showMessage("Please select or add at least 1 skill you can teach.");
            return;
        }

        let draft;

        try {
            draft = JSON.parse(
                sessionStorage.getItem("skillmateSignupDraft") || "null"
            );
        } catch (error) {
            draft = null;
        }

        if (!draft || !draft.email) {
            showMessage(
                "Your account details were not found. Please go back and complete the account details first."
            );
            return;
        }

        try {
            // Keep the selected skills available for the Complete Profile page.
            // Preserve existing profile information during editing

let previousDraft = {};

try {
    previousDraft = JSON.parse(
        sessionStorage.getItem("skillmateSkillDraft") || "{}"
    );
} catch (error) {
    previousDraft = {};
}

sessionStorage.setItem(
    "skillmateSkillDraft",
    JSON.stringify({
        ...previousDraft,
        knownSkills: knownSkills,
        teachSkills: teachSkills
    })
);

// Continue to Step 3. Do not finalize the profile here.

if (isEditMode) {
    window.location.href = "./CompleteProfile.html?mode=edit";
} else {
    window.location.href = "./CompleteProfile.html";
}
        } catch (error) {
            showMessage(
                "Unable to save your selected skills. Please check your browser storage settings."
            );
        }
    });

    // Restore previously saved skill selections.
    try {
        const saved = JSON.parse(
            sessionStorage.getItem("skillmateSkillDraft") || "null"
        );

        if (saved) {
            const savedKnown = saved.knownSkills || [];
            const savedTeach = saved.teachSkills || [];

            knownGrid.querySelectorAll('input[name="knownSkills"]')
                .forEach(input => {
                    input.checked = savedKnown.includes(input.value);
                });

            customKnownSkills = savedKnown.filter(skill =>
                ![...knownGrid.querySelectorAll(
                    'input[name="knownSkills"]'
                )].some(input => input.value === skill)
            );

            customTeachSkills = savedTeach.filter(skill =>
                !savedKnown.includes(skill)
            );

            selectedTeachSkills = new Set(savedTeach);

            renderCustomKnownSkills();
            renderCustomTeachSkills();
        }
    } catch (error) {
        console.warn("Could not restore the saved skill draft.", error);
    }

    renderTeachOptions();
    renderCustomKnownSkills();
    renderCustomTeachSkills();
    updateCounts();
});