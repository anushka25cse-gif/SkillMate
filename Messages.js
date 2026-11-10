document.addEventListener("DOMContentLoaded", function () {

    const $ = selector => document.querySelector(selector);

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    // Get the current student's details (cached by api.js after login)

    const currentUser = SkillMate.getUser() || {};

    const currentName =
        currentUser.fullName ||
        currentUser.name ||
        currentUser.username ||
        "Student";

    const currentInitials = SkillMate.initials(currentName);

    // Live data from the SkillMate API.
    const api = SkillMate.api;

    const avatarColours = ["", "avatar-two", "avatar-three", "avatar-four"];

    let contacts = [];        // accepted connections from /api/messages/threads
    let conversations = {};   // userId -> messages, loaded when opened
    let selectedContactId = "";
    let toastTimer;

    /** API thread -> the contact shape the list template expects. */
    function mapThread(thread, index) {
        return {
            id: thread.person.id,
            name: thread.person.name,
            initials: thread.person.initials || SkillMate.initials(thread.person.name),
            course: SkillMate.courseLabel(thread.person),
            color: avatarColours[index % avatarColours.length],
            unreadCount: thread.unreadCount || 0,
            preview: thread.lastMessage ? thread.lastMessage.content : ""
        };
    }

    /** API message -> the shape the chat bubbles already render. */
    function mapMessage(message) {
        return {
            id: message.id,
            sender: message.mine ? "me" : message.senderId,
            senderId: message.senderId,
            text: message.content,
            createdAt: message.timestamp,
            read: Boolean(message.read),
            mine: Boolean(message.mine)
        };
    }

    /** Refresh the conversation list from the server. */
    async function loadThreads() {
        const payload = await api.messageThreads();

        contacts = (payload.threads || []).map(mapThread);
    }

    // The accepted students who can appear in Messages

    function getChatContacts() {
        return contacts;
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

        if (messages.length > 0) {
            return messages[messages.length - 1].text;
        }

        const contact = getContact(contactId);

        if (contact && contact.preview) {
            return contact.preview;
        }

        return "Start a conversation";
    }

    /** Load one conversation from the server the first time it is opened. */
    async function loadConversation(contactId) {
        const payload = await api.conversation(contactId);

        const messages = (payload.messages || []).map(mapMessage);

        conversations[contactId] = messages;

        // Mark everything the other student sent as read, then refresh the
        // thread list so the unread badge disappears.
        const unread = messages.filter(message => !message.mine && !message.read);

        if (unread.length > 0) {
            await Promise.all(
                unread.map(message => api.markMessageRead(message.id))
            );

            messages.forEach(message => {
                if (!message.mine) message.read = true;
            });

            const contact = contacts.find(item => item.id === contactId);

            if (contact) contact.unreadCount = 0;
        }

        const last = messages[messages.length - 1];

        const contact = contacts.find(item => item.id === contactId);

        if (contact && last) {
            contact.preview = last.text;
        }
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
                                Messages are stored securely on the SkillMate server.
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

    async function openConversation(contactId) {
        const person = getContact(contactId);

        if (!person) {
            showMessageToast("This student is not an accepted connection.");
            return;
        }

        selectedContactId = contactId;

        renderContacts();

        if (!Array.isArray(conversations[contactId])) {
            try {
                await loadConversation(contactId);
            } catch (error) {
                showMessageToast(
                    error.message || "This conversation could not be loaded."
                );
                return;
            }
        }

        renderContacts();
        renderConversation();
    }

    // Send a new message

    async function sendMessage(event) {
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

        input.value = "";

        try {
            const result = await api.sendMessage(person.id, text);

            const messages = getConversation(person.id);

            messages.push(mapMessage(result.data));

            person.preview = text;
        } catch (error) {
            input.value = text;
            showMessageToast(error.message || "Your message could not be sent.");
            return;
        }

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

    // Start the Messages section with live data from the server.

    async function startMessages() {
        if (!SkillMate.requireAuth()) return;

        if (!createMessagesLayout()) return;

        try {
            await loadThreads();
        } catch (error) {
            console.error("Messages could not be loaded:", error);

            if (error.status === 401) {
                SkillMate.clearSession();
                window.location.href = "./StudentLogin.html";
                return;
            }

            showMessageToast(
                error.message || "Your conversations could not be loaded."
            );
        }

        const availableContacts = getChatContacts();

        if (availableContacts.length > 0) {
            selectedContactId = availableContacts[0].id;

            try {
                await loadConversation(selectedContactId);
            } catch (error) {
                console.warn("Conversation could not be opened:", error);
            }
        }

        renderContacts();
        renderConversation();
    }

    startMessages();
});