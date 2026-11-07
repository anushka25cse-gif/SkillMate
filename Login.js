document.addEventListener("DOMContentLoaded", function () {

    const menuToggle = document.getElementById("menuToggle");
    const navLinks = document.getElementById("navLinks");

    // Mobile navigation menu

    if (menuToggle && navLinks) {

        menuToggle.addEventListener("click", function () {

            navLinks.classList.toggle("open");

            const menuIsOpen = navLinks.classList.contains("open");

            menuToggle.setAttribute(
                "aria-expanded",
                menuIsOpen
            );

            menuToggle.textContent = menuIsOpen ? "✕" : "☰";
        });

        // Close menu after clicking a link

        navLinks.querySelectorAll("a").forEach(function (link) {

            link.addEventListener("click", function () {

                navLinks.classList.remove("open");

                menuToggle.setAttribute("aria-expanded", "false");

                menuToggle.textContent = "☰";
            });

        });
    }

    // Update copyright year

    const currentYear = document.getElementById("currentYear");

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

});