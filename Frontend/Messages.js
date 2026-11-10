document.addEventListener("DOMContentLoaded", async function () {

    const $ = selector => document.querySelector(selector);

    const MESSAGES_API = "http://127.0.0.1:5000/api/messages";

    let currentUser = null;
    let contacts = [];
    let conversations = {};
    let selectedContactId = "";
    let toastTimer;

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

    function showMessageToast(message) {
        let toast = $("#messagesToast");

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

    function formatTime(dateValue) {
        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) return "";

        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    // BACKEND API HELPER

    async function apiRequest(url, options = {}) {

        const response = await fetch(url, {
            ...options,
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Something went wrong.");
        }

        return result;
    }

    // CREATE MESSAGES LAYOUT

    function createMessagesLayout() {

        const messagesView = $("#messagesView");

        if (!messagesView) {
            console.error("Messages section not found.");
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
                                Messages are saved to your SkillMate account.
                            </div>

                        </div>

                    </section>

                </div>

            </div>
        `;

        return true;
    }

    // GET ACCEPTED CONNECTIONS FROM BACKEND

    async function loadContacts() {

        try {
            const result = await apiRequest(
                `${MESSAGES_API}/contacts`
            );

            contacts = result.contacts.map(contact => ({
                id: contact._id,
                name: contact.fullName || "Student",
                initials: getInitials(contact.fullName),
                course: [
                    contact.course || contact.college || "SkillMate Student",
                    contact.year ? `Year ${contact.year}` : ""
                ].filter(Boolean).join(" · "),
                color: ""
            }));

            renderContacts();

        } catch (error) {
            console.error("Could not load contacts:", error);
            showMessageToast(error.message);
        }
    }

    function getContact(id) {
        return contacts.find(person => person.id === id);
    }

    // GET CONVERSATION FROM BACKEND

    async function loadConversation(contactId) {

        try {
            const result = await apiRequest(
                `${MESSAGES_API}/${encodeURIComponent(contactId)}`
            );

            conversations[contactId] = result.messages || [];

            renderConversation();
            renderContacts();

        } catch (error) {
            console.error("Could not load conversation:", error);
            showMessageToast(error.message);
        }
    }

    function getConversation(contactId) {
        return conversations[contactId] || [];
    }

    function getLastMessage(contactId) {

        const messages = getConversation(contactId);

        if (messages.length === 0) {
            return "Start a conversation";
        }

        return messages[messages.length - 1].text;
    }

    // DISPLAY CONTACTS

    function renderContacts() {

        const container = $("#chatContactList");

        if (!container) return;

        const searchTerm = $("#chatSearchInput")
            ? $("#chatSearchInput").value.trim().toLowerCase()
            : "";

        const filteredContacts = contacts.filter(person =>
            person.name.toLowerCase().includes(searchTerm) ||
            person.course.toLowerCase().includes(searchTerm)
        );

        if (filteredContacts.length === 0) {

            container.innerHTML = contacts.length > 0
                ? `
                    <div class="chat-no-contacts">
                        No conversations match your search.
                    </div>
                `
                : `
                    <div class="chat-no-contacts">
                        You don't have accepted connections yet.

                        <br><br>

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

        container.innerHTML = filteredContacts.map(person => {

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
                        <p>${escapeHTML(getLastMessage(person.id))}</p>
                    </span>

                </button>
            `;

        }).join("");
    }

    // DISPLAY SELECTED CONVERSATION

    function renderConversation() {

        const person = getContact(selectedContactId);

        const emptyState = $("#chatEmptyState");
        const activeChat = $("#chatActive");

        if (!person) {

            activeChat.hidden = true;
            emptyState.hidden = false;

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

                const isSent =
                    String(message.senderId) === String(currentUser._id);

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

    // OPEN CONVERSATION

    async function openConversation(contactId) {

        const person = getContact(contactId);

        if (!person) {
            showMessageToast("This student is not an accepted connection.");
            return;
        }

        selectedContactId = contactId;

        sessionStorage.setItem("skillmateActiveChat", contactId);

        renderContacts();

        $("#chatBody").innerHTML = `
            <div class="chat-conversation-empty">
                Loading messages...
            </div>
        `;

        await loadConversation(contactId);
    }

    // SEND MESSAGE THROUGH BACKEND

    async function sendMessage(event) {

        event.preventDefault();

        const input = $("#chatMessageInput");
        const text = input.value.trim();

        if (!text) return;

        const person = getContact(selectedContactId);

        if (!person) {
            showMessageToast("Please select a conversation first.");
            return;
        }

        const sendButton = document.querySelector(".chat-send-button");

        sendButton.disabled = true;

        try {

            await apiRequest(
                `${MESSAGES_API}/${encodeURIComponent(person.id)}`,
                {
                    method: "POST",
                    body: JSON.stringify({ text })
                }
            );

            input.value = "";

            await loadConversation(person.id);

            showMessageToast("Message sent successfully!");

        } catch (error) {

            console.error("Could not send message:", error);
            showMessageToast(error.message);

        } finally {
            sendButton.disabled = false;
        }
    }

    // CONTACT SELECTION

    document.addEventListener("click", function (event) {

        const contactButton = event.target.closest("[data-chat-contact]");

        if (!contactButton) return;

        openConversation(contactButton.dataset.chatContact);
    });

    // SEARCH CONTACTS

    document.addEventListener("input", function (event) {

        if (event.target.id === "chatSearchInput") {
            renderContacts();
        }
    });

    // SEND MESSAGE FORM

    document.addEventListener("submit", function (event) {

        if (event.target.id === "chatForm") {
            sendMessage(event);
        }
    });

    // START MESSAGES PAGE

    if (createMessagesLayout()) {

        try {

          const userResult = await apiRequest(
    "http://127.0.0.1:5000/api/users/me"
);
            currentUser = userResult.user;

            if (!currentUser || !currentUser._id) {
                throw new Error("Could not identify the logged-in student.");
            }

            await loadContacts();

            const savedContact =
                sessionStorage.getItem("skillmateActiveChat");

            if (contacts.some(person => person.id === savedContact)) {
                selectedContactId = savedContact;
            } else if (contacts.length > 0) {
                selectedContactId = contacts[0].id;
            }

            renderContacts();

            if (selectedContactId) {
                await loadConversation(selectedContactId);
            }

        } catch (error) {

            console.error("Messages initialization failed:", error);

            showMessageToast(
                error.message || "Could not load Messages. Please login again."
            );
        }
    }

});