document.addEventListener("DOMContentLoaded", function () {

    const $ = selector => document.querySelector(selector);

    const MESSAGES_KEY = "skillmateMessages";
    const CONNECTIONS_KEY = "skillmateAcceptedConnections";

    // Read and save data in localStorage

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
            console.error("Could not save messages:", error);
            return false;
        }
    }

    function readSession(key, fallback) {
        try {
            const value = JSON.parse(sessionStorage.getItem(key));
            return value ?? fallback;
        } catch (error) {
            return fallback;
        }
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

    // Get the current student's details

    const currentUser =
        readSession("skillmateCurrentUser", null) ||
        readJSON("skillmateCurrentUser", null) ||
        {};

    const currentName =
        currentUser.fullName ||
        currentUser.name ||
        currentUser.username ||
        "Student";

    const currentInitials = currentName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0].toUpperCase())
        .join("");

    // Sample student details.
    // These IDs match the IDs used in Dashboard.js.

    const people = {
        p1: {
            id: "p1",
            name: "Riya Kapoor",
            initials: "RK",
            course: "CSE · Year 2",
            color: ""
        },
        p2: {
            id: "p2",
            name: "Aarav Sharma",
            initials: "AS",
            course: "CSE · Year 2",
            color: "avatar-two"
        },
        p3: {
            id: "p3",
            name: "Mehak Verma",
            initials: "MV",
            course: "Design · Year 2",
            color: "avatar-three"
        },
        p4: {
            id: "p4",
            name: "Kabir Malhotra",
            initials: "KM",
            course: "CSE · Year 1",
            color: "avatar-four"
        },
        p5: {
            id: "p5",
            name: "Sana Ali",
            initials: "SA",
            course: "CSE · Year 2",
            color: ""
        },
        p6: {
            id: "p6",
            name: "Dev Mehta",
            initials: "DM",
            course: "CSE · Year 1",
            color: "avatar-two"
        }
    };

    let acceptedConnections = readJSON(CONNECTIONS_KEY, []);

    if (!Array.isArray(acceptedConnections)) {
        acceptedConnections = [];
    }

    let conversations = readJSON(MESSAGES_KEY, {});

    if (
        !conversations ||
        typeof conversations !== "object" ||
        Array.isArray(conversations)
    ) {
        conversations = {};
    }

    let selectedContactId = "";
    let toastTimer;

    // Get the accepted students who can appear in Messages

    function getChatContacts() {
        acceptedConnections = readJSON(CONNECTIONS_KEY, []);

        if (!Array.isArray(acceptedConnections)) {
            acceptedConnections = [];
        }

        return acceptedConnections
            .map(id => people[id])
            .filter(Boolean);
    }

    function getContact(id) {
        return getChatContacts().find(person => person.id === id);
    }

    // Show a small notification

    function showMessageToast(message) {
        let toast = $("#toast");

        if (!toast) {
            toast = document.createElement("div");
            toast.id = "messagesToast";
            toast.className = "messages-toast";
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.classList.add("show");

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            toast.classList.remove("show");
        }, 2500);
    }

    // Format the time of a message

    function formatTime(dateValue) {
        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    // Get the messages for one selected student

    function getConversation(contactId) {
        if (!Array.isArray(conversations[contactId])) {
            conversations[contactId] = [];
        }

        return conversations[contactId];
    }

    // Get the last message for the contact list

    function getLastMessage(contactId) {
        const messages = getConversation(contactId);

        if (messages.length === 0) {
            return "Start a conversation";
        }

        return messages[messages.length - 1].text;
    }

    // Build the Messages interface inside the Dashboard

    function createMessagesLayout() {
        const messagesView = $("#messagesView");

        if (!messagesView) {
            console.error(
                "Messages section not found. Check for id='messagesView' in Dashboard.html."
            );
            return false;
        }

        messagesView.innerHTML = `
            <div class="messages-page">

                <div class="messages-page-header">
                    <h2>Your Messages</h2>
                    <p>
                        Connect with your teammates and continue your conversations.
                    </p>
                </div>

                <div class="messages-layout">

                    <aside class="chat-contact-panel">

                        <div class="chat-contact-heading">
                            <h3>Conversations</h3>
                            <p>Your accepted connections</p>
                        </div>

                        <div class="chat-search">
                            <span>⌕</span>
                            <input
                                type="search"
                                id="chatSearchInput"
                                placeholder="Search conversations..."
                                autocomplete="off">
                        </div>

                        <div class="chat-contact-list" id="chatContactList">
                        </div>

                    </aside>

                    <section class="chat-window">

                        <div class="chat-empty-state" id="chatEmptyState">
                            <div class="chat-empty-icon">✉</div>

                            <h3>Select a conversation</h3>

                            <p>
                                Choose one of your accepted connections
                                to start a conversation.
                            </p>
                        </div>

                        <div class="chat-active" id="chatActive" hidden>

                            <div class="chat-header">

                                <div class="chat-avatar" id="chatHeaderAvatar">
                                    S
                                </div>

                                <div class="chat-header-info">
                                    <strong id="chatHeaderName">Student</strong>
                                    <small id="chatHeaderCourse">
                                        Connected on SkillMate
                                    </small>
                                </div>

                            </div>

                            <div class="chat-body" id="chatBody">
                            </div>

                            <form class="chat-form" id="chatForm">

                                <input
                                    type="text"
                                    id="chatMessageInput"
                                    placeholder="Type your message..."
                                    maxlength="1000"
                                    autocomplete="off"
                                    required>

                                <button
                                    type="submit"
                                    class="chat-send-button"
                                    aria-label="Send message">
                                    ➤
                                </button>

                            </form>

                            <div class="chat-demo-note">
                                Demo chat: messages are saved in this browser.
                            </div>

                        </div>

                    </section>

                </div>

            </div>
        `;

        return true;
    }

    // Display the contact list

    function renderContacts() {
        const container = $("#chatContactList");

        if (!container) return;

        const searchTerm = $("#chatSearchInput")
            ? $("#chatSearchInput").value.trim().toLowerCase()
            : "";

        const contacts = getChatContacts().filter(person =>
            person.name.toLowerCase().includes(searchTerm) ||
            person.course.toLowerCase().includes(searchTerm)
        );

        if (contacts.length === 0) {

            const hasAcceptedConnections = getChatContacts().length > 0;

            container.innerHTML = hasAcceptedConnections
                ? `
                    <div class="chat-no-contacts">
                        No conversations match your search.
                    </div>
                `
                : `
                    <div class="chat-no-contacts">
                        You don't have accepted connections yet.

                        <br>

                        <a href="Dashboard.html?view=connections">
                            View connection requests →
                        </a>

                        <br><br>

                        <a href="Discover.html">
                            Discover teammates →
                        </a>
                    </div>
                `;

            return;
        }

        container.innerHTML = contacts.map(person => {

            const preview = getLastMessage(person.id);
            const selected = selectedContactId === person.id;

            return `
                <button
                    type="button"
                    class="chat-contact ${selected ? "active" : ""}"
                    data-chat-contact="${escapeHTML(person.id)}">

                    <span class="chat-avatar ${escapeHTML(person.color)}">
                        ${escapeHTML(person.initials)}
                    </span>

                    <span class="chat-contact-info">
                        <strong>${escapeHTML(person.name)}</strong>
                        <p>${escapeHTML(preview)}</p>
                    </span>

                </button>
            `;

        }).join("");
    }

    // Show one conversation

    function renderConversation() {
        const person = getContact(selectedContactId);

        const emptyState = $("#chatEmptyState");
        const activeChat = $("#chatActive");

        if (!person) {

            if (activeChat) {
                activeChat.hidden = true;
            }

            if (emptyState) {
                emptyState.hidden = false;
            }

            return;
        }

        emptyState.hidden = true;
        activeChat.hidden = false;

        $("#chatHeaderAvatar").textContent = person.initials;
        $("#chatHeaderAvatar").className =
            `chat-avatar ${person.color}`;

        $("#chatHeaderName").textContent = person.name;

        $("#chatHeaderCourse").textContent =
            `${person.course} · Connected on SkillMate`;

        const chatBody = $("#chatBody");
        const messages = getConversation(person.id);

        if (messages.length === 0) {
            chatBody.innerHTML = `
                <div class="chat-date-label">Today</div>

                <div class="chat-conversation-empty">
                    Your conversation with ${escapeHTML(person.name)} starts here.
                    <br>
                    Send a message to get started!
                </div>
            `;

            return;
        }

        chatBody.innerHTML = `
            <div class="chat-date-label">Conversation</div>

            ${messages.map(message => {

                const isSent = message.sender === "me";

                return `
                    <div class="chat-message ${isSent ? "sent" : "received"}">

                        <div class="chat-bubble">
                            ${escapeHTML(message.text)}
                        </div>

                        <span class="chat-message-time">
                            ${escapeHTML(formatTime(message.createdAt))}
                        </span>

                    </div>
                `;

            }).join("")}
        `;

        chatBody.scrollTop = chatBody.scrollHeight;
    }

    // Open a selected student's conversation

    function openConversation(contactId) {
        const person = getContact(contactId);

        if (!person) {
            showMessageToast("This student is not an accepted connection.");
            return;
        }

        selectedContactId = contactId;

        renderContacts();
        renderConversation();
    }

    // Send a new message

    function sendMessage(event) {
        event.preventDefault();

        const input = $("#chatMessageInput");
        const text = input.value.trim();

        if (!text) {
            return;
        }

        const person = getContact(selectedContactId);

        if (!person) {
            showMessageToast("Please select a conversation first.");
            return;
        }

        const messages = getConversation(person.id);

        const newMessage = {
            id: `message-${Date.now()}`,
            sender: "me",
            senderName: currentName,
            text: text,
            createdAt: new Date().toISOString()
        };

        messages.push(newMessage);

        if (!saveJSON(MESSAGES_KEY, conversations)) {
            messages.pop();
            showMessageToast("Your message could not be saved.");
            return;
        }

        input.value = "";

        renderConversation();
        renderContacts();
    }

    // Contact selection

    document.addEventListener("click", function (event) {
        const contactButton = event.target.closest("[data-chat-contact]");

        if (!contactButton) return;

        openConversation(contactButton.dataset.chatContact);
    });

    // Search conversations

    document.addEventListener("input", function (event) {
        if (event.target.id === "chatSearchInput") {
            renderContacts();
        }
    });

    // Send messages

    document.addEventListener("submit", function (event) {
        if (event.target.id === "chatForm") {
            sendMessage(event);
        }
    });

    // Update the page if another tab changes messages or connections

    window.addEventListener("storage", function (event) {

        if (
            event.key === MESSAGES_KEY ||
            event.key === CONNECTIONS_KEY
        ) {
            conversations = readJSON(MESSAGES_KEY, {});
            acceptedConnections = readJSON(CONNECTIONS_KEY, []);

            renderContacts();
            renderConversation();
        }
    });

    // Start the Messages section

    if (createMessagesLayout()) {

        const contacts = getChatContacts();

        // Open the last selected conversation if it is still accepted.
        // Otherwise, open the first available contact.

        const savedContact = readJSON("skillmateActiveChat", "");

        if (contacts.some(person => person.id === savedContact)) {
            selectedContactId = savedContact;
        } else if (contacts.length > 0) {
            selectedContactId = contacts[0].id;
        }

        renderContacts();
        renderConversation();

        // Remember which conversation was selected

        document.addEventListener("click", function (event) {
            const button = event.target.closest("[data-chat-contact]");

            if (button) {
                saveJSON("skillmateActiveChat", button.dataset.chatContact);
            }
        });
    }

});